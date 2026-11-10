#!/usr/bin/env bash
# Restaure une sauvegarde de la base Wema (à lancer sur le serveur, depuis la
# racine du dépôt) :
#   infra/restore.sh infra/backups/wema-20261103-030000.dump
# La base actuelle est REMPLACÉE. L'API et le web sont arrêtés pendant la
# restauration, puis relancés.
set -euo pipefail

file="${1:-}"
if [ -z "$file" ] || [ ! -f "$file" ]; then
  echo "Usage : infra/restore.sh <fichier .dump>" >&2
  echo "Sauvegardes disponibles :" >&2
  ls -1t "$(dirname "$0")/backups"/wema-*.dump 2>/dev/null | head -n 10 >&2 || true
  exit 1
fi

compose=(docker compose -f "$(dirname "$0")/docker-compose.prod.yml")

if [ "${WEMA_RESTORE_YES:-}" != "1" ]; then
  read -r -p "La base actuelle sera remplacée par $(basename "$file"). Continuer ? (oui/non) " answer
  [ "$answer" = "oui" ] || { echo "Abandon."; exit 1; }
fi

echo "Arrêt de l'API et du web…"
"${compose[@]}" stop web api

echo "Recréation de la base…"
"${compose[@]}" exec -T postgres psql -U wema -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS wema WITH (FORCE);" \
  -c "CREATE DATABASE wema OWNER wema;"

echo "Restauration…"
"${compose[@]}" exec -T postgres pg_restore -U wema -d wema --no-owner --exit-on-error <"$file"

echo "Redémarrage de l'API et du web…"
"${compose[@]}" start api web
echo "Restauration terminée."
