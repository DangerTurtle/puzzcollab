import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  transpilePackages: [
    "@atproto/lex-client",
    "@atproto/oauth-client-node",
    "@atproto/space",
  ],
};

export default nextConfig;
