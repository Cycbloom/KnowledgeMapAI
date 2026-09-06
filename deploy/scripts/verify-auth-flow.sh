#!/usr/bin/env bash
# Validate auth flow: admin create user -> password login -> REST with JWT -> cleanup
set -uo pipefail
. /opt/km/secrets.env
GW="http://127.0.0.1:8000"
EMAIL="test-$(date +%s)@km.test"
PASS="Test@12345678a"

echo '--- create test user (admin) ---'
CREATE=$(curl -sS -m 15 -X POST "$GW/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\",\"email_confirm\":true,\"user_metadata\":{\"name\":\"Test\"}}")
echo "$CREATE" | head -c 300; echo
TUSER=$(echo "$CREATE" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).id||'')}catch{console.log('')}})")

echo '--- password login ---'
LOGIN=$(curl -sS -m 15 -X POST "$GW/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
echo "$LOGIN" | head -c 300; echo
TOKEN=$(echo "$LOGIN" | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).access_token||'')}catch{console.log('')}})")

echo '--- REST with user JWT (expect 200/403, NOT 401) ---'
CODE=$(curl -sS -m 15 -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN" \
  -o /dev/null -w '%{http_code}' "$GW/rest/v1/users?select=id&limit=1")
echo "rest_code=$CODE"

echo '--- cleanup test user ---'
if [ -n "$TUSER" ]; then
  curl -sS -m 15 -X DELETE "$GW/auth/v1/admin/users/$TUSER" \
    -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" -o /dev/null -w 'delete=%{http_code}\n'
  docker exec supabase-db psql -U postgres -d postgres -c "delete from public.users where id='$TUSER';" >/dev/null 2>&1 || true
fi
