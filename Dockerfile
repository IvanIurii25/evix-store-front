# evix-store-front — Astro + Vue 3 islands, built for Node SSR (standalone).
# Multi-stage: install+build with dev deps, run with a slim prod image.
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable

# Install deps first for better layer caching.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# PUBLIC_* vars are baked into the client bundle at build time. In prod the
# storefront is same-origin (front + /api behind one Cloudflare hostname), so
# both browser islands and SSR fetch go to this base.
ARG PUBLIC_API_BASE=https://shop.evix.md
ENV PUBLIC_API_BASE=$PUBLIC_API_BASE
# Canonical/hreflang/sitemap base (Astro `site`).
ARG SITE_URL=https://shop.evix.md
ENV SITE_URL=$SITE_URL
RUN pnpm build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
# Only the built server + its node_modules are needed at runtime.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["node", "./dist/server/entry.mjs"]
