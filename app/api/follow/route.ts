import { followOwner } from "@/lib/atproto/actions";
import { requireSession } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { ownerDid } = (await request.json()) as { ownerDid?: string };
    if (!ownerDid?.startsWith("did:")) throw new Error("Invalid board owner");
    await followOwner(await requireSession(), ownerDid);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not follow this person right now" },
      { status: 400 },
    );
  }
}
