import { Agent } from "@atproto/api";
import { BSKY_URL } from "../config";

let agent: Agent | undefined;

export function getBskyAgent(): Agent {
  agent ??= new Agent({
    service: BSKY_URL,
    fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
  });
  return agent;
}
