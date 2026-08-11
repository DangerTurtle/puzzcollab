import { verifyJwt } from "@atproto/xrpc-server";
import { MANAGING_APP_SERVICE } from "../config";
import { getIdResolver } from "./identity";

const CHECK_ACCESS_LXM = "com.atproto.simplespace.checkUserAccess";

export async function verifyManagingAppRequest(
  authorization: string | null,
  expectedAuthority: string,
): Promise<void> {
  const token = authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new Error("Missing service auth");

  const payload = await verifyJwt(
    token,
    MANAGING_APP_SERVICE,
    CHECK_ACCESS_LXM,
    async (issuer, forceRefresh) => {
      const did = issuer.split("#")[0];
      return getIdResolver().did.resolveAtprotoKey(did, forceRefresh);
    },
  );
  if (payload.iss.split("#")[0] !== expectedAuthority) {
    throw new Error("Service auth issuer is not the space authority");
  }
}
