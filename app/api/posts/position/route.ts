import { movePost } from "@/lib/atproto/actions";
import { requireSession } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      ownerDid?: string;
      postUri?: string;
      postCid?: string;
      x?: number;
      y?: number;
    };
    if (
      !body.ownerDid?.startsWith("did:") ||
      !body.postUri ||
      !body.postCid ||
      !validCoordinate(body.x) ||
      !validCoordinate(body.y)
    ) {
      throw new Error("Invalid note position");
    }
    const postCid = await movePost(await requireSession(), {
      ownerDid: body.ownerDid,
      postUri: body.postUri,
      postCid: body.postCid,
      x: body.x,
      y: body.y,
    });
    return NextResponse.json({ postCid });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not move that note right now" },
      { status: 400 },
    );
  }
}

function validCoordinate(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 1000;
}
