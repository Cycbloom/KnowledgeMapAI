#!/usr/bin/env bash
# Fetch official Supabase self-hosted docker files, with mirror fallback
set -euo pipefail

DEST="${1:-/opt/km/supabase-official}"
BASE_DIR="https://raw.githubusercontent.com/supabase/supabase/master/docker"
MIRROR_PREFIX="https://ghfast.top/"

mkdir -p "${DEST}/volumes/api/envoy" "${DEST}/volumes/db"

fetch_file() {
  local rel="$1"
  local out="$2"
  local direct="${BASE_DIR}/${rel}"
  local via_mirror="${MIRROR_PREFIX}${BASE_DIR}/${rel}"
  if curl -4 -sS -m 40 -o "${out}" "${direct}"; then
    echo "OK  ${rel} (direct)"
  elif curl -4 -sS -m 60 -o "${out}" "${via_mirror}"; then
    echo "OK  ${rel} (mirror)"
  else
    echo "FAIL ${rel}"
    return 1
  fi
}

fetch_file "docker-compose.yml" "${DEST}/docker-compose.yml"
fetch_file ".env.example" "${DEST}/.env.example"

for f in \
  api/envoy/envoy.yaml \
  api/envoy/cds.yaml \
  api/envoy/lds.template.yaml \
  api/envoy/docker-entrypoint.sh \
  db/realtime.sql \
  db/webhooks.sql \
  db/roles.sql \
  db/jwt.sql \
  db/_supabase.sql \
  db/logs.sql \
  db/pooler.sql
do
  fetch_file "volumes/${f}" "${DEST}/volumes/${f}" || true
done

echo "--- sizes ---"
find "${DEST}" -type f -printf '%s %p\n' | sort -n
