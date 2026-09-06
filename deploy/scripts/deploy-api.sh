#!/usr/bin/env bash
# Deploy KnowledgeMap API server: deps + env + systemd
set -euo pipefail

cd /opt/km/api

echo '--- writing trimmed package.json (API-only deps) ---'
rm -f /opt/km/api/package-lock.json
cat > /opt/km/api/package.json <<'EOF'
{
  "name": "knowledgemap-api",
  "version": "1.0.1",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20.0.0" },
  "dependencies": {
    "@supabase/supabase-js": "^2.111.0",
    "axios": "^1.19.0",
    "cheerio": "^1.2.0",
    "compression": "^1.8.1",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dotenv": "^17.3.1",
    "express": "^4.22.1",
    "express-async-errors": "^3.1.1",
    "fflate": "^0.8.3",
    "helmet": "^8.3.0",
    "i18next": "^26.3.6",
    "jsonwebtoken": "^9.0.3",
    "lru-cache": "^11.5.1",
    "multer": "^2.2.0",
    "openai": "^4.104.0",
    "pdf-parse": "^2.4.5",
    "pdfkit": "^0.17.2",
    "pg": "^8.22.0",
    "swagger-jsdoc": "^6.0.3",
    "ts-fsrs": "^5.4.1",
    "ws": "^8.21.1",
    "zod": "^3.25.76"
  }
}
EOF
cat > /opt/km/api/.npmrc <<'EOF'
registry=https://mirrors.cloud.tencent.com/npm/
EOF
echo '--- installing deps ---'
npm install --no-audit --no-fund >/opt/km/api/npm-install.log 2>&1 || { echo "npm install failed"; tail -n 20 /opt/km/api/npm-install.log; exit 1; }
echo 'npm install OK'

echo '--- installing tsx ---'
npm i -g tsx >/dev/null 2>&1
TSX="$(command -v tsx)"
echo "tsx at: $TSX"

echo '--- building .env ---'
. /opt/km/secrets.env
if [ ! -f /opt/km/api/.env ]; then
  ENC_KEY="$(openssl rand -base64 24)"
else
  ENC_KEY="$(grep '^ENCRYPTION_KEY=' /opt/km/api/.env | cut -d= -f2-)"
fi
cat > /opt/km/api/.env <<EOF
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://app.cycbloom.cn
VITE_SUPABASE_URL=https://supabase.cycbloom.cn
VITE_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
SUPABASE_JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENC_KEY}
CACHE_BACKEND=memory
RATE_LIMIT_STORE=memory
EVENT_BUS_BACKEND=memory
DEEPSEEK_API_KEY=
VITE_DEEPSEEK_API_KEY=
VOLCENGINE_API_KEY=
VITE_VOLCENGINE_API_KEY=
ALIYUN_API_KEY=
VITE_ALIYUN_API_KEY=
ALIYUN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
EOF
chmod 600 /opt/km/api/.env
echo '.env written (grep -c):'
grep -c '=' /opt/km/api/.env

echo '--- creating systemd unit ---'
cat > /etc/systemd/system/km-api.service <<EOF
[Unit]
Description=KnowledgeMap API server
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
WorkingDirectory=/opt/km/api
Environment=NODE_ENV=production
EnvironmentFile=/opt/km/api/.env
ExecStart=${TSX} --tsconfig /opt/km/api/tsconfig.api.json /opt/km/api/api/server.ts
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable km-api >/dev/null 2>&1
systemctl start km-api
sleep 6
echo '--- status ---'
systemctl is-active km-api
echo '--- port check ---'
ss -tlnp | grep ':3001' || echo '3001 not listening yet'
