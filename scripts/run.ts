import { getConfig } from "../lib/config";
import { BulletinApplication } from "./application";

const application = new BulletinApplication(getConfig());
let stopping = false;

async function stop(exitCode = 0): Promise<void> {
  if (stopping) return;
  stopping = true;
  try {
    await application.close();
  } catch (error) {
    console.error("Bulletin shutdown failed", error);
    exitCode = 1;
  }
  process.exitCode = exitCode;
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => void stop());
}

try {
  await application.start();
} catch (error) {
  console.error("Bulletin failed to start", error);
  await stop(1);
}
