FROM node:20-alpine AS base
# openssl needed by Prisma engine; curl for health check
RUN apk add --no-cache libc6-compat curl openssl
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Dependencies stage
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/db/package.json ./packages/db/package.json
# Copy schema before install so Prisma postinstall picks up binaryTargets
COPY packages/db/prisma ./packages/db/prisma
RUN pnpm install --frozen-lockfile

# Builder stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY . .

# Generate Prisma client with the correct binary targets
RUN pnpm --filter @repo/db generate

# Build Next.js app (standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web build

# Runner stage — minimal production image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Standalone output bundles all server dependencies
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

# Prisma schema for migrations run via the migrate service
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma

# Prisma CLI + engine binaries — pnpm puts real packages in .pnpm
# The standalone output's node_modules already contains @prisma/client symlinks;
# we need the actual engine binary to be resolvable.
COPY --from=builder /app/node_modules/.pnpm ./node_modules/.pnpm

RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/web/server.js"]
