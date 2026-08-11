import { resolvePds } from "./identity";

const avatarCache = new Map<
  string,
  { value: string | null; expiresAt: number }
>();

export async function getProfileAvatarUrl(did: string): Promise<string | null> {
  const cached = avatarCache.get(did);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  let value: string | null = null;
  try {
    const pds = await resolvePds(did);
    const recordUrl = new URL(`${pds}/xrpc/com.atproto.repo.getRecord`);
    recordUrl.searchParams.set("repo", did);
    recordUrl.searchParams.set("collection", "app.bsky.actor.profile");
    recordUrl.searchParams.set("rkey", "self");
    const response = await fetch(recordUrl, { signal: AbortSignal.timeout(2500) });
    if (response.ok) {
      const body = (await response.json()) as { value?: { avatar?: unknown } };
      const cid = blobCid(body.value?.avatar);
      if (cid) {
        const blobUrl = new URL(`${pds}/xrpc/com.atproto.sync.getBlob`);
        blobUrl.searchParams.set("did", did);
        blobUrl.searchParams.set("cid", cid);
        value = blobUrl.toString();
      }
    }
  } catch {
    // A missing or unreachable profile should never stop a board from rendering.
  }

  avatarCache.set(did, { value, expiresAt: Date.now() + 5 * 60 * 1000 });
  return value;
}

function blobCid(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const ref = (value as { ref?: unknown }).ref;
  if (typeof ref === "string") return ref;
  if (ref && typeof ref === "object") {
    const link = (ref as { $link?: unknown }).$link;
    if (typeof link === "string") return link;
  }
  return undefined;
}
