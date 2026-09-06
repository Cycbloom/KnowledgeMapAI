#!/usr/bin/env bash
# Daily backup: postgres dump + uploads + secrets, keep last 7 days
set -uo pipefail

BACKUP_DIR="/opt/km/data/backups"
STAMP="$(date +%Y%m%d-%H%M)"
mkdir -p "$BACKUP_DIR"

# 1. Postgres logical dump (schema + data) of the supabase database
docker exec supabase-db pg_dump -U postgres -d postgres --no-owner > "${BACKUP_DIR}/db-${STAMP}.sql" 2>/dev/null
gzip -f "${BACKUP_DIR}/db-${STAMP}.sql"

# 2. API uploads (notes images etc.)
if [ -d /opt/km/api/public/uploads ]; then
  tar -czf "${BACKUP_DIR}/uploads-${STAMP}.tar.gz" -C /opt/km/api/public uploads 2>/dev/null
fi

# 3. Secrets + env (restore guides)
tar -czf "${BACKUP_DIR}/config-${STAMP}.tar.gz" \
  -C /opt/km/secrets.env /opt/km/secrets.env \
  -C /opt/km/supabase-official .env \
  -C /opt/km/api .env 2>/dev/null || true

# 4. Prune backups older than 7 days
find "$BACKUP_DIR" -name 'db-*.sql*' -mtime +7 -delete
find "$BACKUP_DIR" -name 'uploads-*.tar.gz' -mtime +7 -delete
find "$BACKUP_DIR" -name 'config-*.tar.gz' -mtime +7 -delete

echo "backup done: $STAMP"
ls -lh "$BACKUP_DIR" | tail -n 5
