# Bulletin

A local demo of proposal 0016's permissioned-data protocol. Every Bluesky user
can create one bulletin board backed by a `com.atproto.simplespace` space under
their DID. Other users write notes from their own permissioned repos. The space
authority delegates read admission to this app, which checks whether the reader
follows the board owner.

The board owner moderates by publishing `my.bulletin.label` records
inside the same space. Labels never leak through the public label stream.

## Run locally

### Against the local multi-PDS testnet

The demo uses the `alpha` releases of the permissioned-data packages and
requires Node 22 or newer. A sibling `../atproto` checkout is only needed to
run the local multi-PDS network.

First, start the multi-PDS network:

```sh
cd ../atproto
pnpm --filter @atproto/dev-env start:multi-pds
```

Then start Bulletin:

```sh
cd ../spaces-demo-codex
pnpm install
pnpm dev:local
```

Open <http://127.0.0.1:3000>. The dev network seeds `alice`, `bob`, and `carol`
on each PDS. Passwords are `<name>-pass`, such as `alice-pass`.

The `local` environment migrates SQLite, publishes the `my.bulletin`
Lexicons to the test network's Lexicon authority, and starts both Next.js and
the sync service in one Node process.
On sign-in, Bulletin rediscovers the user's deterministic board. Other boards
are discovered on demand the first time someone opens them, without scanning
the viewer's follow list.

### Run locally with production Atmosphere accounts

To run the UI and sync worker locally while signing in with production
Atmosphere accounts, use:

```sh
pnpm dev
```

Open <http://127.0.0.1:3000>. The `dev` environment uses the production PLC and
handle resolver and stores state in `bulletin-dev.db`, so it cannot mix with
local-testnet sessions. It does not start the multi-PDS network or publish
Lexicons. It uses the deployed
`bulletin.my` managing-app and sync identities, so that production PDSes
can resolve and call those services even though the development server and its
database are local. PDS notifications therefore go to the deployed sync
service; the local sync worker reconciles watched boards every 10 seconds to
keep its isolated database current.

## Environments

Bulletin has three environments, all run by the same application entry point:

| Environment | Command | Purpose |
| --- | --- | --- |
| `local` | `pnpm dev:local` | Local multi-PDS testnet |
| `dev` | `pnpm dev` | Local development against Atmosphere |
| `production` | `pnpm start` | Built application on Railway |

Each command loads one self-contained file: `env/local.env`, `env/dev.env`, or
`env/production.env`. Shell and deployment variables take precedence.

## Key pieces

- `app/xrpc/com.atproto.simplespace.checkUserAccess`: managing-app callback
- `app/xrpc/com.atproto.space.notify*`: public notification ingress
- `lib/atproto/space-credential.ts`: delegation, credential exchange, and DPoP
- `lib/sync/engine.ts`: multi-PDS writer discovery and materialization
- `lib/db`: Kysely-backed SQLite state, OAuth storage, posts, and labels
- `lexicons/my`: board, post, position, label, and permission declarations

The main application's `#bulletin` service receives both managing-app calls
and write notifications. Notification routes forward to the loopback-only
sync server; its watch and event endpoints are never exposed publicly.

For production setup and Railway deployment, see [DEPLOY.md](./DEPLOY.md).
