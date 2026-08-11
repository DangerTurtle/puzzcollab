import { getClientMetadata } from "@/lib/auth/metadata";
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(getClientMetadata());
}
