#!/usr/bin/env bash
# Sauvegarde de la base Wema, lancée par le service « backup » du compose.
#   (sans argument) : une sauvegarde par jour à BACKUP_AT (UTC), pour toujours ;
#   now             : une sauvegarde tout de suite, puis sortie.
# Format : pg_dump « custom » (compressé), lisible par pg_restore.
# Rotation : les fichiers de plus de BACKUP_KEEP_DAYS jours sont supprimés.
set -euo pipefail

trap 'exit 0' TERM INT
BACKUP_AT="${BACKUP_AT:-03:00}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
DIR=/backups

backup_once() {
  local name tmp
  name="wema-$(date -u +%Y%m%d-%H%M%S).dump"
  tmp="$DIR/.${name}.part"
  pg_dump --format=custom --compress=9 --no-owner --file="$tmp"
  # Une sauvegarde illisible ne doit pas remplacer les bonnes.
  pg_restore --list "$tmp" >/dev/null
  mv "$tmp" "$DIR/$name"
  find "$DIR" -maxdepth 1 -name 'wema-*.dump' -mtime "+$BACKUP_KEEP_DAYS" -delete
  echo "Sauvegarde $name ($(du -h "$DIR/$name" | cut -f1))."
}

if [ "${1:-}" = "now" ]; then
  backup_once
  exit 0
fi

echo "Sauvegarde quotidienne à $BACKUP_AT UTC, conservée $BACKUP_KEEP_DAYS jours."
while true; do
  now=$(date -u +%s)
  next=$(date -u -d "today $BACKUP_AT" +%s)
  [ "$next" -le "$now" ] && next=$(date -u -d "tomorrow $BACKUP_AT" +%s)
  sleep $((next - now)) & wait $!
  backup_once || echo "Sauvegarde : échec (nouvel essai demain)." >&2
done
