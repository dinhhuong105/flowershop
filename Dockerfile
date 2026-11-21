# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Dùng cho `prisma migrate deploy` và `prisma db seed`
FROM deps AS migrator
COPY prisma ./prisma
COPY tsconfig.json ./
COPY src/lib/reserved-slugs.ts ./src/lib/reserved-slugs.ts
RUN npx prisma generate
CMD ["npx", "prisma", "migrate", "deploy"]

FROM deps AS builder
COPY . .
RUN npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  PORT=3000 \
  HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
