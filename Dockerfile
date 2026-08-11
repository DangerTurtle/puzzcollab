FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates git python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

WORKDIR /workspace

# @atproto/space is not published yet, so build against the tested source commit.
ARG ATPROTO_COMMIT=14e3ed0ec5219c58e33eb66a3efe049a3bf2b78f
RUN git clone --filter=blob:none https://github.com/bluesky-social/atproto.git atproto \
  && git -C atproto checkout "$ATPROTO_COMMIT" \
  && corepack prepare pnpm@11.11.0 --activate \
  && pnpm --dir atproto install --frozen-lockfile \
  && pnpm --dir atproto \
    --filter '@atproto/api...' \
    --filter '@atproto/common-web...' \
    --filter '@atproto/identity...' \
    --filter '@atproto/jwk-jose...' \
    --filter '@atproto/lex-data...' \
    --filter '@atproto/oauth-client-node...' \
    --filter '@atproto/space...' \
    --filter '@atproto/syntax...' \
    --filter '@atproto/xrpc-server...' \
    run build

COPY . bulletin
WORKDIR /workspace/bulletin

RUN corepack prepare pnpm@8.15.9 --activate \
  && pnpm install --frozen-lockfile \
  && pnpm build

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

CMD ["pnpm", "railway:start"]
