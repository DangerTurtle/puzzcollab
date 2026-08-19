import { forwardToSync } from "@/lib/sync/forward";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request): Promise<Response> {
  return forwardToSync(request, "/health");
}
