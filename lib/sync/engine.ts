import { parseCid } from "@atproto/lex-data";
import {
  RepoCommit,
  verifyCommit,
  verifyRepoCarFull,
  type SignedCommit,
} from "@atproto/space";
import {
  LABEL_COLLECTION,
  POSITION_COLLECTION,
  POST_COLLECTION,
  SYNC_SERVICE,
} from "../config";
import {
  applySyncedChanges,
  deleteSyncedSpace,
  getSyncedRepo,
  listSpaceWatches,
  replaceRepoRecords,
  saveBoard,
  saveSpaceWatch,
  saveSyncedRepo,
  updateSpaceWatch,
  type SpaceWatch,
  type SyncedChange,
} from "../db/queries";
import { getOAuthClient, listStoredSessionDids } from "../auth/client";
import { isNoteColor, isNoteRotation } from "../note-style";
import { getIdResolver, resolvePds } from "../atproto/identity";
import { getFollowersAmong } from "../atproto/follows";
import {
  mintSpaceCredential,
  type SpaceCredential,
} from "../atproto/space-credential";
import { orderCredentialCandidates } from "./credential-candidates";
import { isSpaceDeletedError } from "./errors";
import {
  REGISTRATION_RETRY_MS,
  registrationRenewalDelay,
} from "./registration";

type NotifyInput = { space: string; repo: string; rev: string };
type OnChange = (space: string) => void;

export class SyncEngine {
  private credentials = new Map<string, SpaceCredential>();
  private jobs = new Map<string, Promise<void>>();
  private deletedSpaces = new Set<string>();
  private registrationTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  constructor(private readonly onChange: OnChange) {}

  async resume(): Promise<void> {
    await Promise.all(
      listSpaceWatches().map((watch) =>
        this.reconcile(watch).catch((error) => {
          this.recordError(watch.spaceUri, error);
          this.scheduleRegistrationRetry(watch);
        }),
      ),
    );
  }

  async watch(space: string): Promise<void> {
    if (this.deletedSpaces.has(space)) throw new Error("Space has been deleted");
    const authorityDid = authorityFromSpace(space);
    saveSpaceWatch({ spaceUri: space, authorityDid });
    const watch = listSpaceWatches().find((item) => item.spaceUri === space);
    if (!watch) throw new Error("Could not save board subscription");
    try {
      await this.reconcile(watch);
    } catch (error) {
      this.recordError(watch.spaceUri, error);
      this.scheduleRegistrationRetry(watch);
      throw error;
    }
  }

  async notify(input: NotifyInput): Promise<void> {
    if (this.deletedSpaces.has(input.space)) return;
    const watch = listSpaceWatches().find((item) => item.spaceUri === input.space);
    if (!watch) return;
    await this.enqueue(input.space, input.repo, async () => {
      if (this.deletedSpaces.has(input.space)) return;
      await this.syncRepo(watch, input.repo);
      if (this.deletedSpaces.has(input.space)) return;
      this.onChange(input.space);
    });
  }

  deleteSpace(space: string): void {
    this.deletedSpaces.add(space);
    this.credentials.delete(space);
    const timer = this.registrationTimers.get(space);
    if (timer) clearTimeout(timer);
    this.registrationTimers.delete(space);
    deleteSyncedSpace(space);
    this.onChange(space);
  }

  stop(): void {
    for (const timer of this.registrationTimers.values()) clearTimeout(timer);
    this.registrationTimers.clear();
  }

  private async reconcile(watch: SpaceWatch): Promise<void> {
    await this.withCredential(watch, async (credential) => {
      let changed = false;
      const authorityPds = await resolvePds(watch.authorityDid);
      const authorityAgent = credential.agent(authorityPds);
      let registrationExpiresAt = watch.registrationExpiresAt;
      if (registrationNeedsRenewal(watch.registrationExpiresAt)) {
        const registered = await authorityAgent.com.atproto.space.registerNotify({
          space: watch.spaceUri,
          service: SYNC_SERVICE,
        });
        registrationExpiresAt = registered.data.expiresAt;
        updateSpaceWatch({
          spaceUri: watch.spaceUri,
          registrationExpiresAt,
          lastError: null,
        });
      }
      if (registrationExpiresAt) {
        this.scheduleRegistrationRenewal(watch, registrationExpiresAt);
      }

      let cursor: string | undefined;
      do {
        const page = await authorityAgent.com.atproto.space.listRepos({
          space: watch.spaceUri,
          limit: 1000,
          cursor,
        });
        for (const repo of page.data.repos) {
          if (this.deletedSpaces.has(watch.spaceUri)) return;
          const local = getSyncedRepo(watch.spaceUri, repo.did);
          if (!local || local.rev !== repo.rev) {
            await this.enqueue(watch.spaceUri, repo.did, () =>
              this.syncRepoWithCredential(watch, repo.did, credential),
            );
            changed = true;
          }
        }
        cursor = page.data.cursor;
      } while (cursor);

      if (this.deletedSpaces.has(watch.spaceUri)) return;
      saveBoard(watch.spaceUri, watch.authorityDid);
      updateSpaceWatch({ spaceUri: watch.spaceUri, lastError: null });
      if (changed) this.onChange(watch.spaceUri);
    });
  }

  private async syncRepo(watch: SpaceWatch, repoDid: string): Promise<void> {
    await this.withCredential(watch, (credential) =>
      this.syncRepoWithCredential(watch, repoDid, credential),
    );
  }

  private async renewRegistration(watch: SpaceWatch): Promise<void> {
    await this.withCredential(watch, async (credential) => {
      const authorityPds = await resolvePds(watch.authorityDid);
      const authorityAgent = credential.agent(authorityPds);
      const registered = await authorityAgent.com.atproto.space.registerNotify({
        space: watch.spaceUri,
        service: SYNC_SERVICE,
      });
      if (this.deletedSpaces.has(watch.spaceUri)) return;
      updateSpaceWatch({
        spaceUri: watch.spaceUri,
        registrationExpiresAt: registered.data.expiresAt,
        lastError: null,
      });
      this.scheduleRegistrationRenewal(watch, registered.data.expiresAt);
    });
  }

  private scheduleRegistrationRenewal(
    watch: SpaceWatch,
    expiresAt: string,
  ): void {
    this.scheduleRegistration(
      watch,
      registrationRenewalDelay(expiresAt),
    );
  }

  private scheduleRegistrationRetry(watch: SpaceWatch): void {
    if (this.deletedSpaces.has(watch.spaceUri)) return;
    if (this.registrationTimers.has(watch.spaceUri)) return;
    this.scheduleRegistration(watch, REGISTRATION_RETRY_MS);
  }

  private scheduleRegistration(watch: SpaceWatch, delay: number): void {
    if (this.deletedSpaces.has(watch.spaceUri)) return;
    const existing = this.registrationTimers.get(watch.spaceUri);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.registrationTimers.delete(watch.spaceUri);
      void this.renewRegistration(watch).catch((error) => {
        this.recordError(watch.spaceUri, error);
        this.scheduleRegistrationRetry(watch);
      });
    }, delay);
    timer.unref();
    this.registrationTimers.set(watch.spaceUri, timer);
  }

  private async syncRepoWithCredential(
    watch: SpaceWatch,
    repoDid: string,
    credential: SpaceCredential,
  ): Promise<void> {
    if (this.deletedSpaces.has(watch.spaceUri)) return;
    const local = getSyncedRepo(watch.spaceUri, repoDid);
    if (!local) {
      await this.recoverRepo(watch.spaceUri, repoDid, credential);
      return;
    }

    try {
      const agent = credential.agent(local.pdsUrl);
      const state = RepoCommit.fromState(local.ltHash);
      const changes: SyncedChange[] = [];
      let cursor: string | undefined;
      let commit: SignedCommit | undefined;

      do {
        const page = await agent.com.atproto.space.listRepoOps({
          space: watch.spaceUri,
          repo: repoDid,
          since: local.rev,
          cursor,
          limit: 1000,
        });
        for (const op of page.data.ops) {
          state.applyOp({
            collection: op.collection,
            rkey: op.rkey,
            cid: op.cid ? parseCid(op.cid) : null,
            prev: op.prev ? parseCid(op.prev) : null,
          });
          const change = parseChange({
            space: watch.spaceUri,
            repoDid,
            collection: op.collection,
            rkey: op.rkey,
            cid: op.cid,
            value: op.value,
          });
          if (change) changes.push(change);
        }
        cursor = page.data.cursor;
        if (page.data.commit) commit = asSignedCommit(page.data.commit);
      } while (cursor);

      if (!commit) throw new Error("Incremental sync did not reach a commit");
      const didKey = await resolveDidKey(repoDid);
      const valid = await verifyCommit(
        commit,
        { space: watch.spaceUri, author: repoDid, rev: commit.rev },
        didKey,
      );
      if (!valid || !state.matches(commit)) {
        throw new Error("Incremental sync hash mismatch");
      }

      if (this.deletedSpaces.has(watch.spaceUri)) return;
      applySyncedChanges(changes);
      saveSyncedRepo({
        spaceUri: watch.spaceUri,
        repoDid,
        pdsUrl: local.pdsUrl,
        rev: commit.rev,
        ltHash: state.setHash.state(),
        commitHash: commit.hash,
      });
    } catch (error) {
      if (this.deletedSpaces.has(watch.spaceUri)) return;
      console.warn(`incremental sync fell back to recovery for ${repoDid}`, error);
      await this.recoverRepo(watch.spaceUri, repoDid, credential);
    }
  }

  private async recoverRepo(
    space: string,
    repoDid: string,
    credential: SpaceCredential,
  ): Promise<void> {
    const pdsUrl = await resolvePds(repoDid);
    const url = new URL(`${pdsUrl}/xrpc/com.atproto.space.getRepo`);
    url.searchParams.set("space", space);
    url.searchParams.set("repo", repoDid);
    const response = await credential.fetch(url);
    if (!response.ok) {
      throw new Error(`Repo recovery failed (${response.status})`);
    }

    const didKey = await resolveDidKey(repoDid);
    const recovered = await verifyRepoCarFull(
      [new Uint8Array(await response.arrayBuffer())],
      { space, author: repoDid, didKey },
    );
    const posts: Parameters<typeof replaceRepoRecords>[0]["posts"] = [];
    const labels: Parameters<typeof replaceRepoRecords>[0]["labels"] = [];
    const positions: Parameters<typeof replaceRepoRecords>[0]["positions"] = [];

    for (const record of recovered.records) {
      const change = parseChange({
        space,
        repoDid,
        collection: record.collection,
        rkey: record.rkey,
        cid: record.cid.toString(),
        value: record.record,
      });
      if (change?.kind === "post") posts.push(stripPost(change.value));
      if (change?.kind === "label") labels.push(stripLabel(change.value));
      if (change?.kind === "position") positions.push(stripPosition(change.value));
    }

    if (this.deletedSpaces.has(space)) return;
    replaceRepoRecords({ spaceUri: space, authorDid: repoDid, posts, labels, positions });
    saveSyncedRepo({
      spaceUri: space,
      repoDid,
      pdsUrl,
      rev: recovered.commit.rev,
      ltHash: recovered.repo.setHash.state(),
      commitHash: recovered.commit.hash,
    });
  }

  private async withCredential<T>(
    watch: SpaceWatch,
    operation: (credential: SpaceCredential) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt++) {
      let credential: SpaceCredential;
      try {
        credential = await this.credentialFor(watch, attempt > 0);
      } catch (error) {
        if (isSpaceDeletedError(error)) this.deleteSpace(watch.spaceUri);
        throw error;
      }
      try {
        return await operation(credential);
      } catch (error) {
        if (isSpaceDeletedError(error)) {
          this.deleteSpace(watch.spaceUri);
          throw error;
        }
        if (attempt > 0) throw error;
        this.credentials.delete(watch.spaceUri);
      }
    }
    throw new Error("Could not obtain a board sync credential");
  }

  private async credentialFor(
    watch: SpaceWatch,
    refresh = false,
  ): Promise<SpaceCredential> {
    if (!refresh) {
      const existing = this.credentials.get(watch.spaceUri);
      if (existing) return existing;
    }
    const sessionDids = listStoredSessionDids();
    const oauthClient = await getOAuthClient();
    let lastError: unknown;

    if (sessionDids.includes(watch.authorityDid)) {
      try {
        const session = await oauthClient.restore(watch.authorityDid);
        const credential = await mintSpaceCredential(session, watch.spaceUri);
        this.credentials.set(watch.spaceUri, credential);
        return credential;
      } catch (error) {
        if (isSpaceDeletedError(error)) throw error;
        lastError = error;
        console.warn(
          `could not mint sync credential for ${watch.authorityDid}`,
          error,
        );
      }
    }

    const otherDids = sessionDids.filter((did) => did !== watch.authorityDid);
    const followers = await getFollowersAmong(watch.authorityDid, otherDids);
    const candidates = orderCredentialCandidates(
      watch.authorityDid,
      otherDids,
      followers,
    );

    for (const did of candidates) {
      try {
        const session = await oauthClient.restore(did);
        const credential = await mintSpaceCredential(session, watch.spaceUri);
        this.credentials.set(watch.spaceUri, credential);
        return credential;
      } catch (error) {
        if (isSpaceDeletedError(error)) throw error;
        lastError = error;
        console.warn(`could not mint sync credential for ${did}`, error);
      }
    }

    throw lastError ?? new Error("No authorized OAuth session can sync this board");
  }

  private enqueue(space: string, repo: string, job: () => Promise<void>): Promise<void> {
    const key = `${space}|${repo}`;
    const previous = this.jobs.get(key) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(job);
    this.jobs.set(key, next);
    void next.finally(() => {
      if (this.jobs.get(key) === next) this.jobs.delete(key);
    });
    return next;
  }

  private recordError(space: string, error: unknown): void {
    console.error(`sync failed for ${space}`, error);
    updateSpaceWatch({
      spaceUri: space,
      lastError: error instanceof Error ? error.message : "Sync failed",
    });
  }
}

function parseChange(input: {
  space: string;
  repoDid: string;
  collection: string;
  rkey: string;
  cid: string | null;
  value?: unknown;
}): SyncedChange | undefined {
  const uri = `${input.space}/${input.repoDid}/${input.collection}/${input.rkey}`;
  const table = tableForCollection(input.collection);
  if (!input.cid) return table ? { kind: "delete", table, uri } : undefined;
  if (!input.value || typeof input.value !== "object") return undefined;
  const value = input.value as Record<string, unknown>;
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : undefined;

  if (input.collection === POST_COLLECTION && typeof value.text === "string" && createdAt) {
    const position = parsePosition(value.position);
    return {
      kind: "post",
      value: {
        uri,
        cid: input.cid,
        spaceUri: input.space,
        authorDid: input.repoDid,
        text: value.text,
        color: isNoteColor(value.color) ? value.color : undefined,
        rotation: isNoteRotation(value.rotation) ? value.rotation : undefined,
        x: position?.x,
        y: position?.y,
        createdAt,
      },
    };
  }

  const subject = parseSubject(value.subject);
  if (
    input.collection === LABEL_COLLECTION &&
    subject &&
    typeof value.val === "string" &&
    createdAt
  ) {
    return {
      kind: "label",
      value: {
        uri,
        cid: input.cid,
        spaceUri: input.space,
        authorDid: input.repoDid,
        subjectUri: subject.uri,
        subjectCid: subject.cid,
        val: value.val,
        neg: value.neg === true,
        createdAt,
      },
    };
  }

  const position = parsePosition(value.position);
  if (
    input.collection === POSITION_COLLECTION &&
    subject?.cid &&
    position &&
    createdAt
  ) {
    return {
      kind: "position",
      value: {
        uri,
        cid: input.cid,
        spaceUri: input.space,
        authorDid: input.repoDid,
        subjectUri: subject.uri,
        subjectCid: subject.cid,
        ...position,
        createdAt,
      },
    };
  }
  return undefined;
}

function parsePosition(value: unknown): { x: number; y: number } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const position = value as { x?: unknown; y?: unknown };
  return validCoordinate(position.x) && validCoordinate(position.y)
    ? { x: position.x, y: position.y }
    : undefined;
}

function parseSubject(value: unknown): { uri: string; cid?: string } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const subject = value as { uri?: unknown; cid?: unknown };
  if (typeof subject.uri !== "string") return undefined;
  const cid =
    typeof subject.cid === "string"
      ? subject.cid
      : subject.cid && typeof subject.cid === "object"
        ? String(subject.cid)
        : undefined;
  return { uri: subject.uri, cid };
}

function tableForCollection(
  collection: string,
): "post" | "moderation_label" | "note_position" | undefined {
  if (collection === POST_COLLECTION) return "post";
  if (collection === LABEL_COLLECTION) return "moderation_label";
  if (collection === POSITION_COLLECTION) return "note_position";
  return undefined;
}

function validCoordinate(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 1000;
}

function authorityFromSpace(space: string): string {
  const authority = space.match(/^at:\/\/(did:[^/]+)\/space\//)?.[1];
  if (!authority) throw new Error("Invalid board reference");
  return authority;
}

async function resolveDidKey(did: string): Promise<string> {
  const key = await getIdResolver().did.resolveAtprotoKey(did);
  if (!key) throw new Error(`Could not resolve signing key for ${did}`);
  return key;
}

function registrationNeedsRenewal(expiresAt: string | null): boolean {
  return !expiresAt || Date.parse(expiresAt) - Date.now() < 60 * 60 * 1000;
}

function asSignedCommit(commit: {
  ver: number;
  hash: Uint8Array;
  ikm: Uint8Array;
  sig: Uint8Array;
  mac: Uint8Array;
  rev: string;
}): SignedCommit {
  if (commit.ver !== 1) throw new Error(`Unsupported commit version ${commit.ver}`);
  return commit as SignedCommit;
}

function stripPost(value: Extract<SyncedChange, { kind: "post" }>["value"]) {
  return {
    cid: value.cid,
    uri: value.uri,
    text: value.text,
    color: value.color,
    rotation: value.rotation,
    x: value.x,
    y: value.y,
    createdAt: value.createdAt,
  };
}

function stripLabel(value: Extract<SyncedChange, { kind: "label" }>["value"]) {
  return {
    cid: value.cid,
    uri: value.uri,
    subjectUri: value.subjectUri,
    subjectCid: value.subjectCid,
    val: value.val,
    neg: value.neg,
    createdAt: value.createdAt,
  };
}

function stripPosition(value: Extract<SyncedChange, { kind: "position" }>["value"]) {
  return {
    cid: value.cid,
    uri: value.uri,
    subjectUri: value.subjectUri,
    subjectCid: value.subjectCid,
    x: value.x,
    y: value.y,
    createdAt: value.createdAt,
  };
}
