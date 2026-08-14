import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
const expected = dockerfile.match(/^ARG ATPROTO_COMMIT=([0-9a-f]{40})$/m)?.[1];

if (!expected) {
  throw new Error("Dockerfile must pin a full ATPROTO_COMMIT");
}

const atprotoDir = new URL("../../atproto", import.meta.url);
const actual = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: atprotoDir,
  encoding: "utf8",
}).trim();

if (actual !== expected) {
  throw new Error(
    `atproto checkout is ${actual}; codegen requires Docker's pinned ${expected}`,
  );
}

const relevantChanges = execFileSync(
  "git",
  ["status", "--porcelain", "--", "lexicons", "packages/lex/lex-schema"],
  { cwd: atprotoDir, encoding: "utf8" },
).trim();

if (relevantChanges) {
  throw new Error("atproto lexicons or lex-schema have uncommitted changes");
}
