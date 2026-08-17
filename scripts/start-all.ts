import { spawn, type ChildProcess } from "node:child_process";

const children: ChildProcess[] = [];
let stopping = false;
const development = process.argv.includes("--dev");

children.push(
  spawn(process.execPath, ["--import", "tsx", "scripts/sync.ts"], {
    stdio: "inherit",
    env: process.env,
  }),
  spawn(
    "pnpm",
    [
      "exec",
      "next",
      development ? "dev" : "start",
      ...(development ? ["--webpack"] : []),
      "--hostname",
      development ? "127.0.0.1" : "0.0.0.0",
    ],
    {
      stdio: "inherit",
      env: process.env,
    },
  ),
);

function stop(signal: NodeJS.Signals = "SIGTERM") {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill(signal);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => stop(signal));
}

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (!stopping) {
      console.error(`A Bulletin process stopped (${signal ?? code ?? "unknown"})`);
      process.exitCode = code || 1;
      stop();
    }
    if (
      children.every(
        (candidate) => candidate.exitCode !== null || candidate.signalCode !== null,
      )
    ) {
      process.exit();
    }
  });
}
