import { getConfig } from "@/lib/config";
import { NextResponse } from "next/server";

export function GET() {
  const config = getConfig();
  const services = [
    {
      id: config.managingAppService,
      type: "AtprotoSpaceService",
      serviceEndpoint: config.managingAppPublicUrl,
    },
  ];
  return NextResponse.json({
    "@context": ["https://www.w3.org/ns/did/v1"],
    id: config.managingAppDid,
    service: services,
  });
}
