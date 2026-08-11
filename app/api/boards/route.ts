import { createBoard } from "@/lib/atproto/actions";
import { requireSession } from "@/lib/auth/session";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await requireSession();
    return NextResponse.json({ space: await createBoard(session) });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not create your board right now" },
      { status: 400 },
    );
  }
}
