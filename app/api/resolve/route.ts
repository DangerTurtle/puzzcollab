import { cacheIdentity, resolveIdentifier } from "@/lib/atproto/identity";
import { getAccount, hasBoard } from "@/lib/db/queries";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const identifier = request.nextUrl.searchParams.get("identifier");
  if (!identifier) {
    return NextResponse.json({ error: "Enter a handle" }, { status: 400 });
  }
  try {
    const did = await resolveIdentifier(identifier);
    await cacheIdentity(did).catch(() => undefined);
    if (!(await hasBoard(did))) {
      return NextResponse.json(
        { error: `@${identifier.replace(/^@/, "")} does not have a Bulletin board yet` },
        { status: 404 },
      );
    }
    const handle = (await getAccount(did))?.handle;
    if (!handle) {
      return NextResponse.json({ error: "That account has no handle" }, { status: 404 });
    }
    return NextResponse.json({ handle });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Not found" },
      { status: 404 },
    );
  }
}
