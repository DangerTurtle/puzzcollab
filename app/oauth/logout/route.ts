import { getOAuthClient } from "@/lib/auth/client";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const cookieStore = await cookies();
  const did = cookieStore.get("bulletin-did")?.value;
  if (did) await (await getOAuthClient()).revoke(did).catch(() => undefined);
  cookieStore.delete("bulletin-did");
  return NextResponse.json({ ok: true });
}
