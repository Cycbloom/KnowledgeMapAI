# 开发指南

> 本文档面向 KnowledgeMap 项目的新开发者，目标是在 30 分钟内完成环境搭建并开始开发。
>
> 完整项目规范见 [`.trae/rules/project_rules.md`](./.trae/rules/project_rules.md)，API 命名规范见 [`.trae/rules/api-naming-conventions.md`](./.trae/rules/api-naming-conventions.md)，测试规范见 [`docs/testing-guidelines.md`](./docs/testing-guidelines.md)，贡献流程见 [`CONTRIBUTING.md`](./CONTRIBUTING.md)。

---

## 1. 环境准备

### 1.1 系统要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 20.0.0 | 项目根目录 `.nvmrc` 指定版本 20，推荐使用 nvm 管理 |
| npm | 随 Node 安装 | 包管理器（项目未适配 pnpm/yarn） |
| Docker Desktop | 最新稳定版 | 本地 Supabase 依赖 Docker 运行 |
| Supabase CLI | 最新版 | 本地数据库管理 |
| Git | >= 2.30 | 版本控制 |

### 1.2 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/Cycbloom/KnowledgeMapAI.git
cd KnowledgeMapAI

# 2. 切换 Node 版本（如使用 nvm）
nvm use

# 3. 安装依赖（postinstall 会自动执行 electron-rebuild 编译原生模块）
npm install

# 4. 安装 Playwright 浏览器（用于 E2E 测试）
npx playwright install
```

### 1.3 环境变量配置

复制示例文件并填入实际值：

```bash
cp .env.example .env.development
```

必填项校验（运行后自动报告缺失或占位符变量）：

```bash
npm run check:env
```

必填变量一览：

| 变量 | 用途 | 获取方式 |
|------|------|---------|
| `VITE_SUPABASE_URL` | Supabase 项目 URL | 本地：`http://127.0.0.1:54321`；生产：Supabase Dashboard |
| `VITE_SUPABASE_ANON_KEY` | Supabase 公共匿名密钥（前端可暴露） | `supabase status` 输出 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 服务端密钥（仅服务端使用） | `supabase status` 输出 |
| `SUPABASE_JWT_SECRET` | JWT 验证密钥（requireAuth 中间件） | 本地默认 `super-secret-jwt-token-with-at-least-32-characters-long` |
| AI Provider Key（任一） | AI 功能密钥 | DeepSeek / 火山引擎 / 阿里云 DashScope |

### 1.4 启动本地数据库

本地开发使用 Supabase CLI 管理 Docker 容器化的 PostgreSQL：

```bash
# 启动本地 Supabase（首次启动会拉取 Docker 镜像）
npm run db:local:start

# 初始化数据库（应用全部 schema + seed）
npm run db:local:reset
```

启动后通过 `npm run db:local:status` 查看服务地址：

| 服务 | 地址 | 说明 |
|------|------|------|
| API 网关 | http://127.0.0.1:54321 | Supabase API |
| Studio | http://127.0.0.1:54323 | 数据库管理界面 |
| PostgreSQL | localhost:54322 | 直连数据库（postgres/postgres） |
| Inbucket | http://127.0.0.1:54324 | 邮件测试服务 |

> 实际端口以 `supabase status` 输出为准。

### 1.5 专属用户（无感知会话）

应用为单用户工具，不存在测试账号或登录表单：

- 首次启动进入设置向导，完成 Supabase 配置后自动创建一个专属用户（邮箱形如 `owner-{uuid}@local.app`，随机凭证保存在浏览器 localStorage，key 为 `km-owner-credentials`），随后直达首页
- 之后启动自动恢复会话；凭证失效时用本地凭证静默重登，全程无感
- `npm run db:seed` **不依赖前端先启动**：会优先复用已存在的 `owner-*@local.app` 用户；若用户已存在但密码未知则自动重置（bcrypt）；若用户不存在则直接在 `auth.users` 中创建同格式账号。运行结束会在终端打印 DevTools localStorage 注入命令，并把可复现凭证落盘到 `.seed-owner-credentials.json`（已在 `.gitignore` 中忽略）

> 注入命令用法：启动 Web/Electron 应用 → F12 打开 DevTools Console → 粘贴 seed 末尾打印的 3 行命令（`localStorage.clear(); setItem(...); location.reload();`）即可自动登入同一 owner，看到 seed 写入的全部演示数据（图谱、卡片、任务、成就等）。

### 1.6 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173 即可使用。完成上述全部步骤通常在 30 分钟内。

### 1.7 方式二：Docker 开发（Web 模式）

前端和后端运行在 Docker 容器中（支持热重载），宿主机运行 `supabase start` 提供本地 Supabase 服务。

#### 前置条件

- Docker Desktop（最新稳定版）
- Supabase CLI（最新版，宿主机安装）

#### 启动步骤

```bash
# 1. 宿主机启动本地 Supabase
supabase start

# 2. 配置环境
cp .env.example .env
# 编辑 .env 填写 Supabase 和其他必要配置
# 开发模式：VITE_SUPABASE_URL=http://host.docker.internal:54321

# 3. 首次构建（后续无需 --no-cache）
docker-compose build --no-cache

# 4. 启动服务
docker-compose up -d

# 5. 查看日志
docker-compose logs -f
```

#### 服务访问地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端 | http://localhost:5173 | Vite 开发服务器（HMR 热重载） |
| 后端 API | http://localhost:3001 | Express API（nodemon 热重载） |
| Supabase API 网关 | http://127.0.0.1:54321 | 宿主机 Supabase API |
| Supabase Studio | http://127.0.0.1:54323 | 数据库管理界面（宿主机直接访问） |

前端 API 代理：通过 Vite proxy 自动转发 `/api` 请求到后端。

#### 生产环境部署

修改 `.env` 中的 `VITE_SUPABASE_URL` 为远程 Supabase 实例地址：

```bash
VITE_SUPABASE_URL=https://你的项目.supabase.co
```

然后重启容器：

```bash
docker-compose restart backend
```

---

## 2. 开发命令

### 2.1 开发模式

| 命令 | 说明 |
|------|------|
| `npm run dev` | 同时启动前端（Vite）和后端（API）开发服务器（Web 模式）。Docker 开发模式见 [1.7 方式二：Docker 开发](#17-方式二docker-开发)。 |
| `npm run client:dev` | 仅启动前端 Vite 开发服务器（端口 5173） |
| `npm run server:dev` | 仅启动后端 API 开发服务器（nodemon + tsx，端口 3001） |
| `npm run electron:dev` | 启动 Electron 桌面应用开发模式（同时拉起前后端 + Electron 主进程） |

### 2.2 构建

| 命令 | 说明 |
|------|------|
| `npm run build` | Web 生产构建（`tsc -b` + `vite build`） |
| `npm run build:electron` | Electron 构建准备（编译 TS + Vite 构建） |
| `npm run build:analyze` | 构建并生成包体积分析报告 |
| `npm run electron:build` | 构建所有平台 Electron 应用 |
| `npm run electron:build:win` | 构建 Windows 应用（NSIS + portable） |
| `npm run electron:build:mac` | 构建 macOS 应用（dmg + zip） |
| `npm run electron:build:linux` | 构建 Linux 应用（AppImage + deb） |

### 2.3 预览

```bash
npm run preview    # 预览 Web 生产构建结果
```

### 2.4 完整脚本清单

运行 `npm run`（不带参数）可列出 `package.json` 中所有可用脚本，包括移动端（Capacitor）、数据库工具、i18n 检查、图标生成等。完整脚本定义见 [`package.json`](./package.json) 的 `scripts` 字段。

---

## 3. 架构概览

### 3.1 目录结构

```
KnowledgeMap/
├── api/                    # 后端 API 服务（Express）
│   ├── routes/            # 路由层（按业务域分目录：graphs、scheduler、ai 等）
│   ├── services/          # 业务逻辑层（含 ai、graph、scheduler、study、notes 等）
│   ├── middleware/        # 中间件（auth、validate、rateLimiter、errorHandler）
│   ├── schemas/           # Zod 校验 schema
│   ├── utils/             # 工具函数（logger、retry、rrf 等）
│   └── server.ts          # API 服务入口
├── electron/              # Electron 桌面端
│   ├── main.ts            # 主进程入口
│   ├── preload.ts         # 预加载脚本
│   ├── ipc/               # IPC 处理器
│   ├── db/                # 本地 SQLite 数据库
│   └── sync/              # 数据同步引擎
├── src/                   # 前端源码（React 18）
│   ├── components/        # React 组件
│   ├── pages/             # 页面组件
│   ├── hooks/             # 自定义 Hooks
│   ├── services/api/      # API 客户端层（graphsApi、nodesApi 等）
│   ├── store/             # Zustand 状态管理
│   └── utils/             # 工具函数（唯一工具目录，原 lib/ 已并入）
├── shared/                # 前后端共享代码（核心模块）
│   ├── types/             # 共享类型定义（含 database.generated.ts）
│   ├── sync/              # 同步算法（operationMerger、conflictResolver）
│   ├── utils/             # 共享工具（blockRef、retry、wikiLink）
│   └── kernel/            # 内核接口定义
├── supabase/              # 数据库配置
│   └── migrations/        # 模块化 SQL 迁移文件
├── tests/                 # 共享测试基础设施
│   ├── helpers/           # mock 工厂、Faker 工厂、Provider 包装器
│   ├── setup/             # MSW handlers、server
│   └── database/          # pgTAP SQL 测试
├── e2e/                   # Playwright E2E 测试
│   ├── pages/             # Page Object
│   └── helpers/           # E2E 工具（auth、aiMock）
├── scripts/               # 工具脚本（check-env、seed、db:gen-types 等）
├── docs/                  # 项目文档
└── public/                # 静态资源
```

### 3.2 技术栈

**前端**：React 18 + Vite 6 + TypeScript 5.8 + Tailwind CSS + Zustand 5 + TanStack Query 5 + React Router 7 + Three.js（3D 可视化）+ D3.js（图布局）+ Mermaid + TipTap（富文本）+ Framer Motion

**后端**：Node.js + Express 4 + Supabase（PostgreSQL）+ Swagger（API 文档）+ Zod（schema 校验）

**Electron 桌面端**：Electron 41 + electron-builder + electron-updater + better-sqlite3（本地存储）

**AI 集成**：OpenAI SDK（支持 DeepSeek、火山引擎、阿里云 DashScope、智谱）

**数据库**：PostgreSQL + pgvector（向量搜索）+ pg_trgm（全文搜索）+ RLS（行级安全）

### 3.3 Electron 主进程模块

Electron 桌面应用的核心代码位于 `electron/` 目录，由以下模块组成：

| 模块 | 职责 |
|------|------|
| `electron/main.ts` | 应用入口，负责 app 生命周期、单实例锁、IPC handler 注册编排、深度链接、菜单注册、安全强化 |
| `electron/preload.ts` | 通过 `contextBridge.exposeInMainWorld` 暴露 `electronAPI` 给 renderer，所有 IPC 通道在此声明 |
| `electron/ipc/` | 按域分文件注册 `ipcMain.handle`，含 channel 白名单校验（app/window/shell/update/config/db/sync/dialog/power/deepLink） |
| `electron/utils/` | 工具模块：`windowManager`（多窗口管理）、`trayManager`（系统托盘）、`windowStateManager`（窗口状态持久化）、`powerManager`（电源阻塞器）、`appMenu`（原生应用菜单）、`logger`（日志） |
| `electron/sync/syncEngine.ts` | 本地 SQLite 与云端 Supabase 双向同步引擎 |
| `electron/db/` | better-sqlite3 封装，提供本地数据库 schema 与迁移 |

**模块依赖规则**：
- `main.ts` 是唯一编排入口，可依赖所有其他模块
- `ipc/` handlers 通过依赖注入接收 `getMainWindow` / `getSyncEngine` 等回调，避免循环依赖
- `utils/` 模块互相独立，仅在需要时通过显式 import 依赖（如 `powerManager` 不依赖 `windowManager`）
- `preload.ts` 与 `main.ts` 通过 IPC channel 名称耦合，新增 channel 必须同步修改两处并加入 `IPC_HANDLE_CHANNELS` 白名单

**安全约束**：
- `contextIsolation: true`，`nodeIntegration: false`，`sandbox: true`
- 所有 `ipcMain.handle` 调用经过白名单校验（`IPC_HANDLE_CHANNELS` Set）
- `webContents.on("will-navigate")` 拦截非主 URL 跳转
- `session.defaultSession.setPermissionRequestHandler` 仅允许 clipboard 类权限

### 3.4 模块依赖规则（重要）

项目采用 **TypeScript Project References** 强制模块依赖方向，配置在根 [`tsconfig.json`](./tsconfig.json)：

```
tsconfig.json (根，仅聚合)
├── tsconfig.shared.json   # shared/ - 共享层，无外部依赖
├── tsconfig.api.json      # api/ - 依赖 shared/
└── tsconfig.src.json      # src/ - 依赖 shared/
```

**强制规则**：

- `shared/` 目录：完全独立，**不依赖** `api/`、`src/`、`electron/`
- `api/` 目录：只能依赖 `shared/`，**不能依赖 `src/`**
- `src/` 目录：只能依赖 `shared/`，**不能依赖 `api/`**
- `electron/` 目录：可依赖 `api/` 和 `shared/`（通过 `tsconfig.electron.json` 的 `rootDirs` 配置聚合）

路径别名（在 [`tsconfig.base.json`](./tsconfig.base.json) 中定义）：

- `@/*` → `./src/*`
- `@shared/*` → `./shared/*`

违反依赖方向会导致 `npm run check` 失败。

### 3.5 TypeScript Project References

项目使用 `tsc --build` 增量编译模式，每个子项目通过 `composite: true` 和 `.tsbuildinfo` 文件记录编译状态：

| 命令 | 用途 | 场景 |
|------|------|------|
| `npm run check` | 增量类型检查（自动跳过未变更子项目） | **开发时推荐** |
| `npm run check:full` | 强制全量检查（`--force` 忽略 `.tsbuildinfo`） | CI / 疑难问题排查 |
| `npm run check:electron` | 单独检查 Electron 子项目（`tsconfig.electron.json`） | Electron 开发时 |

---

## PWA 与离线策略

### 概述

KnowledgeMap Web 端通过 VitePWA + Workbox 提供 PWA 能力，支持离线访问、可安装、SW 自动更新。Electron 桌面端不注册 SW（`!isElectron` 判断），离线能力依赖本地 SQLite。

### Service Worker 策略

- **生成方式**：VitePWA + Workbox（`generateSW` 模式），SW 文件 `pwa-sw.js`
- **注册方式**：`virtual:pwa-register/react` 的 `useRegisterSW` hook（在 `UpdatePrompt` 组件中）
- **更新策略**：`autoUpdate` 模式 + `UpdatePrompt` toast 提示（用户点击"立即刷新"触发 `SKIP_WAITING` + reload）
- **runtime caching**：
  - Supabase REST API（`/rest/v1/*`）：`NetworkFirst`，5 秒超时，5 分钟 TTL，最多 100 条
  - Supabase Auth（`/auth/v1/*`）：`NetworkOnly`（不缓存鉴权响应）
  - Google Fonts / gstatic / images：`CacheFirst`
- **navigateFallbackDenylist**：`/api/`、Supabase REST/Auth 前缀（API 请求不走 SPA fallback）

### 离线检测

使用 `useNetworkStatus` hook（`src/hooks/common/useNetworkStatus.ts`）：
- 浏览器原生 `online` / `offline` 事件
- Capacitor `Network.addListener('networkStatusChange')`（移动端）
- `navigator.connection` 慢速检测
- 健康检查（HEAD `/api/health/system`）
- 提供 `subscribeNetworkStatus(callback)` 非 hook 订阅函数（供 `onlineManager` 使用）

### React Query 离线集成

- **onlineManager**：`onlineManager.setEventListener` 接入 `subscribeNetworkStatus`，离线时 React Query 查询自动暂停
- **mutationCache 离线队列**：离线时 mutation 自动入队（抛出 `OfflineError`，不触发错误 toast），网络恢复时自动 replay
- **persistQueryClient**：查询缓存持久化到 IndexedDB（`KnowledgeMapQueryCache.queryCache` store），7 天 TTL，仅持久化 `graphs` / `nodes` / `edges` / `user` 前缀的 query

### 离线 mutation 队列

- **位置**：IndexedDB 数据库 `KnowledgeMapMutationQueue`，store 名 `mutationQueue`
- **结构**：`{ id, mutationKey, variables, context, meta, timestamp, retryCount, lastError }`
- **重试策略**：
  - 最大重试 3 次
  - 指数退避：1s → 2s → 4s
  - 超过最大重试次数的非网络错误 mutation 从队列移除并通知用户
  - 网络错误保留在队列，等待下一次网络恢复重试
- **冲突解决**：服务端返回 409 → `frontendEventBus` 触发 `sync_conflict_detected` 事件 → `ConflictResolutionDialog` 弹出 → 用户选择 local / remote / merge → 解决方案提交到 `offlineMutationQueue`

### 旧队列迁移

应用启动时调用 `migrateLegacyQueue()`（位于 `src/utils/offlineMutations.ts`）将旧 `KnowledgeMapDB.offlineQueue` store 中的项迁移到新 `KnowledgeMapMutationQueue.mutationQueue` store。这是从已移除的 `BackgroundSyncManager` 迁移到 `offlineMutationQueue` 的兼容逻辑。

### PWA 安装体验

- **`usePwaInstall` hook**：监听 `beforeinstallprompt` 事件保存 `deferredPrompt`，监听 `appinstalled` 事件上报埋点
- **`PwaInstallButton` 组件**：Settings 页显示"安装到桌面"按钮，点击触发 `deferredPrompt.prompt()`
- **`PwaDiagnostics` 组件**：Settings 页折叠面板，显示 SW 状态、standalone 模式、缓存大小，提供"清除缓存并重新加载"按钮

### 与 Electron 桌面端的差异

| 方面 | Web 端 (PWA) | Electron 桌面端 |
|------|--------------|------------------|
| SW 注册 | ✅ VitePWA Workbox | ❌ 不注册（`!isElectron`） |
| 离线数据 | IndexedDB（queryCache + mutationQueue） | 本地 SQLite（DatabaseManager） |
| 离线编辑 | mutation 离线队列 + 冲突解决 | 直接写本地 SQLite，sync engine 同步 |
| 安装体验 | beforeinstallprompt + PwaInstallButton | electron-builder 安装包 |
| 自动更新 | SW autoUpdate + UpdatePrompt toast | electron-updater |

---

## 4. 测试指南

> 完整测试规范见 [`docs/testing-guidelines.md`](./docs/testing-guidelines.md)。本节为速查摘要。

### 4.1 测试分层（Testing Trophy）

| 层级 | 占比目标 | 范围 | 工具 |
|------|---------|------|------|
| 静态检查 | 100% | TypeScript 类型 + ESLint | `tsc --build` + `eslint` |
| 单元测试 | ~20% | 纯函数、单模块，无外部依赖 | Vitest |
| 集成测试 | ~60% | 多模块协作（组件+API、service+DB、IPC、SSE） | Vitest + RTL + MSW + 本地 Supabase |
| E2E 测试 | ~20% | 关键用户旅程 | Playwright |

### 4.2 命令速查

| 命令 | 用途 | 说明 |
|------|------|------|
| `npm test` | watch 模式 | 开发时使用，文件变更自动重跑 |
| `npm run test:run` | 单次运行 | CI / 本地验证 |
| `npm run test:unit` | 单元测试 | 排除 e2e 目录 |
| `npm run test:coverage` | 覆盖率 | 生成 HTML/LCOV 报告，应用门禁 |
| `npm run test:db` | 数据库测试 | pgTAP SQL 测试，需先启动本地 Supabase |
| `npm run test:e2e` | E2E 测试 | Playwright 全量 |
| `npm run test:e2e:ui` | E2E UI 模式 | 带可视化面板，便于调试 |
| `npm run test:e2e:debug` | E2E 调试 | 逐步执行，显示浏览器 |
| `npm run test:all` | 全部测试 | Vitest + Playwright |
| `npm run test:ci` | CI 流程 | `check` + `lint` + `test:coverage` |

### 4.3 覆盖率门禁

| 指标 | 当前门禁 | 基线（2026-07） | 长期目标 |
|------|---------|---------------|---------|
| Statements | 11% | ~12.7% | 70% |
| Branches | 6% | ~7.7% | 65% |
| Functions | 8% | ~10.0% | — |
| Lines | 11% | ~13.0% | — |

> 覆盖率是门禁，不是 KPI——不要为了达标而写无价值测试。阈值定义于 [`vitest.config.ts`](./vitest.config.ts)（约为基线以下 1.5-2%，拦截回归），随测试补齐逐步提升；阶段性提升计划见 [`docs/testing-guidelines.md`](./docs/testing-guidelines.md) §7。

### 4.4 共享基础设施（强制）

新测试 **必须** 使用 `tests/` 目录下的共享基础设施，禁止在测试文件内重复定义：

- **mock 工厂**：`tests/helpers/mockFactories.ts`（`createMockSupabase` / `createMockResponse` / `createMockProvider` / `buildCard` / `createMockRequest`）
- **Faker 工厂**：`tests/helpers/factories.ts`（`userFactory` / `graphFactory` / `nodeFactory` / `noteFactory` 等）
- **Provider 包装器**：`tests/helpers/renderWithProviders.tsx`（React Query + Router + Theme + Zustand）
- **测试 DB 客户端**：`tests/helpers/testDb.ts`（`getAdminClient` / `getAnonClient` / `getAuthedClient` / `describeIfDbAvailable` / `cleanTable`）
- **Electron mock**：`tests/helpers/electronMock.ts`（`mockElectron` / `callIpcHandler`）
- **MSW handlers**：`tests/setup/mswHandlers.ts` + `tests/setup/mswServer.ts`

### 4.5 断言原则（强制）

- ✅ 使用显式断言：`toBeVisible()`、`toBe(true)`、`toEqual(expected)`、`toHaveCount(n)`
- ❌ 禁止软跳过：`if (await locator.isVisible().catch(() => false))` + `if` 包裹断言
- ❌ 禁止 `typeof` 弱断言：`expect(typeof x).toBe("boolean")` 只验证类型不验证值
- ❌ 禁止测试私有方法：通过 `as any` / `as unknown as` 访问内部实现
- ❌ 禁止 `container.querySelector`：使用 RTL 语义化查询（`getByRole` / `getByText` / `getByTestId`）

---

## 5. 调试指南

### 5.1 VSCode 调试配置

项目支持通过 VSCode 调试 Electron 主进程、渲染进程和 API 服务器。`.vscode/launch.json` 已随仓库提供，包含以下 3 个调试配置（若丢失可按此重建）：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Electron: Main",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "runtimeArgs": ["--inspect=9222", "."],
      "env": { "VITE_DEV_SERVER_URL": "http://localhost:5173" },
      "sourceMaps": true,
      "outFiles": ["${workspaceFolder}/dist-electron/**/*.js"]
    },
    {
      "name": "Electron: Renderer",
      "type": "chrome",
      "request": "attach",
      "port": 9223,
      "urlFilter": "http://localhost:5173/*",
      "webRoot": "${workspaceFolder}/src"
    },
    {
      "name": "API Server",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "tsx",
      "runtimeArgs": ["--tsconfig", "tsconfig.api.json", "api/server.ts"],
      "cwd": "${workspaceFolder}",
      "env": { "NODE_ENV": "development" },
      "console": "integratedTerminal"
    }
  ]
}
```

### 5.2 Electron 主进程调试

1. 先启动 Vite 开发服务器：`npm run client:dev`
2. 在 VSCode 调试面板选择 **"Electron: Main"** 配置，按 F5 启动
3. 主进程断点在 `electron/main.ts` 中生效（通过 `--inspect=9222` 暴露调试端口）

### 5.3 Electron 渲染进程调试

1. 启动 Electron 开发模式：`npm run electron:dev`
2. 确保 Electron 主进程启动时附加 `--inspect=9223` 参数（在 `electron/main.ts` 中配置）
3. 在 VSCode 调试面板选择 **"Electron: Renderer"** 配置，附加到 9223 端口
4. 渲染进程断点在 `src/` 中生效

### 5.4 API 服务器调试

1. 在 VSCode 调试面板选择 **"API Server"** 配置，按 F5 启动
2. 服务监听 `http://localhost:3001`（端口由 `.env` 的 `PORT` 控制）
3. 断点在 `api/` 目录中生效
4. 该配置使用 `tsx` 直接运行 `api/server.ts`，无需先编译

### 5.5 日志查看

| 环境 | 工具 | 说明 |
|------|------|------|
| 前端（`src/`） | `console.warn` / `console.error` | 禁止 `console.log` / `console.info`（ESLint 警告） |
| 后端（`api/`） | `api/utils/logger.ts` | 禁止任何 `console.*` 调用，必须使用 `logger` |
| Electron | `electron/utils/logger.ts` | 主进程日志输出 |

---

## 6. 数据库操作

### 6.1 本地 Supabase 管理

| 命令 | 说明 |
|------|------|
| `npm run db:local:start` | 启动本地 Supabase（Docker 容器） |
| `npm run db:local:stop` | 停止本地 Supabase |
| `npm run db:local:reset` | 重置数据库（删除所有数据并重新应用 schema + seed） |
| `npm run db:local:status` | 查看服务状态与端口 |
| `npm run db:local:logs` | 查看数据库日志 |

> Docker 开发模式下，数据库由宿主机 Supabase CLI 管理，`npm run db:local:*` 命令同样适用。在宿主机终端执行这些命令即可。

### 6.2 迁移文件组织

迁移文件位于 `supabase/migrations/`，按业务域模块化组织，命名格式为 `{两位序号}_{业务域}.sql`：

| 序号范围 | 用途 | 示例 |
|---------|------|------|
| 00-01 | 扩展、类型与共享函数 | `00_extensions_and_types.sql`、`01_shared_functions.sql` |
| 02-28 | 业务域建表（表 + 列注释） | `03_knowledge_graph.sql`、`09_learning_paths.sql` |
| 29-33 | 横切关注点（全量归拢） | `29_indexes.sql`、`30_rls_policies.sql`、`31_functions.sql`、`32_triggers.sql`、`33_grants.sql` |
| 34 | 调度容量 | `34_scheduler_capacity.sql`（`learning_path_stage_windows`） |
| 50-60 | Seed 数据（系统模板、成就、Prompt 等） | `50_seed_app_settings.sql`、`60_seed_chunk_contextualize.sql` |

**迁移文件管理规则**：

- 所有 schema 变更**直接修改对应的模块化文件**，不创建新的增量迁移文件；新字段直接并入该表的 `CREATE TABLE` 语句，禁止新建 `ALTER TABLE ... ADD COLUMN` 增量文件
- 新索引加入 `29_indexes.sql`，新 RLS 策略加入 `30_rls_policies.sql`，新函数加入 `31_functions.sql`，新触发器加入 `32_triggers.sql`，新授权加入 `33_grants.sql`
- 新增业务域（建表）时，在 34 之后使用下一个可用序号新建文件；新增 seed 数据时使用 50-60 中下一个可用序号；横切内容（索引/RLS/函数/触发器/授权）一律并入 29-33 对应文件
- 文件命名使用 `kebab-case` 或 `snake_case`，与现有文件保持一致
- 修改后运行 `npm run db:local:reset` 验证迁移能从空库一次性完整跑通

### 6.3 类型生成

schema 变更后**必须**重新生成 TypeScript 类型：

```bash
npm run db:gen-types
```

生成的文件：`shared/types/database.generated.ts`（**禁止手动编辑**，文件头部有自动生成标识）

校验类型是否与最新 schema 同步：

```bash
npm run db:check-types
```

### 6.4 Seed 数据

- `npm run db:local:reset` 会自动应用所有 `supabase/migrations/` 下编号 50–60 的 SQL seed
- 业务 seed 数据（成就、模板、Prompt、关系类型）通过 `50-60_seed_*.sql` 注入
- 单独插入额外测试数据（5 个演示图谱、30+ 卡片、每日/周期任务、成就、专注统计）：
  ```bash
  npm run db:seed
  ```
  该命令**不需要先启动前端**：会自动在 `auth.users` 中寻找/创建与前端同格式的 `owner-{uuid}@local.app` 用户，重置密码并将全部演示数据关联到该用户。
- 脚本执行末尾会输出两段信息：
  1. **DevTools 注入命令**（3 行 JS）—— 在 Web/Electron 应用的 Console 粘贴后即可静默登录到 seed owner 并看到演示数据
  2. **本地凭证文件** `.seed-owner-credentials.json`——重复跑 seed 时会优先复用该密码，避免反复重置；该文件已在 `.gitignore` 中忽略，不进入版本控制
- 额外 fixture：掌握度梯度验证数据集（5×S 梯度、4×due date 梯度）通过 `tsx scripts/seed-mastery-unification-fixtures.ts` 注入，使用同一套 owner 用户与凭证机制

### 6.5 远程数据库修改流程

远程数据库（生产环境）修改流程：

1. **本地修改**：修改 `supabase/migrations/` 中对应的模块化 SQL 文件
2. **本地验证**：`npm run db:local:reset` 验证 schema 正确性
3. **提取变更 SQL**：从修改的文件中提取需要应用到远程的 SQL 语句
4. **远程执行**：在 Supabase Dashboard > SQL Editor 中执行

SQL 模板（使用 `IF NOT EXISTS` 保证幂等）：

```sql
ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name data_type;
CREATE INDEX IF NOT EXISTS index_name ON table_name(column_name);
```

> 远程修改完成后，记得同步运行 `npm run db:gen-types` 更新类型定义并提交。

---

## 7. 代码规范

### 7.1 TypeScript 严格模式

[`tsconfig.base.json`](./tsconfig.base.json) 启用了以下严格选项：

- `strict: true`（含 `strictNullChecks`、`noImplicitAny`）
- `noUnusedLocals: true`
- `noUnusedParameters: true`
- `noFallthroughCasesInSwitch: true`
- `noImplicitOverride: true`
- `forceConsistentCasingInFileNames: true`
- `isolatedModules: true`

### 7.2 命名规范

API 层命名规范详见 [`.trae/rules/api-naming-conventions.md`](./.trae/rules/api-naming-conventions.md)，核心要点：

- **API 对象**：`{资源名}Api`（如 `graphsApi`），mobile 层为 `mobile{资源名}Api`（如 `mobileGraphsApi`）
- **资源名**：复数形式、camelCase（如 `graphs`、`nodes`、`knowledgePoints`）
- **CRUD 方法**：`list` / `get` / `create` / `update` / `delete`（方法名不重复资源名）
- **批量操作**：`batch{Action}`（如 `batchDelete`、`batchRestore`）
- **导出**：对象式导出 `export const xxxApi = { ... }`，禁止独立函数导出

### 7.3 ESLint 规则要点

配置见 [`eslint.config.js`](./eslint.config.js)，关键规则：

| 规则 | 级别 | 说明 |
|------|------|------|
| `@typescript-eslint/no-explicit-any` | warn | 禁止 `any` 类型 |
| `@typescript-eslint/no-non-null-assertion` | warn | 禁止非空断言 `!` |
| `no-console` | warn | 前端仅允许 `console.warn` / `console.error` |
| `prefer-const` | warn | 优先使用 `const` |
| `no-var` | error | 禁止 `var` |
| `eqeqeq` | warn | 强制 `===`（null 除外） |
| `no-throw-literal` | error | `throw` 必须抛出 Error 对象 |
| `no-duplicate-imports` | warn | 禁止重复导入 |
| `prefer-template` | warn | 优先使用模板字符串 |
| `object-shorthand` | warn | 对象属性简写 |

> **后端（`api/`）特殊要求**：禁止任何 `console.*` 调用，必须使用 `api/utils/logger.ts` 提供的 `logger` 工具。

### 7.4 提交前检查

**lint-staged 自动检查**（通过 `.husky/pre-commit` 钩子触发）：

- `*.{ts,tsx}` 文件：自动运行 `eslint --fix` + `tsc --build --incremental`
- `*.{js,mjs,cjs}` 文件：自动运行 `eslint --fix`

> 如需在提交前运行单元测试，设置环境变量 `RUN_TESTS=1`。

**手动全量检查**（提交前推荐）：

```bash
npm run check    # 增量类型检查（开发时推荐）
npm run lint     # ESLint 检查（带缓存）
```

CI 环境使用强制全量检查：

```bash
npm run check:full && npm run lint:full
```

### 7.5 AI 服务规范

- **Prompt 必须从数据库读取**：禁止硬编码 Prompt 字符串
- **三层管理**：System < User < Graph（优先级递增，后者覆盖前者）
- **使用方式**：

```typescript
const prompt = await promptService.getRenderedPrompt(
  supabaseAdmin,
  "prompt_code",
  { variable: "value" },
);
```

- **性能监控**：AI 调用必须记录 token 使用、成本、时长：

```typescript
await performanceMonitor.recordLog({
  operation: "operation_name",
  provider: "openai",
  model: "gpt-4",
  inputTokens: 100,
  outputTokens: 200,
  duration: 1500,
  success: true,
});
```

### 7.6 缓存机制

项目使用 NodeCache 内存缓存（适用于桌面应用单实例场景）。优先使用 `getOrSet` 实现请求去重：

```typescript
// 推荐：请求去重（自动缓存 + 并发去重）
const data = await cacheService.getOrSet(
  CacheKeys.GRAPH_NODES(userId, graphId),
  () => fetchFromDB(),
  300, // TTL 秒
);

// 标签化缓存失效
await cacheService.set(key, value, 300, ["graph", `user-${userId}`]);
await cacheService.delByTags(["graph"]);
await cacheService.invalidateGraphCache(userId, graphId);
```

---

## 8. 故障排查

### 8.1 端口冲突

| 端口 | 服务 | 检查命令 | 解决方法 |
|------|------|---------|---------|
| 5173 | Vite 前端开发服务器 | `netstat -ano \| findstr :5173` | 终止占用进程或修改 `vite.config.ts` |
| 3001 | API 服务器 | `netstat -ano \| findstr :3001` | 终止占用进程或修改 `.env` 的 `PORT` |
| 54321 | Supabase API 网关 | `npm run db:local:status` | `npm run db:local:stop` 后重启 |
| 54322 | PostgreSQL 直连 | `npm run db:local:status` | 同上 |
| 54323 | Supabase Studio | `npm run db:local:status` | 同上 |
| 54324 | Inbucket 邮件服务 | `npm run db:local:status` | 同上 |

> Windows 下终止进程：`taskkill /PID <进程ID> /F`

### 8.2 Supabase 启动失败

**常见原因与解决**：

1. **Docker 未运行**：启动 Docker Desktop 后重试 `npm run db:local:start`
2. **端口占用**：运行 `npm run db:local:status` 检查，必要时 `npm run db:local:stop` 后重启
3. **Supabase CLI 未安装或版本过旧**：
   - Windows 推荐 Scoop 安装：`scoop bucket add supabase https://github.com/supabase/scoop-bucket.git && scoop install supabase`
   - PATH 含非 ASCII 用户名时，使用 CLI 完整路径调用
4. **Docker 镜像损坏**：`docker system prune` 清理后重试
5. **数据库状态异常**：`npm run db:local:reset` 完全重置

### 8.3 Electron 原生模块编译

Electron 版本与 Node ABI 不一致时，`better-sqlite3`、`sharp` 等原生模块需要重新编译：

```bash
# 重新编译所有原生模块（推荐）
npx electron-rebuild

# 或仅重编译 better-sqlite3
npm rebuild better-sqlite3
```

> `package.json` 的 `postinstall` 钩子会自动执行 `electron-rebuild`，通常无需手动操作。切换 Electron 版本或 Node 版本后需手动重编译。

### 8.4 测试超时

- **增加 timeout**：在测试中显式设置 `await expect(locator).toBeVisible({ timeout: 5000 })`
- **检查测试独立性**：确保 `beforeEach` / `afterEach` 正确清理状态（`resetStores()`、`cleanTable()`）
- **DB 测试慢**：确认本地 Supabase 已启动，且 `SUPABASE_SERVICE_ROLE_KEY` 已配置
- **E2E 首次启动慢**：`webServer` 配置会自动启动 `npm run dev`，CI 首次运行需等待 ~120s
- **psql 未安装**：`npm run test:db` 依赖 psql 直连 54322 端口，可创建 `node_modules/.bin/psql.cmd` shim 转发至 Supabase 容器

### 8.5 环境变量问题

```bash
# 校验必填环境变量
npm run check:env
```

常见问题：

- **`.env.development` 不存在**：`cp .env.example .env.development`
- **占位符未替换**：脚本会标记 `your_*`、`xxx`、`<...>` 等占位符为错误
- **AI 功能不可用**：至少配置一个 AI Provider Key（`DEEPSEEK_API_KEY` / `VOLCENGINE_API_KEY` / `ALIYUN_API_KEY`）
- **认证失败**：检查 `SUPABASE_JWT_SECRET` 是否与 Supabase 实例匹配（本地默认值见 `.env.example`）
- **移动端无法访问 API**：检查 `VITE_API_BASE_URL` 是否指向正确的后端地址

### 8.6 类型检查报错

```bash
# 增量检查（开发时推荐，自动跳过未变更子项目）
npm run check

# 强制全量检查（CI / 疑难排查）
npm run check:full
```

常见问题：

- **`.tsbuildinfo` 缓存过期**：`npm run check:full` 强制重建缓存
- **Project References 报错**：检查 `tsconfig.*.json` 的 `references` 配置，确认 `shared/` 不依赖 `api/` 或 `src/`
- **类型生成过期**：schema 变更后运行 `npm run db:gen-types` 重新生成 `database.generated.ts`
- **路径别名失效**：确认 `tsconfig.base.json` 的 `paths` 配置（`@/*` → `./src/*`、`@shared/*` → `./shared/*`）

### 8.7 ESLint 缓存问题

```bash
# 带缓存的检查（开发时推荐）
npm run lint

# 全量检查（忽略缓存，CI 使用）
npm run lint:full
```

若遇到"修改后仍报错"的情况，删除 `node_modules/.cache/eslint` 后重试。

### 8.8 Docker 相关故障

| 问题 | 原因 | 解决方法 |
|------|------|---------|
| `host.docker.internal` 无法访问 | Linux 容器默认不支持 | 确保 Docker Desktop 已启用 `host.docker.internal` 支持，Windows/macOS 默认支持 |
| 端口 5173/3001 被占用 | 本地已有进程占用 | `netstat -ano \| findstr :端口号` 查看占用进程，`taskkill /PID <PID> /F` 终止 |
| 容器内无法连接 Supabase | 宿主机未运行 `supabase start` | 在宿主机执行 `supabase start` 后重启容器：`docker-compose restart backend` |
| 构建失败 / 依赖安装慢 | 网络问题 | 确认 Docker 已配置国内镜像源（如 `https://registry.npmmirror.com`） |
| 热重载不生效 | 文件监听机制问题 | 确认 `vite.config.ts` 中已配置 `server.watch.usePolling: true`，确认 nodemon.json 配置正确 |

---

## 9. 贡献流程

> 完整贡献指南见 [`CONTRIBUTING.md`](./CONTRIBUTING.md)。

### 9.1 分支策略

| 分支 | 用途 |
|------|------|
| `main` | 稳定发布分支，仅通过 PR 合并，禁止直接推送 |
| `develop` | 开发集成分支（如使用），用于汇总各 feature 分支 |
| `feature/*` | 新功能分支，如 `feature/graph-export` |
| `fix/*` | Bug 修复分支，如 `fix/login-redirect` |
| `refactor/*` | 重构分支（无功能变化），如 `refactor/graph-service` |
| `docs/*` | 文档更新分支，如 `docs/api-readme` |
| `chore/*` | 杂项分支（依赖升级、配置调整等） |

**命名规范**：使用 kebab-case（小写 + 连字符），名称简洁且具描述性，避免使用个人姓名或无关信息。

### 9.2 Commit Message 规范

本项目采用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Type 列表**：

| Type | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `refactor` | 重构（无功能变化） |
| `docs` | 文档更新 |
| `test` | 测试相关 |
| `chore` | 杂项（依赖、配置） |
| `style` | 代码格式（不影响逻辑） |
| `perf` | 性能优化 |
| `ci` | CI/CD 相关 |
| `build` | 构建系统相关 |

**Scope 建议**：使用模块名（如 `graph-editor`、`auth`、`scheduler`、`notes`、`study`、`quiz`、`api`、`electron`、`mobile`）。

**示例**：

```
feat(graph-editor): add node drag-and-drop support

- Support dragging nodes to new positions
- Update edges automatically when nodes move
- Add undo/redo for position changes

Closes #123
```

### 9.3 PR 流程

1. **Fork 并同步上游**（详见 [`CONTRIBUTING.md`](./CONTRIBUTING.md) 第 1 节）
2. **创建分支**：`git checkout -b feature/your-feature`
3. **提交前检查**：

```bash
npm run check          # TypeScript 类型检查（增量）
npm run lint           # ESLint 检查（带缓存）
npm run test:run       # 单元测试（Vitest 单次运行）
```

> pre-commit 钩子会自动运行 `lint-staged` 对暂存文件进行增量检查（ESLint + `tsc --build --incremental`）。

4. **推送并创建 PR**：向 `main` 分支发起 Pull Request，填写 PR 描述模板
5. **代码审查**：reviewer 会重点关注规范遵循、测试覆盖、安全风险等（详见 [`CONTRIBUTING.md`](./CONTRIBUTING.md) 第 5 节）

### 9.4 CODEOWNERS 自动分配 reviewer

若 `.github/CODEOWNERS` 文件存在，GitHub 会根据文件路径自动分配 reviewer。PR 至少需要 1 名 reviewer 批准后方可合并；重大变更（架构调整、核心模块修改）建议至少 2 名 reviewer 批准。

### 9.5 自审清单

提交 PR 前请逐项确认：

- [ ] 代码通过 `npm run check` 与 `npm run lint`
- [ ] 新功能有对应的单元/集成测试
- [ ] 没有引入 `any` 类型或非空断言 `!`
- [ ] 没有在 `src/` 使用 `console.log` / `console.info`（允许 `warn` / `error`）
- [ ] 没有在 `api/` 使用 `console.*`（必须使用 `logger`）
- [ ] Commit message 遵循 Conventional Commits 规范
- [ ] 数据库 schema 变更已同步更新 `shared/types/database.generated.ts`
- [ ] 没有提交 `.env`、密钥或敏感信息

---

## 参考文档

- [项目规则](./.trae/rules/project_rules.md) - 完整项目规范（数据库、测试、代码、AI 服务、缓存、错误处理、SSE、任务调度等）
- [API 命名规范](./.trae/rules/api-naming-conventions.md) - API 对象与方法命名规范
- [测试规范指南](./docs/testing-guidelines.md) - 完整测试模型、目录结构、断言原则、Mock 准则
- [架构参考](./docs/architecture-reference.md) - 分层架构约定、API 版本策略、命名规范
- [代码维基](./docs/code-wiki.md) - 全项目架构、路由表、数据库 Schema、插件系统总览
- [贡献指南](./CONTRIBUTING.md) - Fork 流程、分支策略、Commit 规范、PR 要求、代码审查
- [README](./README.md) - 项目简介、功能特性、使用指南
