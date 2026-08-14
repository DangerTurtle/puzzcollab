import { Client } from "@atproto/lex-client";
import { BSKY_URL } from "../config";

let client: Client | undefined;

export function getBskyClient(): Client {
  client ??= new Client({
    service: BSKY_URL,
    fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
  });
  return client;
}
