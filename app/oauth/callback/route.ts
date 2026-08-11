import { cacheIdentity } from "@/lib/atproto/identity";
import { getOAuthClient } from "@/lib/auth/client";
import { APP_UI_URL } from "@/lib/config";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { session } = await (await getOAuthClient()).callback(
      request.nextUrl.searchParams,
    );
    await cacheIdentity(session.did);
    const response = NextResponse.redirect(APP_UI_URL);
    response.cookies.set("bulletin-did", session.did, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(`${APP_UI_URL}/?error=login`);
  }
}
