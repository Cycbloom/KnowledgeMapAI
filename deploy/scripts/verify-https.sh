#!/usr/bin/env bash
# Verify HTTPS chain: Caddy -> envoy -> auth
set -uo pipefail
. /opt/km/secrets.env

echo '--- auth settings over HTTPS (with apikey) ---'
curl -sS -o /dev/null -w 'code=%{http_code}\n' -m 40 -H "apikey: $ANON_KEY" https://supabase.cycbloom.cn/auth/v1/settings

echo '--- app placeholder page ---'
curl -sS -o /dev/null -w 'code=%{http_code}\n' -m 40 https://app.cycbloom.cn/

echo '--- root redirect ---'
curl -sS -o /dev/null -w 'code=%{http_code} loc=%{redirect_url}\n' -m 40 https://cycbloom.cn/

echo '--- cert issuer / subject ---'
echo | openssl s_client -connect supabase.cycbloom.cn:443 -servername supabase.cycbloom.cn 2>/dev/null | openssl x509 -noout -issuer -subject
