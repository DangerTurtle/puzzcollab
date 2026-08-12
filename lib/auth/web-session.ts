import { createHash, randomBytes } from "node:crypto";
import { APP_UI_URL } from "../config";
import { getDb } from "../db";

export const WEB_SESSION_COOKIE_NAME = "bulletin-session";
export const LEGACY_SESSION_COOKIE_NAME = "bulletin-did";
export const WEB_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createWebSession(did: string): string {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + WEB_SESSION_MAX_AGE_SECONDS * 1000,
  );
  const db = getDb();

  db.transaction(() => {
    db.prepare("DELETE FROM web_session WHERE expires_at <= ?").run(
      now.toISOString(),
    );
    db.prepare(
      `INSERT INTO web_session(token_hash, did, created_at, expires_at)
       VALUES (?, ?, ?, ?)`,
    ).run(
      hashToken(token),
      did,
      now.toISOString(),
      expiresAt.toISOString(),
    );
  })();

  return token;
}

export function resolveWebSession(token: string): string | null {
  if (!validToken(token)) return null;
  const row = getDb()
    .prepare(
      `SELECT did FROM web_session
       WHERE token_hash = ? AND expires_at > ?`,
    )
    .get(hashToken(token), new Date().toISOString()) as
    | { did: string }
    | undefined;
  return row?.did ?? null;
}

export function deleteWebSession(token: string): string | null {
  if (!validToken(token)) return null;
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();
  const db = getDb();
  return db.transaction(() => {
    const row = db
      .prepare(
        `SELECT did FROM web_session
         WHERE token_hash = ? AND expires_at > ?`,
      )
      .get(tokenHash, now) as { did: string } | undefined;
    db.prepare("DELETE FROM web_session WHERE token_hash = ?").run(tokenHash);
    return row?.did ?? null;
  })();
}

export function deleteWebSessionsForDid(did: string): void {
  getDb().prepare("DELETE FROM web_session WHERE did = ?").run(did);
}

export function webSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: new URL(APP_UI_URL).protocol === "https:",
    path: "/",
    maxAge: WEB_SESSION_MAX_AGE_SECONDS,
  };
}

function validToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("base64url");
}
