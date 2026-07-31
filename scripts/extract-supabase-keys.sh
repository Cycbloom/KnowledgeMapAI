#!/bin/bash
# ============================================================
# extract-supabase-keys.sh
# 从 `supabase status` 输出中提取 Supabase API 密钥（ANON + SERVICE_ROLE + JWT_SECRET），
# 写入 GITHUB_ENV 和 .env.development.local。
#
# 使用方式：
#   source scripts/extract-supabase-keys.sh
#
# 说明：
# - 支持新版 CLI（sb_publishable_ / sb_secret_ 前缀）和旧版 CLI（eyJ... JWT 格式）
# - JWT_SECRET 从 Docker 容器中提取（新 CLI 不在 status 输出中显示）
# ============================================================

set -euo pipefail

STATUS_TEXT=$(supabase status)

# 新版 CLI 格式：sb_publishable_ / sb_secret_ 密钥
ANON_KEY=$(echo "$STATUS_TEXT" | grep -oP 'sb_publishable_[A-Za-z0-9_-]+' | head -1)
SERVICE_KEY=$(echo "$STATUS_TEXT" | grep -oP 'sb_secret_[A-Za-z0-9_-]+' | head -1)

# 旧版 CLI 格式：JWT 密钥（eyJ...），带 "anon key:" / "service_role key:" 标签
if [ -z "$ANON_KEY" ]; then
  ANON_KEY=$(echo "$STATUS_TEXT" | grep -i 'anon' | grep -oP 'eyJ[A-Za-z0-9._-]+' | head -1)
fi
if [ -z "$SERVICE_KEY" ]; then
  SERVICE_KEY=$(echo "$STATUS_TEXT" | grep -i 'service' | grep -oP 'eyJ[A-Za-z0-9._-]+' | head -1)
fi

if [ -z "$SERVICE_KEY" ]; then
  echo "ERROR: 无法提取 service role key"
  echo "=== supabase status output ==="
  echo "$STATUS_TEXT"
  exit 1
fi

echo "ANON_KEY length: ${#ANON_KEY}"
echo "SERVICE_KEY length: ${#SERVICE_KEY}"
echo "ANON_KEY prefix: ${ANON_KEY:0:15}"
echo "SERVICE_KEY prefix: ${SERVICE_KEY:0:15}"

# 从 Docker 容器提取 JWT_SECRET
JWT_SECRET=""
for container in $(docker ps --format "{{.Names}}"); do
  secret=$(docker exec "$container" printenv JWT_SECRET 2>/dev/null || echo "")
  if [ -n "$secret" ]; then
    JWT_SECRET="$secret"
    echo "Found JWT_SECRET in container: $container"
    break
  fi
done
if [ -n "$JWT_SECRET" ]; then
  echo "JWT_SECRET length: ${#JWT_SECRET}"
else
  echo "JWT_SECRET: not found (auth API JWT verification may be limited)"
fi

# 写入 GITHUB_ENV（CI 环境变量）
echo "SUPABASE_URL=http://127.0.0.1:54321" >> $GITHUB_ENV
echo "VITE_SUPABASE_URL=http://127.0.0.1:54321" >> $GITHUB_ENV
echo "VITE_SUPABASE_ANON_KEY=$ANON_KEY" >> $GITHUB_ENV
echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY" >> $GITHUB_ENV
if [ -n "$JWT_SECRET" ]; then
  echo "SUPABASE_JWT_SECRET=$JWT_SECRET" >> $GITHUB_ENV
fi

# 写入 .env.development.local（api/supabase.ts 以 override:true 加载）
echo "VITE_SUPABASE_URL=http://127.0.0.1:54321" > .env.development.local
echo "VITE_SUPABASE_ANON_KEY=$ANON_KEY" >> .env.development.local
echo "SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY" >> .env.development.local
if [ -n "$JWT_SECRET" ]; then
  echo "SUPABASE_JWT_SECRET=$JWT_SECRET" >> .env.development.local
fi