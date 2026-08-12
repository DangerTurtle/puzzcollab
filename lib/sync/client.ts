import { SYNC_URL } from "../config";

export async function watchBoard(space: string): Promise<void> {
  const response = await fetch(`${SYNC_URL}/watch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ space }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Board sync failed (${response.status})`);
}
