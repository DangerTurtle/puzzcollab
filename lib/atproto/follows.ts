import { AppBskyGraphDefs } from "@atproto/api";
import { getBskyAgent } from "./bsky";

export type Relationship = {
  follows: boolean;
  followedBy: boolean;
};

export async function getRelationship(
  actorDid: string,
  otherDid: string,
): Promise<Relationship> {
  if (actorDid === otherDid) return { follows: true, followedBy: true };

  const response = await getBskyAgent().app.bsky.graph.getRelationships(
    { actor: actorDid, others: [otherDid] },
    { signal: AbortSignal.timeout(2500) },
  );
  const relationship = response.data.relationships.find(
    AppBskyGraphDefs.isRelationship,
  );

  return {
    follows: relationship?.did === otherDid && Boolean(relationship.following),
    followedBy:
      relationship?.did === otherDid && Boolean(relationship.followedBy),
  };
}

export async function getFollowersAmong(
  actorDid: string,
  otherDids: string[],
): Promise<Set<string>> {
  const followers = new Set<string>();
  const uniqueOthers = [...new Set(otherDids)].filter(
    (did) => did !== actorDid,
  );

  for (let offset = 0; offset < uniqueOthers.length; offset += 30) {
    const others = uniqueOthers.slice(offset, offset + 30);
    const response = await getBskyAgent().app.bsky.graph.getRelationships(
      { actor: actorDid, others },
      { signal: AbortSignal.timeout(2500) },
    );
    for (const relationship of response.data.relationships) {
      if (
        AppBskyGraphDefs.isRelationship(relationship) &&
        relationship.followedBy
      ) {
        followers.add(relationship.did);
      }
    }
  }

  return followers;
}

export async function userFollows(
  userDid: string,
  ownerDid: string,
): Promise<boolean> {
  return (await getRelationship(userDid, ownerDid)).follows;
}
