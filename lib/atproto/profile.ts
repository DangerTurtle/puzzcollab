import { getBskyAgent } from "./bsky";

export type Profile = {
  handle: string;
  avatar: string | null;
};

export async function getProfile(did: string): Promise<Profile | null> {
  try {
    const response = await getBskyAgent().app.bsky.actor.getProfile(
      { actor: did },
      { signal: AbortSignal.timeout(2500) },
    );
    return {
      handle: response.data.handle,
      avatar: response.data.avatar ?? null,
    };
  } catch {
    // A missing or unreachable profile should never stop a board from rendering.
    return null;
  }
}
