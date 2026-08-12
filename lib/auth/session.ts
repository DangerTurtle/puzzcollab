import type { OAuthSession } from "@atproto/oauth-client-node";
import { cookies } from "next/headers";
import { getOAuthClient } from "./client";
import {
  deleteWebSession,
  resolveWebSession,
  WEB_SESSION_COOKIE_NAME,
} from "./web-session";

export async function getSession(): Promise<OAuthSession | null> {
  const token = (await cookies()).get(WEB_SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  const did = resolveWebSession(token);
  if (!did) return null;
  try {
    const session = await (await getOAuthClient()).restore(did);
    if (session.did !== did) throw new Error("OAuth session subject mismatch");
    return session;
  } catch {
    deleteWebSession(token);
    return null;
  }
}

export async function requireSession(): Promise<OAuthSession> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}
