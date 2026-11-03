# Image de production de l'API Wema (Hono, lancé par tsx).
# À construire depuis la racine du dépôt :
#   docker build -f apps/api/Dockerfile -t wema-api .
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /app

# Seulement les manifestes : l'installation reste en cache tant qu'ils ne changent pas.
FROM base AS manifests
COPY . /src
RUN cd /src && mkdir /out \
  && find . -name package.json -not -path "*/node_modules/*" -exec cp --parents {} /out \; \
  && cp pnpm-lock.yaml pnpm-workspace.yaml /out

FROM base AS deps
COPY --from=manifests /out ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
  pnpm install --frozen-lockfile --filter "@wema/api..."

FROM base AS runtime
ENV NODE_ENV=production PORT=4000
COPY --from=deps /app ./
COPY tsconfig.base.json package.json ./
COPY packages ./packages
COPY apps/api ./apps/api
# Jeu d'exemple du référentiel (commande « seed »).
COPY content ./content
USER node
WORKDIR /app/apps/api
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# node lance directement le serveur (signaux d'arrêt reçus, arrêt propre).
CMD ["node", "--import", "tsx", "src/server.ts"]
