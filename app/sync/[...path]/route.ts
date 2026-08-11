import { SYNC_URL } from "@/lib/config";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Context = { params: Promise<{ path: string[] }> };

export function GET(request: NextRequest, context: Context) {
  return proxy(request, context);
}

export function POST(request: NextRequest, context: Context) {
  return proxy(request, context);
}

async function proxy(request: NextRequest, { params }: Context): Promise<Response> {
  const path = (await params).path.join("/");
  const target = new URL(path, `${SYNC_URL.replace(/\/$/, "")}/`);
  target.search = request.nextUrl.search;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("content-length");
  headers.delete("connection");
  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body: request.method === "GET" ? undefined : await request.arrayBuffer(),
    cache: "no-store",
  });
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-length");
  responseHeaders.delete("transfer-encoding");
  responseHeaders.delete("connection");
  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
