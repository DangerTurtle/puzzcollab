import { labelPost } from "@/lib/atproto/actions";
import { requireSession } from "@/lib/auth/session";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      ownerDid?: string;
      postUri?: string;
      postCid?: string;
      hidden?: boolean;
    };
    if (!body.ownerDid || !body.postUri || !body.postCid) {
      throw new Error("Invalid label target");
    }
    const uri = await labelPost(await requireSession(), {
      ownerDid: body.ownerDid,
      postUri: body.postUri,
      postCid: body.postCid,
      hidden: body.hidden === true,
    });
    return NextResponse.json({ uri });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not update this note right now" },
      { status: 400 },
    );
  }
}
