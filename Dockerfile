FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

WORKDIR /workspace/bulletin
COPY . .

RUN corepack prepare pnpm@8.15.9 --activate \
  && pnpm install --frozen-lockfile \
  && pnpm build

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

CMD ["pnpm", "start"]
