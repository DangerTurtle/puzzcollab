import { getBskyClient } from "@/lib/atproto/bsky";
import { app } from "@/lib/lexicons";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim().replace(/^@+/, "");
  if (!query || query.length < 2) {
    return NextResponse.json({ actors: [] });
  }
  if (query.length > 253) {
    return NextResponse.json({ error: "Handle search is too long" }, { status: 400 });
  }

  try {
    const response = await getBskyClient().call(
      app.bsky.actor.searchActorsTypeahead,
      { q: query, limit: 6 },
      { signal: AbortSignal.timeout(2500) },
    );
    return NextResponse.json({
      actors: response.actors.map((actor) => ({
        did: actor.did,
        handle: actor.handle,
        displayName: actor.displayName ?? null,
      })),
    });
  } catch (error) {
    console.error("Could not search Atmosphere handles", error);
    return NextResponse.json({ error: "Handle search unavailable" }, { status: 502 });
  }
}
