import { Agent, XRPCError } from "@atproto/api";
import { JoseKey } from "@atproto/jwk-jose";
import type { OAuthSession } from "@atproto/oauth-client-node";
import { createDpopProof } from "@atproto/space";
import { resolvePds } from "./identity";

const GET_SPACE_CREDENTIAL_PATH =
  "/xrpc/com.atproto.space.getSpaceCredential";

export class SpaceCredential {
  constructor(
    readonly token: string,
    readonly key: JoseKey,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const request = new Request(input, { ...init, redirect: "error" });
    request.headers.set("authorization", `DPoP ${this.token}`);
    request.headers.set(
      "dpop",
      await createDpopProof(this.key, {
        htm: request.method,
        htu: request.url,
        credential: this.token,
      }),
    );
    return this.fetchImpl(request);
  };

  agent(service: string): Agent {
    return new Agent({ service, fetch: this.fetch });
  }
}

export async function mintSpaceCredential(
  session: OAuthSession,
  space: string,
): Promise<SpaceCredential> {
  const viewerAgent = new Agent(session);
  const delegation = await viewerAgent.com.atproto.space.getDelegationToken({
    space,
  });
  const authority = space.match(/^at:\/\/(did:[^/]+)\/space\//)?.[1];
  if (!authority) throw new Error("Invalid space URI");
  const authorityPds = await resolvePds(authority);
  const key = await JoseKey.generate(["ES256"]);
  const credential = await exchangeSpaceCredential({
    authorityPds,
    delegationToken: delegation.data.token,
    space,
    key,
  });
  return new SpaceCredential(credential, key);
}

export async function exchangeSpaceCredential(input: {
  authorityPds: string;
  delegationToken: string;
  space: string;
  key: JoseKey;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const url = new URL(GET_SPACE_CREDENTIAL_PATH, input.authorityPds);
  const request = new Request(url, {
    method: "POST",
    redirect: "error",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${input.delegationToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ space: input.space }),
  });
  request.headers.set(
    "dpop",
    await createDpopProof(input.key, {
      htm: request.method,
      htu: request.url,
    }),
  );

  const response = await (input.fetchImpl ?? fetch)(request);
  const body = await readJson(response);
  if (!response.ok) {
    const error = asObject(body);
    throw new XRPCError(
      response.status,
      typeof error?.error === "string" ? error.error : undefined,
      typeof error?.message === "string" ? error.message : undefined,
      Object.fromEntries(response.headers.entries()),
    );
  }

  const output = asObject(body);
  if (typeof output?.credential !== "string" || !output.credential) {
    throw new XRPCError(
      500,
      "InvalidResponse",
      "Credential exchange returned no credential",
    );
  }
  return output.credential;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : undefined;
}
