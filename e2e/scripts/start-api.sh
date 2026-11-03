#!/usr/bin/env bash
# Démarre l'API des tests e2e sur une base neuve : remise à zéro de la base
# (refusée si son nom ne finit pas par _e2e ou _test), référentiel et exercices
# d'exemple (services/math doit répondre), puis le serveur. Sans --env-file :
# seules les variables passées par playwright.config.ts comptent (jamais la clé
# d'IA du .env de développement).
set -euo pipefail
cd "$(dirname "$0")/../../apps/api"
if [ "${E2E_SKIP_RESET:-}" != "1" ]; then
  pnpm exec tsx src/reset-database.ts
  pnpm exec tsx src/seed.ts
fi
exec pnpm exec tsx src/server.ts
