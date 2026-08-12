# Deploy Bulletin

> Bulletin requires PDSes that implement the permissioned-data branch. The
> normal production Bluesky network may not support these APIs yet.

## 1. Publish the Lexicons

Create a dedicated AT Protocol account for the Lexicons and make an app
password for it. Add this DNS record:

```text
_lexicon.bulletin.dholms.at  TXT  "did=YOUR_AUTHORITY_DID"
```

Wait for DNS to resolve, then run this once from your computer:

```sh
export LEXICON_AUTHORITY_HANDLE="your-authority-handle"
export LEXICON_AUTHORITY_PASSWORD="your-app-password"
export LEXICON_AUTHORITY_PDS="https://your-pds.example"
pnpm install
pnpm publish-lexicons
```

This publishes the five `at.dholms.bulletin.*` files in `lexicons/`. Run the
last command again whenever a Lexicon changes.

## 2. Check the build

```sh
pnpm lint
pnpm build
```

The local build expects the permissioned-data `atproto` checkout at
`../atproto`. The Railway Dockerfile downloads the exact tested commit itself.
It builds `@atproto/space` and the other required packages directly from that
source checkout; none of them need to be published to npm.

## 3. Deploy on Railway

1. Push this repository to GitHub.
2. In Railway, create a project from that GitHub repository. Railway will use
   the included `Dockerfile`; no custom build or start command is needed.
3. Add a persistent volume mounted at `/data`.
4. Add `bulletin.dholms.at` as the custom domain, set its target port to
   **3000**, and create the DNS record Railway shows you. Port 3001 is only
   used internally by the sync sidecar.
5. Add these Railway variables:

```text
APP_URL=https://bulletin.dholms.at
APP_UI_URL=https://bulletin.dholms.at
DATABASE_PATH=/data/bulletin.db
PLC_URL=https://plc.directory
HANDLE_RESOLVER_URL=https://public.api.bsky.app
BSKY_URL=https://public.api.bsky.app
MANAGING_APP_DID=did:web:bulletin.dholms.at
SYNC_URL=http://127.0.0.1:3001
SYNC_PUBLIC_URL=https://bulletin.dholms.at/sync
SYNC_SERVICE_DID=did:web:bulletin.dholms.at
```

Keep the service at **one replica** because the app and sync worker share one
SQLite database.

After deployment, these should all return `200`:

```sh
curl https://bulletin.dholms.at/.well-known/did.json
curl https://bulletin.dholms.at/oauth-client-metadata.json
curl https://bulletin.dholms.at/sync/health
```

Then sign in and create your board. Back up the Railway volume periodically;
it contains the database and OAuth sessions.
