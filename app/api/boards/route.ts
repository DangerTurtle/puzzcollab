import { createBoard } from "@/lib/atproto/actions";
import { requireSession } from "@/lib/auth/session";
import { getBulletinCapabilities } from "@/lib/auth/bulletin-capabilities";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const session = await requireSession();
    const capabilities = await getBulletinCapabilities(session, session.did);
    if (!capabilities.canCreateBoard) {
      return NextResponse.json(
        { error: "Your PDS does not support permissioned data yet" },
        { status: 403 },
      );
    }
    return NextResponse.json({ space: await createBoard(session) });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not create your board right now" },
      { status: 400 },
    );
  }
}
