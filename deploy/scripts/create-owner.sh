#!/usr/bin/env bash
# Create the owner account and verify login
set -uo pipefail
. /opt/km/secrets.env
GW="http://127.0.0.1:8000"
EMAIL="1756138655@qq.com"
PASS="Jin116688"

echo '--- create owner (admin API) ---'
CREATE=$(curl -sS -m 15 -X POST "$GW/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"email_confirm\":true,\"user_metadata\":{\"name\":\"Owner\"}}")
echo "$CREATE" | head -c 400; echo
OID=$(echo "$CREATE" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).id||'')}catch{console.log('')}})")
echo "owner id: $OID"

echo '--- password login verify ---'
curl -sS -m 15 -X POST "$GW/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | head -c 400; echo

echo '--- profile row (trigger-created) ---'
docker exec supabase-db psql -U postgres -d postgres -tAc "select id, email, name from public.users where email='$EMAIL';"
