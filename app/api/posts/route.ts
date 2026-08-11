import { createPost, deleteOwnPost } from "@/lib/atproto/actions";
import { requireSession } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";
import { isNoteColor, isNoteRotation } from "@/lib/note-style";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      ownerDid?: string;
      text?: string;
      color?: unknown;
      rotation?: unknown;
      x?: unknown;
      y?: unknown;
    };
    const text = body.text?.trim();
    if (
      !body.ownerDid?.startsWith("did:") ||
      !text ||
      Array.from(text).length > 300 ||
      !isNoteColor(body.color) ||
      !isNoteRotation(body.rotation) ||
      !validCoordinate(body.x) ||
      !validCoordinate(body.y)
    ) {
      return NextResponse.json(
        { error: "Enter a note up to 300 characters" },
        { status: 400 },
      );
    }
    const uri = await createPost(await requireSession(), body.ownerDid, text, {
      color: body.color,
      rotation: body.rotation,
      x: body.x,
      y: body.y,
    });
    return NextResponse.json({ uri });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not pin your note right now" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      ownerDid?: string;
      postUri?: string;
      postCid?: string;
    };
    if (!body.ownerDid?.startsWith("did:") || !body.postUri || !body.postCid) {
      throw new Error("Invalid note target");
    }
    await deleteOwnPost(await requireSession(), {
      ownerDid: body.ownerDid,
      postUri: body.postUri,
      postCid: body.postCid,
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not delete your note right now" },
      { status: 400 },
    );
  }
}

function validCoordinate(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 1000;
}
