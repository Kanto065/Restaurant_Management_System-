#!/usr/bin/env bash
# Nightly Postgres backup: dumps, compresses, prunes local copies older than 7 days.
# Intended to run via cron on the VPS; ship BACKUP_DIR off-box separately (rsync/rclone).
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/platform-postgres}"
CONTAINER="${POSTGRES_CONTAINER:-platform-postgres-1}"
DB_NAME="${POSTGRES_DB:-platform}"
DB_USER="${POSTGRES_USER:-platform}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

mkdir -p "$BACKUP_DIR"

docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +7 -delete

echo "Backed up $DB_NAME to $BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"
