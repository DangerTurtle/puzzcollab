import { buildAtprotoLoopbackClientMetadata } from "@atproto/oauth-client-node";
import { APP_UI_URL, OAUTH_SCOPE } from "../config";

export function getClientMetadata() {
  const appUrl = new URL(APP_UI_URL);
  const redirectUri = `${APP_UI_URL}/oauth/callback`;
  if (appUrl.hostname === "localhost" || appUrl.hostname === "127.0.0.1") {
    return buildAtprotoLoopbackClientMetadata({
      redirect_uris: [redirectUri],
      scope: OAUTH_SCOPE,
    });
  }

  return {
    client_id: `${APP_UI_URL}/oauth-client-metadata.json`,
    client_name: "Bulletin",
    client_uri: APP_UI_URL,
    redirect_uris: [redirectUri] as [string, ...string[]],
    scope: OAUTH_SCOPE,
    grant_types: ["authorization_code", "refresh_token"] as [
      "authorization_code",
      "refresh_token",
    ],
    response_types: ["code"] as ["code"],
    token_endpoint_auth_method: "none" as const,
    application_type: "web" as const,
    dpop_bound_access_tokens: true,
  };
}
