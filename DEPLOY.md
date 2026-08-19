# Deploy Bulletin

> Bulletin requires PDSes that implement the permissioned-data branch. The
> normal production Bluesky network may not support these APIs yet.

## 1. Publish the Lexicons

Create a dedicated AT Protocol account for the Lexicons and make an app
password for it. Add this DNS record:

```text
_lexicon.bulletin.my  TXT  "did=YOUR_AUTHORITY_DID"
```

Wait for DNS to resolve, then run this once from your computer:

```sh
export LEXICON_AUTHORITY_HANDLE="your-authority-handle"
export LEXICON_AUTHORITY_PASSWORD="your-app-password"
export LEXICON_AUTHORITY_PDS="https://your-pds.example"
pnpm install
pnpm publish-lexicons
```

This publishes the five `my.bulletin.*` files in `lexicons/`. Run the
last command again whenever a Lexicon changes.

## 2. Check the build

```sh
pnpm check
pnpm build
```

The build installs the permissioned-data packages from their npm `alpha`
release. The upstream Lexicons needed for client generation are vendored in
this repository, so neither local nor Railway builds need an `atproto`
checkout.

## 3. Deploy on Railway

1. Push this repository to GitHub.
2. In Railway, create a project from that GitHub repository. Railway will use
   the included `Dockerfile`; no custom build or start command is needed.
3. Add a persistent volume mounted at `/data`.
4. Add `bulletin.my` as the custom domain, set its target port to
   **3000**, and create the DNS record Railway shows you. Port 3001 is only
   used by the loopback sync listener inside the same application process.
5. Add these variables to the Railway service. Production configuration is
   intentionally not stored in a checked-in env file:

```text
BULLETIN_HOST=0.0.0.0
BULLETIN_PORT=3000
PUBLISH_LEXICONS=false
MANAGING_APP_PUBLIC_URL=https://bulletin.my
UI_PUBLIC_URL=https://bulletin.my
DATABASE_PATH=/data/bulletin.db
SYNC_INTERNAL_URL=http://127.0.0.1:3001
MANAGING_APP_DID=did:web:bulletin.my
PLC_URL=https://plc.directory
BSKY_URL=https://public.api.bsky.app
```

The Docker image sets `NODE_ENV=production`. Blob files default to
`/data/bulletin-blobs` because they are stored beside `DATABASE_PATH`; set
`BLOB_DIRECTORY` explicitly only if you need a different location. Replace
the `bulletin.my` values if deploying under another domain.

Keep the service at **one replica** because the app and sync worker share one
SQLite database.

After deployment, these should all return `200`:

```sh
curl https://bulletin.my/.well-known/did.json
curl https://bulletin.my/oauth-client-metadata.json
curl https://bulletin.my/sync/health
```

Then sign in and create your board. Back up the Railway volume periodically;
it contains the database and OAuth sessions.
