import assert from "node:assert/strict";
import test from "node:test";
import {
  loadRuntimeProfile,
  parseProfileName,
} from "./runtime-profile";

test("local, dev, and production profiles have distinct runtime behavior", async () => {
  const local = await loadRuntimeProfile("local", process.cwd(), {});
  const dev = await loadRuntimeProfile("dev", process.cwd(), {});
  const production = await loadRuntimeProfile("production", process.cwd(), {});

  assert.equal(local.development, true);
  assert.equal(local.publishLexicons, true);
  assert.equal(local.config.databasePath, "bulletin.db");

  assert.equal(dev.development, true);
  assert.equal(dev.publishLexicons, false);
  assert.equal(dev.config.databasePath, "bulletin-dev.db");
  assert.equal(dev.config.syncPollInterval, 10000);
  assert.equal(
    dev.config.managingAppService,
    "did:web:bulletin.dholms.at#bulletin",
  );

  assert.equal(production.development, false);
  assert.equal(production.publishLexicons, false);
  assert.equal(production.config.databasePath, "/data/bulletin.db");
  assert.equal(production.environment.NODE_ENV, "production");
});

test("runtime overrides win without changing profile-controlled NODE_ENV", async () => {
  const profile = await loadRuntimeProfile("production", process.cwd(), {
    DATABASE_PATH: "/tmp/bulletin.db",
    BULLETIN_PORT: "4100",
    NODE_ENV: "development",
  });

  assert.equal(profile.config.databasePath, "/tmp/bulletin.db");
  assert.equal(profile.config.port, 4100);
  assert.equal(profile.environment.NODE_ENV, "production");
});

test("profile arguments accept both supported flag forms", () => {
  assert.equal(parseProfileName(["--profile", "local"]), "local");
  assert.equal(parseProfileName(["--profile=dev"]), "dev");
  assert.throws(() => parseProfileName(["--profile", "staging"]));
});

test("runtime validation rejects invalid ports and poll intervals", async () => {
  await assert.rejects(() =>
    loadRuntimeProfile("dev", process.cwd(), { BULLETIN_PORT: "70000" }),
  );
  await assert.rejects(() =>
    loadRuntimeProfile("dev", process.cwd(), {
      SYNC_POLL_INTERVAL_MS: "999",
    }),
  );
  assert.equal(
    (
      await loadRuntimeProfile("dev", process.cwd(), {
        SYNC_POLL_INTERVAL_MS: "300000",
      })
    ).config.syncPollInterval,
    300000,
  );
});
