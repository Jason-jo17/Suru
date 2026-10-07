# syntax=docker/dockerfile:1

# ---------------------------------------------------------------- dependencies
FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
RUN npm ci

# --------------------------------------------------------------------- builder
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The provider is written from DATABASE_URL at build time (see
# scripts/setDbProvider.mjs). The build only needs the scheme, so a placeholder
# is enough and no real database is contacted.
ARG DATABASE_URL="postgresql://placeholder"
ENV DATABASE_URL=$DATABASE_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# The runtime image carries no TypeScript toolchain, so the CLI scripts are
# bundled to plain JS here. Without this, ingest and scoring could not be run
# against the live database from inside the container.
RUN node scripts/bundleCli.mjs

# --------------------------------------------------------------------- runtime
FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma schema, engines and CLI, so the container can push the schema and the
# bundled pipeline scripts can run against the live database.
# Writable: the entrypoint rewrites the provider line before `db push`.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nextjs:nodejs /app/scripts/setDbProvider.mjs ./scripts/setDbProvider.mjs
# The question sets are read from disk at runtime, and their content hash is the
# question_set_version recorded on every run.
COPY --from=builder /app/test ./test
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
