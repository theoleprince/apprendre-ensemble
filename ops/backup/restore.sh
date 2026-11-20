#!/bin/sh
# Restauration d'une sauvegarde (base + medias). A lancer dans le conteneur "backup" :
#   docker compose exec backup sh /ops/restore.sh 20261119T020000Z
# ATTENTION : remplace le contenu actuel de la base et des medias. Arreter le service "backend" avant.
set -eu

TS="${1:?Usage : restore.sh <horodatage>  (voir ls /backups)}"
DIR=/backups
[ -f "$DIR/db-$TS.dump" ] || { echo "Sauvegarde introuvable : $DIR/db-$TS.dump" >&2; exit 1; }

echo "[restore] verification des empreintes"
(cd "$DIR" && sha256sum -c "SHA256SUMS-$TS")

echo "[restore] base de donnees"
PGPASSWORD="$DB_PASSWORD" pg_restore -h "${DB_HOST:-db}" -U "${DB_USER:-formation}" -d "${DB_NAME:-formation}" \
  --clean --if-exists --no-owner --single-transaction "$DIR/db-$TS.dump"

if [ -f "$DIR/media-$TS.tar.gz" ] && [ -d /backup-media ]; then
  echo "[restore] medias"
  find /backup-media -mindepth 1 -delete
  tar -xzf "$DIR/media-$TS.tar.gz" -C /backup-media
fi
echo "[restore] termine : redemarrez le service backend"
