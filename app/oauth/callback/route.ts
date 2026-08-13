import { cacheIdentity } from "@/lib/atproto/identity";
import { getOAuthClient } from "@/lib/auth/client";
import {
  createWebSession,
  deleteWebSession,
  LEGACY_SESSION_COOKIE_NAME,
  WEB_SESSION_COOKIE_NAME,
  webSessionCookieOptions,
} from "@/lib/auth/web-session";
import { APP_UI_URL } from "@/lib/config";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const { session } = await (await getOAuthClient()).callback(
      request.nextUrl.searchParams,
    );
    await cacheIdentity(session.did);
    const previousToken = request.cookies.get(WEB_SESSION_COOKIE_NAME)?.value;
    if (previousToken) await deleteWebSession(previousToken);
    const token = await createWebSession(session.did);
    const response = NextResponse.redirect(APP_UI_URL);
    response.cookies.set(
      WEB_SESSION_COOKIE_NAME,
      token,
      webSessionCookieOptions(),
    );
    response.cookies.delete(LEGACY_SESSION_COOKIE_NAME);
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.redirect(`${APP_UI_URL}/?error=login`);
  }
}
