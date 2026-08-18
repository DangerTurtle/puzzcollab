import { getRuntimeConfig } from "@/lib/config";
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
  const segments = (await params).path;
  if (
    segments.some(
      (segment) => segment.includes("/") || segment.includes("\\"),
    )
  ) {
    return new Response("Not found", { status: 404 });
  }
  const path = segments.join("/");
  const base = new URL(`${getRuntimeConfig().syncInternalUrl}/`);
  const target = new URL(path, base);
  if (
    target.origin !== base.origin ||
    target.pathname === "/watch" ||
    target.pathname === "/watch/"
  ) {
    return new Response("Not found", { status: 404 });
  }
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
