import { getRuntimeConfig } from "@/lib/config";
import { NextResponse } from "next/server";

export function GET() {
  const config = getRuntimeConfig();
  const services = [
    {
      id: config.managingAppService,
      type: "AtprotoSpaceService",
      serviceEndpoint: config.managingAppPublicUrl,
    },
  ];
  if (config.syncServiceDid === config.managingAppDid) {
    services.push({
      id: config.syncService,
      type: "AtprotoSpaceSyncService",
      serviceEndpoint: config.syncPublicUrl,
    });
  }
  return NextResponse.json({
    "@context": ["https://www.w3.org/ns/did/v1"],
    id: config.managingAppDid,
    service: services,
  });
}
