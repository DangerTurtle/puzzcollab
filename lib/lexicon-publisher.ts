import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { getConfig } from "./config";

const LEXICON_COLLECTION = "com.atproto.lexicon.schema";

type LexiconDoc = {
  lexicon: number;
  id: string;
  defs: Record<string, unknown>;
};

type Introspection = {
  lexiconAuthority?: {
    did: string;
    handle: string;
    password: string;
    pds: string;
  };
};

type Authority = Pick<
  NonNullable<Introspection["lexiconAuthority"]>,
  "handle" | "password" | "pds"
>;

async function loadLexicons(dir: string): Promise<LexiconDoc[]> {
  const docs: LexiconDoc[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) docs.push(...(await loadLexicons(path)));
    if (entry.isFile() && entry.name.endsWith(".json")) {
      docs.push(JSON.parse(await readFile(path, "utf8")) as LexiconDoc);
    }
  }
  return docs;
}

async function xrpc(
  url: string,
  init?: RequestInit,
): Promise<Record<string, unknown>> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`${url} failed (${response.status}): ${await response.text()}`);
  }
  return (await response.json()) as Record<string, unknown>;
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function publishLexicons(): Promise<void> {
  const authority = await getAuthority();
  const login = await xrpc(`${authority.pds}/xrpc/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      identifier: authority.handle,
      password: authority.password,
    }),
  });
  const accessJwt = String(login.accessJwt);
  const did = String(login.did);
  const docs = await loadLexicons(join(process.cwd(), "lexicons", "at", "dholms"));

  for (const doc of docs) {
    const existingUrl = new URL(
      `${authority.pds}/xrpc/com.atproto.repo.getRecord`,
    );
    existingUrl.searchParams.set("repo", did);
    existingUrl.searchParams.set("collection", LEXICON_COLLECTION);
    existingUrl.searchParams.set("rkey", doc.id);
    const existingResponse = await fetch(existingUrl, {
      headers: { authorization: `Bearer ${accessJwt}` },
    });
    if (existingResponse.ok) {
      const existing = (await existingResponse.json()) as { value: unknown };
      if (digest(existing.value) === digest(doc)) {
        console.log(`lexicon unchanged: ${doc.id}`);
        continue;
      }
    }

    await xrpc(`${authority.pds}/xrpc/com.atproto.repo.putRecord`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessJwt}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        repo: did,
        collection: LEXICON_COLLECTION,
        rkey: doc.id,
        record: doc,
      }),
    });
    console.log(`published lexicon: ${doc.id}`);
  }
}

async function getAuthority(): Promise<Authority> {
  const handle = process.env.LEXICON_AUTHORITY_HANDLE;
  const password = process.env.LEXICON_AUTHORITY_PASSWORD;
  const pds = process.env.LEXICON_AUTHORITY_PDS;
  if (handle && password && pds) return { handle, password, pds };
  if (handle || password || pds) {
    throw new Error(
      "Set LEXICON_AUTHORITY_HANDLE, LEXICON_AUTHORITY_PASSWORD, and LEXICON_AUTHORITY_PDS together.",
    );
  }
  const { devIntrospectUrl } = getConfig();

  let introspectionResponse: Response;
  try {
    introspectionResponse = await fetch(devIntrospectUrl);
  } catch {
    throw new Error(
      `Cannot reach ${devIntrospectUrl}. Start the atproto multi-PDS test network first.`,
    );
  }
  if (!introspectionResponse.ok) {
    throw new Error(`Dev introspection failed: ${introspectionResponse.status}`);
  }
  const introspection = (await introspectionResponse.json()) as Introspection;
  const authority = introspection.lexiconAuthority;
  if (!authority) throw new Error("The dev network has no lexicon authority");
  return authority;
}
