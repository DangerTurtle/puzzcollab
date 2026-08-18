import { resolveNavigationHandle } from "@/lib/board-navigation";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const identifier = request.nextUrl.searchParams.get("identifier");
  if (!identifier) {
    return NextResponse.json({ error: "Enter a handle" }, { status: 400 });
  }
  try {
    const handle = await resolveNavigationHandle(identifier);
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
