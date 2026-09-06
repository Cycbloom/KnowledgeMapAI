#!/usr/bin/env bash
# Verify authed web API flow through app.cycbloom.cn (same-origin /api/v1)
set -uo pipefail
. /opt/km/secrets.env
EMAIL="1756138655@qq.com"
PASS="Jin116688"
GW="http://127.0.0.1:8000"

TOKEN=$(curl -sS -m 15 -X POST "$GW/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).access_token||'')}catch{console.log('')}})")

echo "token len: ${#TOKEN}"
echo '--- GET /api/v1/scheduler/today-brief with JWT ---'
curl -sS -m 15 -H "Authorization: Bearer $TOKEN" -o /dev/null -w 'code=%{http_code}\n' \
  https://app.cycbloom.cn/api/v1/scheduler/today-brief

echo '--- GET /api/v1/achievements/daily-tasks with JWT ---'
curl -sS -m 15 -H "Authorization: Bearer $TOKEN" -o /dev/null -w 'code=%{http_code}\n' \
  https://app.cycbloom.cn/api/v1/achievements/daily-tasks

echo '--- body sample ---'
curl -sS -m 15 -H "Authorization: Bearer $TOKEN" \
  https://app.cycbloom.cn/api/v1/scheduler/today-brief | head -c 300; echo
