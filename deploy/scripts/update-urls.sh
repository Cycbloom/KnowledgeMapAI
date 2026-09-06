#!/usr/bin/env bash
# Point Supabase public URLs at the real domain and recreate containers
set -euo pipefail
cd /opt/km/supabase-official

sed -i 's#https://supabase.km.example.com#https://supabase.cycbloom.cn#g' .env
sed -i 's#https://app.km.example.com#https://app.cycbloom.cn#g' .env
sed -i 's#^PROXY_DOMAIN=.*#PROXY_DOMAIN=cycbloom.cn#' .env

echo '--- URLs after update ---'
grep -E '^(SUPABASE_PUBLIC_URL|API_EXTERNAL_URL|SITE_URL|PROXY_DOMAIN)=' .env

echo '--- recreating containers ---'
docker compose -f docker-compose.prod.yml up -d
