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
4. Add `bulletin.dholms.at` as the custom domain, set its target port to
   **3000**, and create the DNS record Railway shows you. Port 3001 is only
   used by the loopback sync listener inside the same application process.
5. `env/production.env` provides the public URLs, DIDs, production
   resolvers, loopback sync URL, and `/data/bulletin.db` database path. Add
   Railway variables only when overriding those defaults. For example:

```text
DATABASE_PATH=/data/bulletin.db
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
