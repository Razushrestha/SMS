#!/usr/bin/env bash
set -euo pipefail
# Daily: 0 2 * * * /var/www/nepatronix-sms/deploy/backup-db.sh
# Load POSTGRES_* from the app .env
set -a
# shellcheck disable=SC1091
source /var/www/nepatronix-sms/.env
set +a
DEST=/var/backups/nepatronix
mkdir -p "$DEST"
FILE="$DEST/nepatronix-$(date +%F).sql.gz"
PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump -h 127.0.0.1 -U "${POSTGRES_USER:-nepatronix}" "${POSTGRES_DB:-nepatronix}" | gzip > "$FILE"
find "$DEST" -name "nepatronix-*.sql.gz" -mtime +14 -delete
echo "Wrote $FILE"
