import type { OAuthSession } from "@atproto/oauth-client-node";
import { cookies } from "next/headers";
import { getOAuthClient } from "./client";

export async function getDid(): Promise<string | null> {
  return (await cookies()).get("bulletin-did")?.value ?? null;
}

export async function getSession(): Promise<OAuthSession | null> {
  const did = await getDid();
  if (!did) return null;
  try {
    return await (await getOAuthClient()).restore(did);
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<OAuthSession> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}
