import { getDb } from "./index";
import { fallbackNoteStyle, type NoteColor } from "../note-style";
import type { NoteImage } from "../note-image";
import { deleteBlobFile } from "../blob-store";

export type BoardPost = {
  uri: string;
  cid: string;
  spaceUri: string;
  authorDid: string;
  authorHandle: string | null;
  text: string;
  imageCid: string | null;
  imageMime: string | null;
  imageSize: number | null;
  imageAlt: string | null;
  color: NoteColor;
  rotation: number;
  x: number;
  y: number;
  createdAt: string;
  hidden: boolean;
};

export type StoredPost = Omit<
  BoardPost,
  "authorHandle" | "hidden" | "x" | "y" | "color" | "rotation"
> & {
  x: number | null;
  y: number | null;
  color: NoteColor | null;
  rotation: number | null;
};

export type SpaceWatch = {
  spaceUri: string;
  authorityDid: string;
  registrationExpiresAt: string | null;
  lastError: string | null;
};

export type SyncedRepo = {
  spaceUri: string;
  repoDid: string;
  pdsUrl: string;
  rev: string;
  ltHash: Uint8Array;
  commitHash: Uint8Array;
};

export type SpaceBlob = {
  spaceUri: string;
  repoDid: string;
  cid: string;
  mimeType: string;
  size: number;
};

export function saveAccount(input: {
  did: string;
  handle?: string | null;
  pdsUrl?: string | null;
}): void {
  getDb()
    .prepare(
      `INSERT INTO account(did, handle, pds_url, updated_at)
       VALUES (@did, @handle, @pdsUrl, @updatedAt)
       ON CONFLICT(did) DO UPDATE SET
         handle = COALESCE(excluded.handle, account.handle),
         pds_url = COALESCE(excluded.pds_url, account.pds_url),
         updated_at = excluded.updated_at`,
    )
    .run({ ...input, updatedAt: new Date().toISOString() });
}

export function getAccount(did: string): {
  did: string;
  handle: string | null;
  pdsUrl: string | null;
} | null {
  return (
    (getDb()
      .prepare(
        "SELECT did, handle, pds_url AS pdsUrl FROM account WHERE did = ?",
      )
      .get(did) as
      | { did: string; handle: string | null; pdsUrl: string | null }
      | undefined) ?? null
  );
}

export function saveBoard(spaceUri: string, ownerDid: string): void {
  getDb()
    .prepare(
      `INSERT INTO board(space_uri, owner_did, created_at) VALUES (?, ?, ?)
       ON CONFLICT(space_uri) DO NOTHING`,
    )
    .run(spaceUri, ownerDid, new Date().toISOString());
}

export function hasBoard(ownerDid: string): boolean {
  return Boolean(
    getDb().prepare("SELECT 1 FROM board WHERE owner_did = ?").get(ownerDid),
  );
}

export function listBoards(): Array<{
  ownerDid: string;
  handle: string | null;
}> {
  return getDb()
    .prepare(
      `SELECT b.owner_did AS ownerDid, a.handle
       FROM board b
       LEFT JOIN account a ON a.did = b.owner_did
       ORDER BY COALESCE(a.handle, b.owner_did)`,
    )
    .all() as Array<{ ownerDid: string; handle: string | null }>;
}

export function saveSpaceWatch(input: {
  spaceUri: string;
  authorityDid: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO sync_space(space_uri, authority_did, updated_at)
       VALUES (@spaceUri, @authorityDid, @updatedAt)
       ON CONFLICT(space_uri) DO UPDATE SET
         authority_did = excluded.authority_did,
         updated_at = excluded.updated_at`,
    )
    .run({ ...input, updatedAt: new Date().toISOString() });
}

export function listSpaceWatches(): SpaceWatch[] {
  return getDb()
    .prepare(
      `SELECT space_uri AS spaceUri, authority_did AS authorityDid,
              registration_expires_at AS registrationExpiresAt,
              last_error AS lastError
       FROM sync_space`,
    )
    .all() as SpaceWatch[];
}

export function deleteSyncedSpace(spaceUri: string): void {
  const db = getDb();
  const dereferenced = db.transaction(() => {
    const cids = db
      .prepare("SELECT cid FROM space_blob WHERE space_uri = ?")
      .all(spaceUri)
      .map((row) => (row as { cid: string }).cid);
    db.prepare("DELETE FROM space_blob WHERE space_uri = ?").run(spaceUri);
    db.prepare("DELETE FROM note_position WHERE space_uri = ?").run(spaceUri);
    db.prepare("DELETE FROM moderation_label WHERE space_uri = ?").run(spaceUri);
    db.prepare("DELETE FROM post WHERE space_uri = ?").run(spaceUri);
    db.prepare("DELETE FROM sync_repo WHERE space_uri = ?").run(spaceUri);
    db.prepare("DELETE FROM sync_space WHERE space_uri = ?").run(spaceUri);
    db.prepare("DELETE FROM board WHERE space_uri = ?").run(spaceUri);
    return cids;
  })();
  deleteUnreferencedBlobFiles(db, dereferenced);
}

export function updateSpaceWatch(input: {
  spaceUri: string;
  registrationExpiresAt?: string | null;
  lastError?: string | null;
}): void {
  getDb()
    .prepare(
      `UPDATE sync_space SET
         registration_expires_at = COALESCE(@registrationExpiresAt, registration_expires_at),
         last_error = @lastError,
         updated_at = @updatedAt
       WHERE space_uri = @spaceUri`,
    )
    .run({
      spaceUri: input.spaceUri,
      registrationExpiresAt: input.registrationExpiresAt ?? null,
      lastError: input.lastError ?? null,
      updatedAt: new Date().toISOString(),
    });
}

export function getSyncedRepo(spaceUri: string, repoDid: string): SyncedRepo | null {
  const row = getDb()
    .prepare(
      `SELECT space_uri AS spaceUri, repo_did AS repoDid, pds_url AS pdsUrl,
              rev, lthash AS ltHash, commit_hash AS commitHash
       FROM sync_repo WHERE space_uri = ? AND repo_did = ?`,
    )
    .get(spaceUri, repoDid) as
    | Omit<SyncedRepo, "ltHash" | "commitHash"> & {
        ltHash: Buffer;
        commitHash: Buffer;
      }
    | undefined;
  return row
    ? {
        ...row,
        ltHash: new Uint8Array(row.ltHash),
        commitHash: new Uint8Array(row.commitHash),
      }
    : null;
}

export function saveSyncedRepo(input: SyncedRepo): void {
  getDb()
    .prepare(
      `INSERT INTO sync_repo(
         space_uri, repo_did, pds_url, rev, lthash, commit_hash, updated_at
       ) VALUES (
         @spaceUri, @repoDid, @pdsUrl, @rev, @ltHash, @commitHash, @updatedAt
       )
       ON CONFLICT(space_uri, repo_did) DO UPDATE SET
         pds_url = excluded.pds_url,
         rev = excluded.rev,
         lthash = excluded.lthash,
         commit_hash = excluded.commit_hash,
         updated_at = excluded.updated_at`,
    )
    .run({
      ...input,
      ltHash: Buffer.from(input.ltHash),
      commitHash: Buffer.from(input.commitHash),
      updatedAt: new Date().toISOString(),
    });
}

export function replaceRepoRecords(input: {
  spaceUri: string;
  authorDid: string;
  posts: Array<{
    uri: string;
    cid: string;
    text: string;
    image?: NoteImage;
    color?: NoteColor;
    rotation?: number;
    x?: number;
    y?: number;
    createdAt: string;
  }>;
  labels: Array<{
    uri: string;
    cid: string;
    subjectUri: string;
    subjectCid?: string;
    val: string;
    neg: boolean;
    createdAt: string;
  }>;
  positions: Array<{
    uri: string;
    cid: string;
    subjectUri: string;
    subjectCid: string;
    x: number;
    y: number;
    createdAt: string;
  }>;
  blobs?: SpaceBlob[];
}): void {
  const db = getDb();
  const dereferenced = db.transaction(() => {
    db.prepare("DELETE FROM post WHERE space_uri = ? AND author_did = ?").run(
      input.spaceUri,
      input.authorDid,
    );
    db.prepare(
      "DELETE FROM moderation_label WHERE space_uri = ? AND author_did = ?",
    ).run(input.spaceUri, input.authorDid);
    db.prepare(
      "DELETE FROM note_position WHERE space_uri = ? AND author_did = ?",
    ).run(input.spaceUri, input.authorDid);

    const insertPost = db.prepare(`
      INSERT INTO post(
        uri, cid, space_uri, author_did, text,
        image_cid, image_mime, image_size, image_alt,
        color, rotation, x, y, created_at, indexed_at
      ) VALUES (
        @uri, @cid, @spaceUri, @authorDid, @text,
        @imageCid, @imageMime, @imageSize, @imageAlt, @color, @rotation,
        @x, @y, @createdAt, @indexedAt
      )
    `);
    for (const post of input.posts) {
      insertPost.run({
        ...post,
        spaceUri: input.spaceUri,
        authorDid: input.authorDid,
        x: post.x ?? null,
        y: post.y ?? null,
        color: post.color ?? null,
        rotation: post.rotation ?? null,
        imageCid: post.image?.cid ?? null,
        imageMime: post.image?.mimeType ?? null,
        imageSize: post.image?.size ?? null,
        imageAlt: post.image?.alt ?? null,
        indexedAt: new Date().toISOString(),
      });
    }

    const insertLabel = db.prepare(`
      INSERT INTO moderation_label(
        uri, cid, space_uri, author_did, subject_uri, subject_cid,
        val, neg, created_at, indexed_at
      ) VALUES (
        @uri, @cid, @spaceUri, @authorDid, @subjectUri, @subjectCid,
        @val, @neg, @createdAt, @indexedAt
      )
    `);
    for (const label of input.labels) {
      insertLabel.run({
        ...label,
        spaceUri: input.spaceUri,
        authorDid: input.authorDid,
        subjectCid: label.subjectCid ?? null,
        neg: label.neg ? 1 : 0,
        indexedAt: new Date().toISOString(),
      });
    }

    const insertPosition = db.prepare(`
      INSERT INTO note_position(
        uri, cid, space_uri, author_did, subject_uri, subject_cid,
        x, y, created_at, indexed_at
      ) VALUES (
        @uri, @cid, @spaceUri, @authorDid, @subjectUri, @subjectCid,
        @x, @y, @createdAt, @indexedAt
      )
    `);
    for (const position of input.positions) {
      insertPosition.run({
        ...position,
        spaceUri: input.spaceUri,
        authorDid: input.authorDid,
        indexedAt: new Date().toISOString(),
      });
    }

    for (const blob of input.blobs ?? []) insertSpaceBlob(db, blob);
    return pruneSpaceBlobs(db, input.spaceUri, input.authorDid);
  })();
  deleteUnreferencedBlobFiles(db, dereferenced);
}

export function upsertPost(input: {
  uri: string;
  cid: string;
  spaceUri: string;
  authorDid: string;
  text: string;
  image?: NoteImage;
  color?: NoteColor;
  rotation?: number;
  x?: number;
  y?: number;
  createdAt: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO post(
         uri, cid, space_uri, author_did, text,
         image_cid, image_mime, image_size, image_alt,
         color, rotation, x, y, created_at, indexed_at
       ) VALUES (
         @uri, @cid, @spaceUri, @authorDid, @text,
         @imageCid, @imageMime, @imageSize, @imageAlt, @color, @rotation,
         @x, @y, @createdAt, @indexedAt
       )
       ON CONFLICT(uri) DO UPDATE SET
         cid = excluded.cid,
         text = excluded.text,
         image_cid = excluded.image_cid,
         image_mime = excluded.image_mime,
         image_size = excluded.image_size,
         image_alt = excluded.image_alt,
         color = excluded.color,
         rotation = excluded.rotation,
         x = excluded.x,
         y = excluded.y,
         created_at = excluded.created_at,
         indexed_at = excluded.indexed_at`,
    )
    .run({
      ...input,
      x: input.x ?? null,
      y: input.y ?? null,
      color: input.color ?? null,
      rotation: input.rotation ?? null,
      imageCid: input.image?.cid ?? null,
      imageMime: input.image?.mimeType ?? null,
      imageSize: input.image?.size ?? null,
      imageAlt: input.image?.alt ?? null,
      indexedAt: new Date().toISOString(),
    });
}

export function getPost(uri: string): StoredPost | null {
  return (
    (getDb()
      .prepare(
        `SELECT uri, cid, space_uri AS spaceUri, author_did AS authorDid,
                text, image_cid AS imageCid, image_mime AS imageMime,
                image_size AS imageSize, image_alt AS imageAlt,
                color, rotation, x, y, created_at AS createdAt
         FROM post WHERE uri = ?`,
      )
      .get(uri) as StoredPost | undefined) ?? null
  );
}

export function deleteStoredPost(uri: string): void {
  const db = getDb();
  const dereferenced = db.transaction(() => {
    const row = db
      .prepare(
        "SELECT space_uri AS spaceUri, author_did AS authorDid FROM post WHERE uri = ?",
      )
      .get(uri) as { spaceUri: string; authorDid: string } | undefined;
    db.prepare("DELETE FROM post WHERE uri = ?").run(uri);
    return row ? pruneSpaceBlobs(db, row.spaceUri, row.authorDid) : [];
  })();
  deleteUnreferencedBlobFiles(db, dereferenced);
}

export function upsertPosition(input: {
  uri: string;
  cid: string;
  spaceUri: string;
  authorDid: string;
  subjectUri: string;
  subjectCid: string;
  x: number;
  y: number;
  createdAt: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO note_position(
         uri, cid, space_uri, author_did, subject_uri, subject_cid,
         x, y, created_at, indexed_at
       ) VALUES (
         @uri, @cid, @spaceUri, @authorDid, @subjectUri, @subjectCid,
         @x, @y, @createdAt, @indexedAt
       )
       ON CONFLICT(uri) DO UPDATE SET
         cid = excluded.cid,
         subject_cid = excluded.subject_cid,
         x = excluded.x,
         y = excluded.y,
         created_at = excluded.created_at,
         indexed_at = excluded.indexed_at`,
    )
    .run({ ...input, indexedAt: new Date().toISOString() });
}

export type SyncedChange =
  | {
      kind: "delete";
      table: "post" | "moderation_label" | "note_position";
      uri: string;
      spaceUri: string;
      authorDid: string;
    }
  | {
      kind: "post";
      value: {
        uri: string;
        cid: string;
        spaceUri: string;
        authorDid: string;
        text: string;
        image?: NoteImage;
        color?: NoteColor;
        rotation?: number;
        x?: number;
        y?: number;
        createdAt: string;
      };
    }
  | {
      kind: "label";
      value: {
        uri: string;
        cid: string;
        spaceUri: string;
        authorDid: string;
        subjectUri: string;
        subjectCid?: string;
        val: string;
        neg: boolean;
        createdAt: string;
      };
    }
  | {
      kind: "position";
      value: {
        uri: string;
        cid: string;
        spaceUri: string;
        authorDid: string;
        subjectUri: string;
        subjectCid: string;
        x: number;
        y: number;
        createdAt: string;
      };
    };

export function applySyncedChanges(
  changes: SyncedChange[],
  blobs: SpaceBlob[] = [],
): void {
  const db = getDb();
  const dereferenced = db.transaction(() => {
    for (const blob of blobs) insertSpaceBlob(db, blob);
    for (const change of changes) {
      if (change.kind === "delete") {
        db.prepare(`DELETE FROM ${change.table} WHERE uri = ?`).run(change.uri);
      } else if (change.kind === "post") {
        upsertPost(change.value);
      } else if (change.kind === "label") {
        upsertLabel(change.value);
      } else {
        upsertPosition(change.value);
      }
    }
    const affected = new Set<string>();
    for (const blob of blobs) affected.add(`${blob.spaceUri}\u0000${blob.repoDid}`);
    for (const change of changes) {
      if (change.kind === "post" || (change.kind === "delete" && change.table === "post")) {
        const value = change.kind === "post" ? change.value : change;
        affected.add(`${value.spaceUri}\u0000${value.authorDid}`);
      }
    }
    const cids: string[] = [];
    for (const key of affected) {
      const [spaceUri, authorDid] = key.split("\u0000");
      cids.push(...pruneSpaceBlobs(db, spaceUri, authorDid));
    }
    return cids;
  })();
  deleteUnreferencedBlobFiles(db, dereferenced);
}

export function upsertLabel(input: {
  uri: string;
  cid: string;
  spaceUri: string;
  authorDid: string;
  subjectUri: string;
  subjectCid?: string;
  val: string;
  neg: boolean;
  createdAt: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO moderation_label(
         uri, cid, space_uri, author_did, subject_uri, subject_cid,
         val, neg, created_at, indexed_at
       ) VALUES (
         @uri, @cid, @spaceUri, @authorDid, @subjectUri, @subjectCid,
         @val, @neg, @createdAt, @indexedAt
       )
       ON CONFLICT(uri) DO UPDATE SET
         cid = excluded.cid,
         neg = excluded.neg,
         indexed_at = excluded.indexed_at`,
    )
    .run({
      ...input,
      subjectCid: input.subjectCid ?? null,
      neg: input.neg ? 1 : 0,
      indexedAt: new Date().toISOString(),
    });
}

export function listBoardPosts(
  spaceUri: string,
  authorityDid: string,
): BoardPost[] {
  const rows = getDb()
    .prepare(
      `SELECT
         p.uri,
         p.cid,
         p.space_uri AS spaceUri,
         p.author_did AS authorDid,
         a.handle AS authorHandle,
         p.text,
         p.image_cid AS imageCid,
         p.image_mime AS imageMime,
         p.image_size AS imageSize,
         p.image_alt AS imageAlt,
         p.color,
         p.rotation,
         COALESCE(np.x, p.x) AS x,
         COALESCE(np.y, p.y) AS y,
         p.created_at AS createdAt,
         COALESCE((
           SELECT CASE WHEN l.neg = 0 THEN 1 ELSE 0 END
           FROM moderation_label l
           WHERE l.space_uri = p.space_uri
             AND l.author_did = ?
             AND l.subject_uri = p.uri
             AND l.val = 'hide'
           ORDER BY l.created_at DESC, l.uri DESC
           LIMIT 1
         ), 0) AS hidden
       FROM post p
       LEFT JOIN account a ON a.did = p.author_did
       LEFT JOIN note_position np ON np.uri = (
         SELECT position.uri
         FROM note_position position
         WHERE position.space_uri = p.space_uri
           AND position.author_did = ?
           AND position.subject_uri = p.uri
           AND position.subject_cid = p.cid
         ORDER BY position.created_at DESC, position.uri DESC
         LIMIT 1
       )
       WHERE p.space_uri = ?
       ORDER BY p.created_at DESC`,
    )
    .all(authorityDid, authorityDid, spaceUri) as Array<
      Omit<BoardPost, "hidden" | "color" | "rotation"> & {
        x: number | null;
        y: number | null;
        color: NoteColor | null;
        rotation: number | null;
        hidden: number;
      }
    >;

  return rows.map((row) => {
    const fallback = fallbackPosition(row.uri);
    const style = fallbackNoteStyle(row.uri);
    return {
      ...row,
      x: row.x ?? fallback.x,
      y: row.y ?? fallback.y,
      color: row.color ?? style.color,
      rotation: row.rotation ?? style.rotation,
      hidden: row.hidden === 1,
    };
  });
}

export function getSpaceBlob(
  spaceUri: string,
  repoDid: string,
  cid: string,
): SpaceBlob | null {
  const row = getDb()
    .prepare(
      `SELECT space_uri AS spaceUri, repo_did AS repoDid, cid,
              mime_type AS mimeType, size
       FROM space_blob
       WHERE space_uri = ? AND repo_did = ? AND cid = ?`,
    )
    .get(spaceUri, repoDid, cid) as SpaceBlob | undefined;
  return row ?? null;
}

export function getReferencedSpaceBlob(
  spaceUri: string,
  repoDid: string,
  cid: string,
): SpaceBlob | null {
  const blob = getSpaceBlob(spaceUri, repoDid, cid);
  if (!blob) return null;
  const referenced = getDb()
    .prepare(
      `SELECT 1 FROM post
       WHERE space_uri = ? AND author_did = ? AND image_cid = ?
       LIMIT 1`,
    )
    .get(spaceUri, repoDid, cid);
  return referenced ? blob : null;
}

function insertSpaceBlob(db: ReturnType<typeof getDb>, blob: SpaceBlob): void {
  db.prepare(
    `INSERT INTO space_blob(
       space_uri, repo_did, cid, mime_type, size, updated_at
     ) VALUES (
       @spaceUri, @repoDid, @cid, @mimeType, @size, @updatedAt
     )
     ON CONFLICT(space_uri, repo_did, cid) DO UPDATE SET
       mime_type = excluded.mime_type,
       size = excluded.size,
       updated_at = excluded.updated_at`,
  ).run({
    ...blob,
    updatedAt: new Date().toISOString(),
  });
}

function pruneSpaceBlobs(
  db: ReturnType<typeof getDb>,
  spaceUri: string,
  repoDid: string,
): string[] {
  const cids = db
    .prepare(
      `SELECT cid FROM space_blob
       WHERE space_uri = ? AND repo_did = ?
         AND NOT EXISTS (
           SELECT 1 FROM post
           WHERE post.space_uri = space_blob.space_uri
             AND post.author_did = space_blob.repo_did
             AND post.image_cid = space_blob.cid
         )`,
    )
    .all(spaceUri, repoDid)
    .map((row) => (row as { cid: string }).cid);
  db.prepare(
    `DELETE FROM space_blob
     WHERE space_uri = ? AND repo_did = ?
       AND NOT EXISTS (
         SELECT 1 FROM post
         WHERE post.space_uri = space_blob.space_uri
           AND post.author_did = space_blob.repo_did
           AND post.image_cid = space_blob.cid
       )`,
  ).run(spaceUri, repoDid);
  return cids;
}

function deleteUnreferencedBlobFiles(
  db: ReturnType<typeof getDb>,
  cids: string[],
): void {
  const hasReference = db.prepare("SELECT 1 FROM space_blob WHERE cid = ? LIMIT 1");
  for (const cid of new Set(cids)) {
    if (hasReference.get(cid)) continue;
    try {
      deleteBlobFile(cid);
    } catch (error) {
      console.error(`Could not delete dereferenced image ${cid}`, error);
    }
  }
}

function fallbackPosition(uri: string): { x: number; y: number } {
  let hash = 2166136261;
  for (const char of uri) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  const value = hash >>> 0;
  return {
    x: 40 + (value % 720),
    y: 35 + (Math.floor(value / 997) % 780),
  };
}
