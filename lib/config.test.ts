import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseEnv } from "node:util";
import { readConfig } from "./config";

async function readEnv(
  name: string,
): Promise<Record<string, string | undefined>> {
  return {
    ...parseEnv(await readFile("env/common.env", "utf8")),
    ...parseEnv(await readFile(`env/${name}.env`, "utf8")),
  };
}

test("local, dev, and production envs configure distinct behavior", async () => {
  const local = readConfig(await readEnv("local"));
  const dev = readConfig(await readEnv("dev"));
  const production = readConfig(await readEnv("production"));

  assert.equal(local.development, true);
  assert.equal(local.publishLexicons, true);
  assert.equal(local.databasePath, "bulletin.db");

  assert.equal(dev.development, true);
  assert.equal(dev.publishLexicons, false);
  assert.equal(dev.databasePath, "bulletin-dev.db");
  assert.equal(dev.syncPollInterval, 10000);
  assert.equal(dev.managingAppService, "did:web:bulletin.my#bulletin");

  assert.equal(production.development, false);
  assert.equal(production.publishLexicons, false);
  assert.equal(production.databasePath, "/data/bulletin.db");
});

test("config validation rejects invalid values", async () => {
  const dev = await readEnv("dev");

  assert.throws(() => readConfig({ ...dev, BULLETIN_PORT: "70000" }));
  assert.throws(() =>
    readConfig({ ...dev, SYNC_POLL_INTERVAL_MS: "999" }),
  );
  assert.throws(() => readConfig({ ...dev, PUBLISH_LEXICONS: "yes" }));
  assert.equal(
    readConfig({ ...dev, SYNC_POLL_INTERVAL_MS: "300000" })
      .syncPollInterval,
    300000,
  );
});
