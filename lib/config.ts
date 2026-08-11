export const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
export const APP_UI_URL = process.env.APP_UI_URL ?? "http://127.0.0.1:3000";
export const SYNC_URL = process.env.SYNC_URL ?? "http://localhost:3001";
export const SYNC_PUBLIC_URL = process.env.SYNC_PUBLIC_URL ?? SYNC_URL;
export const DEV_INTROSPECT_URL =
  process.env.DEV_INTROSPECT_URL ?? "http://localhost:2581";
export const DEV_PDS_URL =
  process.env.DEV_PDS_URL ?? "http://localhost:2583";
export const DEV_PLC_URL =
  process.env.DEV_PLC_URL ?? "http://localhost:2582";
export const PLC_URL = process.env.PLC_URL ?? DEV_PLC_URL;
export const HANDLE_RESOLVER_URL = process.env.HANDLE_RESOLVER_URL;

export const SPACE_TYPE = "at.dholms.bulletin.board";
export const POST_COLLECTION = "at.dholms.bulletin.post";
export const LABEL_COLLECTION = "at.dholms.bulletin.label";
export const POSITION_COLLECTION = "at.dholms.bulletin.position";
export const BULLETIN_PERMISSION_SET = "at.dholms.bulletin.permissions";
export const BOARD_SKEY = "self";

export const MANAGING_APP_DID =
  process.env.MANAGING_APP_DID ?? "did:web:localhost%3A3000";
export const MANAGING_APP_SERVICE = `${MANAGING_APP_DID}#bulletin`;
export const SYNC_SERVICE_DID =
  process.env.SYNC_SERVICE_DID ?? "did:web:localhost%3A3001";
export const SYNC_SERVICE = `${SYNC_SERVICE_DID}#bulletin-sync`;

export const OAUTH_SCOPE = [
  "atproto",
  "repo:app.bsky.graph.follow",
  `include:${BULLETIN_PERMISSION_SET}`,
].join(" ");

export function boardUri(ownerDid: string): string {
  return `at://${ownerDid}/space/${SPACE_TYPE}/${BOARD_SKEY}`;
}
