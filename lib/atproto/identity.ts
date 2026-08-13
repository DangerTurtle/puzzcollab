import { getPdsEndpoint } from "@atproto/common-web";
import { IdResolver } from "@atproto/identity";
import {
  DEV_INTROSPECT_URL,
  DEV_PDS_URL,
  HANDLE_RESOLVER_URL,
  PLC_URL,
} from "../config";
import { getAccount, saveAccount } from "../db/queries";

let resolver: IdResolver | undefined;

export function getIdResolver(): IdResolver {
  resolver ??= new IdResolver({ plcUrl: PLC_URL });
  return resolver;
}

export async function resolveDid(did: string, forceRefresh = false) {
  const doc = await getIdResolver().did.resolve(did, forceRefresh);
  if (!doc) throw new Error(`Could not resolve ${did}`);
  return doc;
}

export async function resolvePds(did: string): Promise<string> {
  const cached = (await getAccount(did))?.pdsUrl;
  if (cached) return cached;
  const doc = await resolveDid(did);
  const pdsUrl = getPdsEndpoint(doc);
  if (!pdsUrl) throw new Error(`${did} has no PDS endpoint`);
  const handle = doc.alsoKnownAs
    ?.find((value) => value.startsWith("at://"))
    ?.slice("at://".length);
  await saveAccount({ did, handle, pdsUrl });
  return pdsUrl;
}

export async function resolveIdentifier(identifier: string): Promise<string> {
  if (identifier.startsWith("did:")) return identifier;
  const handle = identifier.replace(/^@/, "");
  const did = await resolveHandle(handle);
  if (!did) throw new Error(`Could not resolve @${handle}`);
  return did;
}

export async function resolveHandle(handle: string): Promise<string | null> {
  if (HANDLE_RESOLVER_URL) {
    return resolveHandleAt(HANDLE_RESOLVER_URL, handle);
  }
  const pdsUrls = await getDevPdsUrls(handle);
  for (const pdsUrl of pdsUrls) {
    const did = await resolveHandleAt(pdsUrl, handle);
    if (did) return did;
  }
  return null;
}

async function resolveHandleAt(service: string, handle: string): Promise<string | null> {
  const url = new URL(`${service}/xrpc/com.atproto.identity.resolveHandle`);
  url.searchParams.set("handle", handle);
  const response = await fetch(url);
  if (response.ok) {
    const body = (await response.json()) as { did: string };
    return body.did;
  }
  if (response.status === 400) return null;
  throw new Error(`Handle resolution failed (${response.status})`);
}

async function getDevPdsUrls(handle: string): Promise<string[]> {
  try {
    const response = await fetch(DEV_INTROSPECT_URL);
    if (!response.ok) throw new Error(`Introspection failed (${response.status})`);
    const body = (await response.json()) as {
      pdses?: Array<{ url: string; handleDomains?: string[] }>;
    };
    const matches = body.pdses?.filter((pds) =>
      pds.handleDomains?.some((domain) => handle.endsWith(domain)),
    );
    if (matches?.length) return matches.map((pds) => pds.url);
  } catch {
    // Fall back to the primary PDS when the dev introspection server is absent.
  }
  return [DEV_PDS_URL];
}

export async function cacheIdentity(did: string): Promise<void> {
  const doc = await resolveDid(did);
  const pdsUrl = getPdsEndpoint(doc);
  const handle = doc.alsoKnownAs
    ?.find((value) => value.startsWith("at://"))
    ?.slice("at://".length);
  await saveAccount({ did, handle, pdsUrl });
}
