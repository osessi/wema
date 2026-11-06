# Image de production du site public de Wema (Next.js, sortie « standalone »).
# Toutes les pages sont pré-rendues au build ; le serveur ne fait que les servir.
# À construire depuis la racine du dépôt :
#   docker build -f apps/site/Dockerfile -t wema-site .
# WEMA_SITE_URL (adresse publique, pour le sitemap et Open Graph) est lu au build.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

FROM base AS manifests
COPY . /src
RUN cd /src && mkdir /out \
  && find . -name package.json -not -path "*/node_modules/*" -exec cp --parents {} /out \; \
  && cp pnpm-lock.yaml pnpm-workspace.yaml /out

FROM base AS deps
COPY --from=manifests /out ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter "@wema/site..."

FROM base AS build
ARG WEMA_SITE_URL=https://wema.winneragency.co
ENV WEMA_SITE_URL=$WEMA_SITE_URL NODE_ENV=production
COPY --from=deps /app ./
COPY tsconfig.base.json package.json ./
COPY packages/ui ./packages/ui
COPY apps/site ./apps/site
RUN cd apps/site && pnpm build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/site/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/site/.next/static ./apps/site/.next/static
COPY --from=build --chown=node:node /app/apps/site/public ./apps/site/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/site/server.js"]
