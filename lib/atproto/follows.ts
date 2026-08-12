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

export async function userFollows(
  userDid: string,
  ownerDid: string,
): Promise<boolean> {
  return (await getRelationship(userDid, ownerDid)).follows;
}
