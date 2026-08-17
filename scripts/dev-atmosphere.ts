import { spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";

const envPath = new URL("../.env.atmosphere", import.meta.url);
Object.assign(process.env, parseEnv(await readFile(envPath, "utf8")));

let child: ChildProcess | undefined;

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => child?.kill(signal));
}

const migrationCode = await run([
  "--import",
  "tsx",
  "scripts/migrate.ts",
]);
if (migrationCode !== 0) process.exit(migrationCode);

process.exitCode = await run([
  "--import",
  "tsx",
  "scripts/start-all.ts",
  "--dev",
]);

function run(args: string[]): Promise<number> {
  child = spawn(process.execPath, args, {
    stdio: "inherit",
    env: process.env,
  });
  return new Promise((resolve, reject) => {
    child!.once("error", reject);
    child!.once("exit", (code, signal) => {
      child = undefined;
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}
