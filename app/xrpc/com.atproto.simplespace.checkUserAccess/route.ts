import { userFollows } from "@/lib/atproto/follows";
import { verifyManagingAppRequest } from "@/lib/atproto/service-auth";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const space = request.nextUrl.searchParams.get("space");
  const user = request.nextUrl.searchParams.get("user");
  const authority = space?.match(/^at:\/\/(did:[^/]+)\/space\//)?.[1];
  if (!space || !user || !authority) {
    return NextResponse.json({ error: "InvalidRequest" }, { status: 400 });
  }

  try {
    await verifyManagingAppRequest(
      request.headers.get("authorization"),
      authority,
    );
    return NextResponse.json({ authorized: await userFollows(user, authority) });
  } catch (error) {
    console.error("managing-app access check failed", error);
    return NextResponse.json({ error: "AuthRequired" }, { status: 401 });
  }
}
