# Image de production du web Wema (Next.js, sortie « standalone »).
# À construire depuis la racine du dépôt :
#   docker build -f apps/web/Dockerfile -t wema-web .
# WEMA_API_URL est lu au moment de la construction (relais /api vers l'API).
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
  pnpm install --frozen-lockfile --filter "@wema/web..."

FROM base AS build
ARG WEMA_API_URL=http://api:4000
ENV WEMA_API_URL=$WEMA_API_URL NODE_ENV=production
COPY --from=deps /app ./
COPY tsconfig.base.json package.json ./
COPY packages ./packages
COPY apps/api ./apps/api
COPY apps/web ./apps/web
RUN cd apps/web && pnpm build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/connexion').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]
