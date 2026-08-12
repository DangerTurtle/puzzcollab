import {
  NodeOAuthClient,
  type AtprotoDid,
  type NodeSavedSession,
  type NodeSavedState,
} from "@atproto/oauth-client-node";
import { PLC_URL } from "../config";
import { resolveHandle } from "../atproto/identity";
import { getDb } from "../db";
import { getClientMetadata } from "./metadata";

let oauthClient: NodeOAuthClient | undefined;

export async function getOAuthClient(): Promise<NodeOAuthClient> {
  if (oauthClient) return oauthClient;

  oauthClient = new NodeOAuthClient({
    clientMetadata: getClientMetadata(),
    allowHttp: true,
    plcDirectoryUrl: PLC_URL,
    handleResolver: {
      async resolve(handle) {
        return (await resolveHandle(handle)) as AtprotoDid | null;
      },
    },
    stateStore: sqliteStore<NodeSavedState>("auth_state"),
    sessionStore: sqliteStore<NodeSavedSession>("auth_session"),
  });

  return oauthClient;
}

export function listStoredSessionDids(): string[] {
  return getDb()
    .prepare("SELECT key FROM auth_session ORDER BY rowid")
    .all()
    .map((row) => (row as { key: string }).key);
}

function sqliteStore<T>(table: "auth_state" | "auth_session") {
  return {
    async get(key: string): Promise<T | undefined> {
      const row = getDb()
        .prepare(`SELECT value FROM ${table} WHERE key = ?`)
        .get(key) as { value: string } | undefined;
      return row ? (JSON.parse(row.value) as T) : undefined;
    },
    async set(key: string, value: T): Promise<void> {
      getDb()
        .prepare(
          `INSERT INTO ${table}(key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        )
        .run(key, JSON.stringify(value));
    },
    async del(key: string): Promise<void> {
      getDb().prepare(`DELETE FROM ${table} WHERE key = ?`).run(key);
    },
  };
}
