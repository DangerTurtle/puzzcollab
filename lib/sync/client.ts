import { getConfig } from "../config";

export async function discoverBoard(space: string): Promise<boolean> {
  const response = await fetch(`${getConfig().syncInternalUrl}/watch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ space }),
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 404) {
    const body: unknown = await response.json().catch(() => undefined);
    if (
      body &&
      typeof body === "object" &&
      "error" in body &&
      body.error === "Board not found"
    ) {
      return false;
    }
  }
  if (!response.ok) throw new Error(`Board sync failed (${response.status})`);
  return true;
}
