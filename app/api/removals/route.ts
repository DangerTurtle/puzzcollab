import { removePostFromBoard } from "@/lib/atproto/actions";
import { requireSession } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      ownerDid?: string;
      postUri?: string;
      postCid?: string;
    };
    if (!body.ownerDid || !body.postUri || !body.postCid) {
      throw new Error("Invalid removal target");
    }
    const uri = await removePostFromBoard(await requireSession(), {
      ownerDid: body.ownerDid,
      postUri: body.postUri,
      postCid: body.postCid,
    });
    return NextResponse.json({ uri });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not remove this note right now" },
      { status: 400 },
    );
  }
}
