import { Agent } from "@atproto/api";
import { JoseKey } from "@atproto/jwk-jose";
import type { OAuthSession } from "@atproto/oauth-client-node";
import { createDpopProof, dpopJktForKey } from "@atproto/space";
import { resolvePds } from "./identity";

export class SpaceCredential {
  constructor(
    readonly token: string,
    readonly key: JoseKey,
  ) {}

  fetch = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const request = new Request(input, init);
    request.headers.set("authorization", `DPoP ${this.token}`);
    request.headers.set(
      "dpop",
      await createDpopProof(this.key, {
        htm: request.method,
        htu: request.url,
        credential: this.token,
      }),
    );
    return fetch(request);
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
  const dpopJkt = await dpopJktForKey(key);
  const anonymous = new Agent({ service: authorityPds });
  const result = await anonymous.com.atproto.space.getSpaceCredential(
    {
      space,
      dpopJkt,
    },
    {
      headers: { authorization: `Bearer ${delegation.data.token}` },
    },
  );
  return new SpaceCredential(result.data.credential, key);
}
