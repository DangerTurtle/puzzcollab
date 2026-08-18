export const SPACE_TYPE = "at.dholms.bulletin.board";
export const POST_COLLECTION = "at.dholms.bulletin.post";
export const LABEL_COLLECTION = "at.dholms.bulletin.label";
export const POSITION_COLLECTION = "at.dholms.bulletin.position";
export const BULLETIN_PERMISSION_SET = "at.dholms.bulletin.permissions";
export const BOARD_SKEY = "self";

export const OAUTH_SCOPE = [
  "atproto",
  "repo:app.bsky.graph.follow",
  "blob?accept=image/jpeg&accept=image/png&accept=image/webp",
  `include:${BULLETIN_PERMISSION_SET}`,
].join(" ");

export type Config = {
  development: boolean;
  publishLexicons: boolean;
  hostname: string;
  port: number;
  syncHostname: string;
  syncPollInterval?: number;
  managingAppPublicUrl: string;
  uiPublicUrl: string;
  syncInternalUrl: string;
  syncPublicUrl: string;
  devIntrospectUrl: string;
  devPdsUrl: string;
  devPlcUrl: string;
  plcUrl: string;
  handleResolverUrl?: string;
  bskyUrl: string;
  managingAppDid: string;
  managingAppService: string;
  syncServiceDid: string;
  syncService: string;
  databasePath: string;
  blobDirectory?: string;
};

type Environment = Record<string, string | undefined>;

export function getConfig(): Config {
  return readConfig(process.env);
}

export function readConfig(
  environment: Environment = process.env,
): Config {
  const devPlcUrl = absoluteUrl(
    "DEV_PLC_URL",
    environment.DEV_PLC_URL ?? "http://localhost:2582",
  );
  const managingAppDid =
    environment.MANAGING_APP_DID ?? "did:web:localhost%3A3000";
  const syncServiceDid =
    environment.SYNC_SERVICE_DID ?? "did:web:localhost%3A3001";
  const syncInternalUrl = absoluteUrl(
    "SYNC_INTERNAL_URL",
    environment.SYNC_INTERNAL_URL ?? "http://127.0.0.1:3001",
  );
  return {
    development: environment.NODE_ENV !== "production",
    publishLexicons: boolean(
      environment.PUBLISH_LEXICONS ?? "false",
      "PUBLISH_LEXICONS",
    ),
    hostname: environment.BULLETIN_HOST ?? "127.0.0.1",
    port: integer(
      environment.BULLETIN_PORT ?? "3000",
      "BULLETIN_PORT",
      1,
      65535,
    ),
    syncHostname: environment.SYNC_HOST ?? "127.0.0.1",
    syncPollInterval: optionalInteger(
      environment.SYNC_POLL_INTERVAL_MS,
      "SYNC_POLL_INTERVAL_MS",
      1000,
    ),
    managingAppPublicUrl: absoluteUrl(
      "MANAGING_APP_PUBLIC_URL",
      environment.MANAGING_APP_PUBLIC_URL ?? "http://localhost:3000",
    ),
    uiPublicUrl: absoluteUrl(
      "UI_PUBLIC_URL",
      environment.UI_PUBLIC_URL ?? "http://127.0.0.1:3000",
    ),
    syncInternalUrl,
    syncPublicUrl: absoluteUrl(
      "SYNC_PUBLIC_URL",
      environment.SYNC_PUBLIC_URL ?? syncInternalUrl,
    ),
    devIntrospectUrl: absoluteUrl(
      "DEV_INTROSPECT_URL",
      environment.DEV_INTROSPECT_URL ?? "http://localhost:2581",
    ),
    devPdsUrl: absoluteUrl(
      "DEV_PDS_URL",
      environment.DEV_PDS_URL ?? "http://localhost:2583",
    ),
    devPlcUrl,
    plcUrl: absoluteUrl("PLC_URL", environment.PLC_URL ?? devPlcUrl),
    handleResolverUrl: optionalAbsoluteUrl(
      "HANDLE_RESOLVER_URL",
      environment.HANDLE_RESOLVER_URL,
    ),
    bskyUrl: absoluteUrl(
      "BSKY_URL",
      environment.BSKY_URL ?? "https://public.api.bsky.app",
    ),
    managingAppDid,
    managingAppService: `${managingAppDid}#bulletin`,
    syncServiceDid,
    syncService: `${syncServiceDid}#bulletin-sync`,
    databasePath: environment.DATABASE_PATH ?? "bulletin.db",
    blobDirectory: environment.BLOB_DIRECTORY,
  };
}

function boolean(value: string, name: string): boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${name} must be true or false`);
}

export function boardUri(ownerDid: string): string {
  return `at://${ownerDid}/space/${SPACE_TYPE}/${BOARD_SKEY}`;
}

function absoluteUrl(name: string, value: string): string {
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${name} must be an absolute URL`);
  }
}

function optionalAbsoluteUrl(
  name: string,
  value: string | undefined,
): string | undefined {
  return value ? absoluteUrl(name, value) : undefined;
}

function optionalInteger(
  value: string | undefined,
  name: string,
  minimum: number,
): number | undefined {
  return value === undefined || value === ""
    ? undefined
    : integer(value, name, minimum);
}

function integer(
  value: string,
  name: string,
  minimum: number,
  maximum?: number,
): number {
  const parsed = Number(value);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < minimum ||
    (maximum !== undefined && parsed > maximum)
  ) {
    const range = maximum
      ? `from ${minimum} through ${maximum}`
      : `of at least ${minimum}`;
    throw new Error(`${name} must be an integer ${range}`);
  }
  return parsed;
}
