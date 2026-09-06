# 云端部署文档（Cloud Deployment）

> 状态：已上线 | 更新：2026-09-06
> 本文档描述 KnowledgeMap 后端 + Supabase 的云端部署架构、运行方式、客户端接入与日常运维。**不包含任何密钥/密码**（密钥只存在于服务器本地文件）。

## 1. 部署总览

| 项 | 值 |
|---|---|
| 服务器 | 腾讯云上海轻量应用服务器，2 核 4G / 6M 固定带宽，Ubuntu 24.04 |
| 公网 IP | `1.15.174.173`（IPv4） |
| 域名 | `cycbloom.cn`（阿里云注册，域名已实名） |
| 备案 | ⚠️ 服务器在上海（大陆节点），公网 80/443 提供服务**需要 ICP 备案**，建议尽快办理（见 §6） |
| 子域名 | `api.cycbloom.cn`（API）、`supabase.cycbloom.cn`（Supabase 网关）、`app.cycbloom.cn`（Web 前端） |
| HTTPS | Caddy + Let's Encrypt 自动签发/续期 |

### 架构

```
客户端（移动端/桌面/Web）
   │ HTTPS
   ▼
Caddy（:80/:443，自动证书）
   ├─ supabase.cycbloom.cn  → 127.0.0.1:8000  (Envoy 网关 → auth/rest/realtime/storage)
   ├─ api.cycbloom.cn       → 127.0.0.1:3001  (API server, systemd km-api)
   └─ app.cycbloom.cn       → /opt/km/web      (静态前端)
```

## 2. 服务器上的组件

### 2.1 Supabase 栈（Docker Compose）

- 目录：`/opt/km/supabase-official`
- 编排文件：`docker-compose.prod.yml`（精简版：db/auth/rest/realtime/storage/api-gw(envoy)/meta/studio；已裁掉 imgproxy/functions/supavisor）
- 配置：`/opt/km/supabase-official/.env`（含唯一密钥）
- 数据：`volumes/db/data`（Postgres 数据盘）、`volumes/storage`（存储文件）
- 网关绑定 `127.0.0.1:8000`（不对外直接暴露，仅 Caddy 代理）

### 2.2 Supabase Studio 管理控制台（网页后台）

- 地址：`https://studio.cycbloom.cn`（Caddy basic_auth 保护，用户名 `kmstudio`，密码见服务器 `STUDIO_PASSWORD`）
- 用途：可视化浏览表/数据、跑 SQL、管理存储桶等，等同 Supabase 云端 Dashboard
- 服务：`meta`（postgres-meta）+ `studio`，绑定本机 `127.0.0.1:3010`，不对外直连
- 改密码：服务器 `caddy hash-password` 生成新 hash，更新 `/etc/caddy/Caddyfile` 中 `studio.cycbloom.cn` 的 `basic_auth` 后 `systemctl reload caddy`

### 2.3 API Server（systemd）

- 服务名：`km-api`
- 目录：`/opt/km/api`（`api/` 源码 + `shared/` + 精简 `package.json`）
- 运行方式：`tsx --tsconfig tsconfig.api.json api/server.ts`（与本地 dev 一致）
- 环境变量：`/opt/km/api/.env`（NODE_ENV=production，Supabase URL/密钥、FRONTEND_URL 等）
- 监听 `:3001`（UFW 只放行 22/80/443，外部无法直连）

### 2.4 Caddy（HTTPS 反向代理）

- 配置：`/etc/caddy/Caddyfile`
- 服务：`caddy`（systemd 托管，自动申请/续期 Let's Encrypt 证书）
- 已签发域名：`cycbloom.cn`、`api/supabase/app/studio.cycbloom.cn`

### 2.5 密钥与敏感文件（禁止外泄）

| 文件 | 内容 |
|---|---|
| `/opt/km/secrets.env` | `JWT_SECRET`、`ANON_KEY`、`SERVICE_ROLE_KEY`（唯一生成） |
| `/opt/km/supabase-official/.env` | Supabase 栈配置（含 POSTGRES_PASSWORD 等） |
| `/opt/km/api/.env` | API 环境变量（含 `SUPABASE_SERVICE_ROLE_KEY`、`ENCRYPTION_KEY`） |

> `SERVICE_ROLE_KEY` / `JWT_SECRET` / `POSTGRES_PASSWORD` 等为**服务器级机密**，仅存在于服务器。仓库、前端代码、聊天记录中均不得出现。

## 3. 账号与登录

- 登录方式：邮箱 + 密码（显式登录页，首次手动登录一次，之后各端静默重登）
- 单账号跨端：手机 / 桌面 / Web 使用同一账号，数据以 `auth.uid` 关联互通
- 安全配置：
  - 公开注册已关闭（`DISABLE_SIGNUP=true`），防他人注册
  - JWT 有效期 `86400` 秒（24h），自动刷新
  - 邮件自动确认（无 SMTP，不需要发信）
  - 环境变量中保留 `ENABLE_EMAIL_SIGNUP=true` 以允许既有用户密码登录（注意：不可关闭，否则无法登录）

## 4. 客户端接入配置

### 4.1 移动端（Capacitor Android）

项目根目录创建 `.env.mobile`：

```
VITE_SUPABASE_URL=https://supabase.cycbloom.cn
VITE_SUPABASE_ANON_KEY=<ANON_KEY，见服务器 /opt/km/secrets.env>
VITE_API_BASE_URL=https://api.cycbloom.cn/api/v1
```

打包：

```bash
npm run mobile:build:debug      # 调试 APK
npm run mobile:build:release    # 正式 APK
```

> 移动端构建模式为 `mobile`（非 development/test），认证走**显式登录**逻辑。

### 4.2 Web 前端（app.cycbloom.cn）

项目根目录创建 `.env.production`：

```
VITE_SUPABASE_URL=https://supabase.cycbloom.cn
VITE_SUPABASE_ANON_KEY=<ANON_KEY>
VITE_API_BASE_URL=https://api.cycbloom.cn/api/v1
```

构建并部署（`dist/` 上传到服务器 `/opt/km/web/`，Caddy 已配 SPA 回退）：

```bash
npm run build
# 将 dist/* 同步到服务器 /opt/km/web/
```

### 4.3 桌面端（Electron）

桌面端默认打包自带本地 API server，切云端仅需让打包时注入的 `.env.production` 指向云端 Supabase：

```
VITE_SUPABASE_URL=https://supabase.cycbloom.cn
VITE_SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>   # 仅随 Electron 包内 API 使用，非打包前端
SUPABASE_JWT_SECRET=<JWT_SECRET>
ENCRYPTION_KEY=<与服务器一致或新生成>
PORT=3001
FRONTEND_URL=https://app.cycbloom.cn
NODE_ENV=production
```

桌面端本地 SyncEngine 仍走 `localhost` → 本地 API → 云端 Supabase，数据即可上云同步。

## 5. 日常运维

### SSH 登录

```bash
ssh -i C:\Users\金\.ssh\km-deploy root@1.15.174.173
```

### API server

```bash
systemctl status km-api          # 状态
systemctl restart km-api         # 重启
journalctl -u km-api -f          # 实时日志
```

### Supabase 栈

```bash
cd /opt/km/supabase-official
docker compose -f docker-compose.prod.yml ps                 # 容器状态
docker compose -f docker-compose.prod.yml logs -f --tail=100 # 日志
docker compose -f docker-compose.prod.yml up -d              # 修改 .env/compose 后应用
docker compose -f docker-compose.prod.yml down               # 停止（数据保留）
```

### 备份与恢复

- 每日 03:30 自动备份（cron），输出到 `/opt/km/data/backups/`
- 手动备份：`/opt/km/backup.sh`
- 备份内容：Postgres 逻辑 dump（`db-*.sql.gz`）、API 上传文件（`uploads-*.tar.gz`）、密钥配置（`config-*.tar.gz`），保留 7 天
- 恢复示例（数据库）：

```bash
gunzip -c /opt/km/data/backups/db-<时间戳>.sql.gz | docker exec -i supabase-db psql -U postgres -d postgres
```

### 更新

- **API 代码**：本地仓库 `deploy/scripts/deploy-api.sh` 已保存部署脚本；改代码后同步 `api/`、`shared/` 到 `/opt/km/api`，重跑脚本即可（脚本幂等，保留已有 `.env` 的 ENCRYPTION_KEY）。
- **数据库迁移**：修改 `supabase/migrations/` 后，将新 SQL 应用到云端（`docker exec -i supabase-db psql -U postgres -d postgres < 新迁移.sql`）。
- **Supabase 镜像/配置**：修改 `/opt/km/supabase-official/.env` 或 `docker-compose.prod.yml` 后 `docker compose -f docker-compose.prod.yml up -d`。

## 6. 安全要点

- UFW 仅放行 22/80/443；Supabase 网关与 API 均不对外直连（仅 Caddy 代理）
- 公开的 Supabase demo 密钥已在网关层被拒（401）
- 公开注册关闭；admin 接口仅 service_role 可用
- 密钥分级：ANON_KEY 可进客户端；SERVICE_ROLE_KEY / JWT_SECRET / POSTGRES_PASSWORD 只留在服务器
- 建议定期下载 `/opt/km/data/backups/` 到本地异地保存
- **ICP 备案**：服务器在上海（大陆节点），用 `cycbloom.cn` 提供 80/443 公网服务按法规需 ICP 备案。当前服务可正常运行，但存在被云厂商暂停访问/不合规的风险，建议尽快在阿里云控制台办理备案（个人备案，周期约 1-3 周）；备案期间不影响已有访问

## 7. 故障排查

| 现象 | 处理 |
|---|---|
| 手机/浏览器 443 连不上 | 检查腾讯云控制台防火墙是否放行 TCP 443（来源 `0.0.0.0/0`，注意不是 IPv6） |
| API 返回 5xx | `journalctl -u km-api -n 200` 看错误 |
| 登录提示「Email logins are disabled」 | 检查 `/opt/km/supabase-official/.env` 中 `ENABLE_EMAIL_SIGNUP=true`（不能为 false）后 `up -d` |
| Web 控制台报 `Cannot access 'z5' before initialization`（mermaid） | mermaid 与 d3 的跨 chunk 循环导致（TDZ）。已修复：`vite.config.ts` 将 d3/dagre/graphlib 合并回 `vendor-mermaid` chunk（见该文件注释）。重新 `npx vite build --mode production` 部署即可；构建后可用 `deploy/scripts/check-all-cycles.cjs` 检测是否残留跨 chunk 循环 |
| HTTPS 证书过期 | Caddy 自动续期；`journalctl -u caddy -n 50` 排查 |
| 数据不一致 | 用备份恢复；确认各端使用同一账号 |
| Web 端请求 `/api/v1/*` 返回 405 / Dashboard 报 `i.map is not a function` | Web 端 API 客户端固定用**同源** `/api/v1`（见 `src/services/api/createApiClient.ts`，仅移动端走 `VITE_API_BASE_URL`）。因此 `app.cycbloom.cn` 必须把 `/api/*` 反代到 API server（`deploy/Caddyfile` 中 `handle /api/* { reverse_proxy 127.0.0.1:3001 }`），否则静态文件服务器对 POST 返回 405、查询返回空、Dashboard 崩溃。已配置，重新部署时勿删 |

## 8. 仓库内部署产物

`deploy/` 目录存放可复用脚本（本地）：

| 脚本 | 用途 |
|---|---|
| `deploy/scripts/gen-keys.cjs` | 生成唯一 JWT/anon/service_role 密钥 |
| `deploy/scripts/setup-env.sh` | 生成 Supabase `.env` |
| `deploy/scripts/apply-migrations.sh` | 按序应用 `supabase/migrations/*.sql` |
| `deploy/scripts/deploy-api.sh` | 部署/更新 API server（装依赖+写 env+systemd） |
| `deploy/scripts/backup.sh` | 每日备份（服务器端 `/opt/km/backup.sh`） |
| `deploy/scripts/verify-supabase.sh` / `verify-https.sh` / `verify-auth-flow.sh` | 部署后验证 |
| `deploy/supabase-official/docker-compose.prod.yml` | 精简版 Supabase 编排模板 |
| `deploy/Caddyfile` | Caddy 反代配置模板 |
