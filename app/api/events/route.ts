import { getSession } from "@/lib/auth/session";
import { boardUri, SYNC_URL } from "@/lib/config";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await getSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ownerDid = request.nextUrl.searchParams.get("ownerDid");
  if (!ownerDid?.startsWith("did:")) {
    return NextResponse.json({ error: "Invalid board" }, { status: 400 });
  }
  const upstream = await fetch(
    `${SYNC_URL}/events?space=${encodeURIComponent(boardUri(ownerDid))}`,
    { cache: "no-store", signal: request.signal },
  );
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Live updates unavailable" }, { status: 502 });
  }
  return new Response(upstream.body, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}
