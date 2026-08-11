import { verifyJwt } from "@atproto/xrpc-server";
import { SYNC_SERVICE } from "../config";
import { getIdResolver } from "../atproto/identity";

const NOTIFY_WRITE_LXM = "com.atproto.space.notifyWrite";

export async function verifySyncNotification(
  authorization: string | undefined,
  space: string,
): Promise<void> {
  const token = authorization?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new Error("Missing service auth");
  const authority = space.match(/^at:\/\/(did:[^/]+)\/space\//)?.[1];
  if (!authority) throw new Error("Invalid board reference");
  const payload = await verifyJwt(
    token,
    SYNC_SERVICE,
    NOTIFY_WRITE_LXM,
    async (issuer, forceRefresh) => {
      const did = issuer.split("#")[0];
      return getIdResolver().did.resolveAtprotoKey(did, forceRefresh);
    },
  );
  if (payload.iss.split("#")[0] !== authority) {
    throw new Error("Notification issuer is not the board authority");
  }
}
