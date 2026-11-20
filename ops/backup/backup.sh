#!/bin/sh
# Sauvegarde automatique : base PostgreSQL (format custom, compresse) + medias (tar.gz).
# Execute en boucle par le service "backup" de docker-compose.
#   BACKUP_INTERVAL_SECONDS (defaut 86400 = quotidien)  BACKUP_RETENTION_DAYS (defaut 14)
# Restauration : ops/backup/restore.sh <horodatage>
set -eu

DIR=/backups
INTERVAL="${BACKUP_INTERVAL_SECONDS:-86400}"
KEEP="${BACKUP_RETENTION_DAYS:-14}"
mkdir -p "$DIR"

run_once() {
  TS=$(date -u +%Y%m%dT%H%M%SZ)
  echo "[backup] debut $TS"
  # dump coherent (transaction unique), format custom : restauration selective possible
  PGPASSWORD="$DB_PASSWORD" pg_dump -h "${DB_HOST:-db}" -U "${DB_USER:-formation}" -d "${DB_NAME:-formation}" \
    --format=custom --compress=6 --file="$DIR/db-$TS.dump.partial"
  mv "$DIR/db-$TS.dump.partial" "$DIR/db-$TS.dump"
  if [ -d /backup-media ]; then
    tar -czf "$DIR/media-$TS.tar.gz.partial" -C /backup-media .
    mv "$DIR/media-$TS.tar.gz.partial" "$DIR/media-$TS.tar.gz"
  fi
  # empreintes : detection d'une copie corrompue avant restauration
  (cd "$DIR" && sha256sum "db-$TS.dump" $( [ -f "media-$TS.tar.gz" ] && echo "media-$TS.tar.gz" ) > "SHA256SUMS-$TS")
  find "$DIR" -type f \( -name 'db-*.dump' -o -name 'media-*.tar.gz' -o -name 'SHA256SUMS-*' \) -mtime +"$KEEP" -delete
  echo "[backup] termine $TS ($(du -sh "$DIR/db-$TS.dump" | cut -f1) base)"
}

if [ "${1:-}" = "--once" ]; then
  run_once
  exit 0
fi
while true; do
  run_once || echo "[backup] ECHEC $(date -u +%FT%TZ)" >&2
  sleep "$INTERVAL"
done
