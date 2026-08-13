import {
  NodeOAuthClient,
  type AtprotoDid,
  type NodeSavedSession,
  type NodeSavedState,
} from "@atproto/oauth-client-node";
import { sql } from "kysely";
import { isIP } from "node:net";
import { APP_UI_URL, PLC_URL } from "../config";
import { resolveHandle } from "../atproto/identity";
import { getQueryDb } from "../db";
import { getClientMetadata } from "./metadata";

let oauthClient: NodeOAuthClient | undefined;

export async function getOAuthClient(): Promise<NodeOAuthClient> {
  if (oauthClient) return oauthClient;

  oauthClient = new NodeOAuthClient({
    clientMetadata: getClientMetadata(),
    allowHttp: isLoopbackApp(),
    plcDirectoryUrl: PLC_URL,
    handleResolver: {
      async resolve(handle) {
        return (await resolveHandle(handle)) as AtprotoDid | null;
      },
    },
    stateStore: sqliteStore<NodeSavedState>("authState"),
    sessionStore: sqliteStore<NodeSavedSession>("authSession"),
  });

  return oauthClient;
}

function isLoopbackApp(): boolean {
  const hostname = new URL(APP_UI_URL).hostname;
  const unwrapped = hostname.replace(/^\[|\]$/g, "");
  return (
    hostname === "localhost" ||
    unwrapped === "::1" ||
    (isIP(unwrapped) === 4 && unwrapped.startsWith("127."))
  );
}

export async function listStoredSessionDids(): Promise<string[]> {
  const rows = await getQueryDb()
    .selectFrom("authSession")
    .select("key")
    .orderBy(sql`rowid`)
    .execute();
  return rows.map(({ key }) => key);
}

function sqliteStore<T>(table: "authState" | "authSession") {
  return {
    async get(key: string): Promise<T | undefined> {
      const result = await sql<{ value: string }>`
        SELECT value FROM ${sql.table(table)} WHERE key = ${key}
      `.execute(getQueryDb());
      const row = result.rows[0];
      return row ? (JSON.parse(row.value) as T) : undefined;
    },
    async set(key: string, value: T): Promise<void> {
      await sql`
        INSERT INTO ${sql.table(table)} (key, value)
        VALUES (${key}, ${JSON.stringify(value)})
        ON CONFLICT (key) DO UPDATE SET value = excluded.value
      `.execute(getQueryDb());
    },
    async del(key: string): Promise<void> {
      await sql`
        DELETE FROM ${sql.table(table)} WHERE key = ${key}
      `.execute(getQueryDb());
    },
  };
}
