import { resolvePds } from "./identity";

type FollowRecord = {
  value?: {
    $type?: string;
    subject?: string;
  };
};

export async function userFollows(
  userDid: string,
  ownerDid: string,
): Promise<boolean> {
  if (userDid === ownerDid) return true;
  const pds = await resolvePds(userDid);
  let cursor: string | undefined;

  do {
    const url = new URL(`${pds}/xrpc/com.atproto.repo.listRecords`);
    url.searchParams.set("repo", userDid);
    url.searchParams.set("collection", "app.bsky.graph.follow");
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(url);
    if (!response.ok) return false;
    const body = (await response.json()) as {
      records: FollowRecord[];
      cursor?: string;
    };
    if (body.records.some((record) => record.value?.subject === ownerDid)) {
      return true;
    }
    cursor = body.cursor;
  } while (cursor);

  return false;
}
