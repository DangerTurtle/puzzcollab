import {
  APP_URL,
  MANAGING_APP_DID,
  MANAGING_APP_SERVICE,
  SYNC_PUBLIC_URL,
  SYNC_SERVICE,
  SYNC_SERVICE_DID,
} from "@/lib/config";
import { NextResponse } from "next/server";

export function GET() {
  const services = [
    {
      id: MANAGING_APP_SERVICE,
      type: "AtprotoSpaceService",
      serviceEndpoint: APP_URL,
    },
  ];
  if (SYNC_SERVICE_DID === MANAGING_APP_DID) {
    services.push({
      id: SYNC_SERVICE,
      type: "AtprotoSpaceSyncService",
      serviceEndpoint: SYNC_PUBLIC_URL,
    });
  }
  return NextResponse.json({
    "@context": ["https://www.w3.org/ns/did/v1"],
    id: MANAGING_APP_DID,
    service: services,
  });
}
