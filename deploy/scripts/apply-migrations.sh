#!/usr/bin/env bash
# Apply app migrations to supabase-db in order
set -uo pipefail

MIGRATIONS_DIR="${1:-/opt/km/supabase/migrations}"
LOG="${2:-/opt/km/migrate.log}"
: > "$LOG"
FAILED=0

for f in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
  name="$(basename "$f")"
  echo "== $name ==" >> "$LOG"
  if docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < "$f" >> "$LOG" 2>&1; then
    echo "OK  $name" >> "$LOG"
  else
    echo "FAIL $name" >> "$LOG"
    FAILED=1
    break
  fi
done

echo "DONE failed=$FAILED" >> "$LOG"
echo "last lines:"
tail -n 8 "$LOG"
exit $FAILED
