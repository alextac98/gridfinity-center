# syntax=docker/dockerfile:1

# Next.js app image. The native OpenSCAD render service has its own image in
# render-service/Dockerfile; this image only serves the web app and its API routes.

FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS build
# Commit SHA shown in the app shell and attached to analytics events. The
# .git directory is excluded from the build context, so pass it explicitly:
#   docker build --build-arg GRIDFINITY_COMMIT_SHA="$(git rev-parse HEAD)" .
ARG GRIDFINITY_COMMIT_SHA=""
# NEXT_PUBLIC_* values are inlined into the client bundle at build time.
ARG NEXT_PUBLIC_POSTHOG_KEY=""
ENV GRIDFINITY_COMMIT_SHA=$GRIDFINITY_COMMIT_SHA \
    NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_OUTPUT_STANDALONE=1 \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:24-alpine AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app
RUN addgroup -S nextjs && adduser -S -G nextjs nextjs
COPY --from=build --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nextjs /app/.next/static ./.next/static
# Served as static assets and also read at runtime by src/server for cache fingerprints.
COPY --from=build --chown=nextjs:nextjs /app/public ./public
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
