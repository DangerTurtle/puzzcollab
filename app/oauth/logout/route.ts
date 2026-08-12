import { getOAuthClient } from "@/lib/auth/client";
import {
  deleteWebSession,
  deleteWebSessionsForDid,
  LEGACY_SESSION_COOKIE_NAME,
  WEB_SESSION_COOKIE_NAME,
} from "@/lib/auth/web-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(WEB_SESSION_COOKIE_NAME)?.value;
  const did = token ? deleteWebSession(token) : null;
  if (did) {
    await (await getOAuthClient()).revoke(did).catch(() => undefined);
    deleteWebSessionsForDid(did);
  }
  cookieStore.delete(WEB_SESSION_COOKIE_NAME);
  cookieStore.delete(LEGACY_SESSION_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
