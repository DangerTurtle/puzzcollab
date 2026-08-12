import assert from "node:assert/strict";
import test from "node:test";

process.env.DATABASE_PATH = ":memory:";

const { migrate } = await import("../db/migrations");
const { getDb } = await import("../db/index");
const {
  createWebSession,
  deleteWebSession,
  resolveWebSession,
  WEB_SESSION_MAX_AGE_SECONDS,
} = await import("./web-session");

migrate();

test("an opaque session token resolves to its DID", () => {
  const did = "did:plc:alice";
  const token = createWebSession(did);

  assert.equal(token.length, 43);
  assert.equal(resolveWebSession(token), did);
  assert.equal(resolveWebSession(did), null);

  const stored = getDb()
    .prepare("SELECT token_hash AS tokenHash FROM web_session WHERE did = ?")
    .get(did) as { tokenHash: string };
  assert.notEqual(stored.tokenHash, token);
});

test("expired sessions are rejected", () => {
  const token = createWebSession("did:plc:expired");
  getDb()
    .prepare("UPDATE web_session SET expires_at = ? WHERE did = ?")
    .run(new Date(0).toISOString(), "did:plc:expired");

  assert.equal(resolveWebSession(token), null);
  assert.equal(deleteWebSession(token), null);
});

test("deleting a session returns its DID and prevents reuse", () => {
  const did = "did:plc:bob";
  const token = createWebSession(did);

  assert.equal(deleteWebSession(token), did);
  assert.equal(deleteWebSession(token), null);
  assert.equal(resolveWebSession(token), null);
});

test("session lifetime remains seven days", () => {
  assert.equal(WEB_SESSION_MAX_AGE_SECONDS, 60 * 60 * 24 * 7);
});
