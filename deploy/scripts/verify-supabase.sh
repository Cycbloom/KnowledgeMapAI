#!/usr/bin/env bash
# Verify gateway routing + unique keys on the self-hosted stack
set -uo pipefail
. /opt/km/secrets.env
GW="http://127.0.0.1:8000"

echo '--- auth settings (with apikey) ---'
curl -sS -m 10 -H "apikey: $ANON_KEY" "$GW/auth/v1/settings" | head -c 500; echo

echo '--- auth health (with apikey) ---'
curl -sS -m 10 -H "apikey: $ANON_KEY" "$GW/auth/v1/health"; echo

echo '--- REST with OUR anon key ---'
curl -sS -m 10 -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" "$GW/rest/v1/app_settings?select=*&limit=2" | head -c 400; echo

echo '--- REST with PUBLIC demo anon key (expect 401) ---'
curl -sS -m 10 -o /dev/null -w '%{http_code}\n' \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0" \
  "$GW/rest/v1/app_settings?select=*&limit=2"

echo '--- realtime health (with apikey) ---'
curl -sS -m 10 -H "apikey: $ANON_KEY" -o /dev/null -w '%{http_code}\n' \
  -H "Authorization: Bearer $ANON_KEY" "$GW/realtime/v1/api/tenants/realtime-dev/health"

echo '--- storage status (with apikey) ---'
curl -sS -m 10 -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" -o /dev/null -w '%{http_code}\n' "$GW/storage/v1/bucket"
