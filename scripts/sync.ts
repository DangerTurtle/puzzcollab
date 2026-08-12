import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  SYNC_PUBLIC_URL,
  SYNC_SERVICE,
  SYNC_SERVICE_DID,
  SYNC_URL,
} from "../lib/config";
import { migrate } from "../lib/db/migrations";
import { SyncEngine } from "../lib/sync/engine";
import {
  verifySpaceDeletionNotification,
  verifySyncNotification,
} from "../lib/sync/service-auth";

const clients = new Map<string, Set<ServerResponse>>();
const engine = new SyncEngine((space) => broadcast(space));

migrate();

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", SYNC_URL);
    if (request.method === "GET" && url.pathname === "/health") {
      return json(response, 200, { ok: true });
    }
    if (request.method === "GET" && url.pathname === "/.well-known/did.json") {
      return json(response, 200, {
        "@context": ["https://www.w3.org/ns/did/v1"],
        id: SYNC_SERVICE_DID,
        service: [
          {
            id: SYNC_SERVICE,
            type: "AtprotoSpaceSyncService",
            serviceEndpoint: SYNC_PUBLIC_URL,
          },
        ],
      });
    }
    if (request.method === "GET" && url.pathname === "/events") {
      const space = url.searchParams.get("space");
      if (!space) return json(response, 400, { error: "Missing board" });
      response.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      });
      response.write(": connected\n\n");
      const group = clients.get(space) ?? new Set<ServerResponse>();
      group.add(response);
      clients.set(space, group);
      request.on("close", () => {
        group.delete(response);
        if (group.size === 0) clients.delete(space);
      });
      return;
    }
    if (request.method === "POST" && url.pathname === "/watch") {
      const body = await readJson(request);
      if (typeof body.space !== "string") {
        return json(response, 400, { error: "Invalid board subscription" });
      }
      await engine.watch(body.space);
      return json(response, 200, { ok: true });
    }
    if (
      request.method === "POST" &&
      url.pathname === "/xrpc/com.atproto.space.notifyWrite"
    ) {
      const body = await readJson(request);
      if (
        typeof body.space !== "string" ||
        typeof body.repo !== "string" ||
        typeof body.rev !== "string"
      ) {
        return json(response, 400, { error: "Invalid notification" });
      }
      const authorization = Array.isArray(request.headers.authorization)
        ? request.headers.authorization[0]
        : request.headers.authorization;
      await verifySyncNotification(authorization, body.space);
      json(response, 200, {});
      void engine.notify({
        space: body.space,
        repo: body.repo,
        rev: body.rev,
      }).catch((error) => console.error("notification sync failed", error));
      return;
    }
    if (
      request.method === "POST" &&
      url.pathname === "/xrpc/com.atproto.space.notifySpaceDeleted"
    ) {
      const body = await readJson(request);
      if (typeof body.space !== "string") {
        return json(response, 400, { error: "Invalid notification" });
      }
      const authorization = Array.isArray(request.headers.authorization)
        ? request.headers.authorization[0]
        : request.headers.authorization;
      await verifySpaceDeletionNotification(authorization, body.space);
      engine.deleteSpace(body.space);
      return json(response, 200, {});
    }
    return json(response, 404, { error: "Not found" });
  } catch (error) {
    console.error("sync service request failed", error);
    return json(response, 500, { error: "Sync failed" });
  }
});

const syncUrl = new URL(SYNC_URL);
const port = Number(syncUrl.port || 3001);
server.listen(port, "0.0.0.0", () => {
  console.log(`Bulletin sync service ${SYNC_URL}`);
  void engine.resume();
});

const heartbeatTimer = setInterval(() => {
  for (const group of clients.values()) {
    for (const client of group) client.write(": keepalive\n\n");
  }
}, 20_000);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    engine.stop();
    clearInterval(heartbeatTimer);
    server.close(() => process.exit(0));
  });
}

function broadcast(space: string): void {
  const payload = `data: ${JSON.stringify({ space })}\n\n`;
  for (const client of clients.get(space) ?? []) client.write(payload);
}

async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > 64 * 1024) throw new Error("Request body too large");
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}
