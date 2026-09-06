#!/usr/bin/env bash
# Fix email login + clean leftover test user
set -uo pipefail
cd /opt/km/supabase-official
sed -i 's/^ENABLE_EMAIL_SIGNUP=false/ENABLE_EMAIL_SIGNUP=true/' .env
echo '--- auth flags ---'
grep -E '^(DISABLE_SIGNUP|ENABLE_EMAIL_SIGNUP|ENABLE_EMAIL_AUTOCONFIRM)=' .env
docker compose -f docker-compose.prod.yml up -d >/tmp/recreate.log 2>&1
echo '--- cleanup leftover test user ---'
docker exec supabase-db psql -U postgres -d postgres -c "delete from auth.users where email like 'test-%@km.test'; delete from public.users where id in (select id from auth.users where email like 'test-%@km.test');" 2>&1 | tail -3
echo '--- wait for auth healthy ---'
for i in $(seq 1 12); do
  st=$(docker inspect --format '{{.State.Health.Status}}' supabase-auth 2>/dev/null || echo gone)
  [ "$st" = "healthy" ] && break
  sleep 5
done
echo "auth status: $st"
