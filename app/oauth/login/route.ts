import { getOAuthClient } from "@/lib/auth/client";
import { OAUTH_SCOPE } from "@/lib/config";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { handle?: unknown };
    if (typeof body.handle !== "string" || !body.handle.trim()) {
      return NextResponse.json({ error: "Enter a handle" }, { status: 400 });
    }
    const url = await (await getOAuthClient()).authorize(
      body.handle.trim().replace(/^@/, ""),
      { scope: OAUTH_SCOPE },
    );
    return NextResponse.json({ redirectUrl: url.toString() });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "We couldn’t sign you in. Check the handle and try again." },
      { status: 500 },
    );
  }
}
