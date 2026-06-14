# Local-First 架构（SQLite）Spec

## Why

当前 Electron 桌面端虽内嵌了 Express API 服务器，但数据仍完全依赖 Supabase（PostgreSQL），断网即不可用。通过引入本地 SQLite 作为主数据库，实现真正的 Local-First 架构：所有读写操作优先走本地 SQLite，后台双向同步到云端 Supabase，完全离线可用，网络恢复后自动同步。这对桌面应用是重大差异化优势。

## What Changes

- **新增 Electron 主进程 SQLite 数据库层**：使用 `better-sqlite3` 在 Electron 主进程中创建本地 SQLite 数据库，作为主数据源
- **新增 Schema 适配层**：将 PostgreSQL 特有类型（`vector`, `JSONB`, `TIMESTAMPTZ`, 枚举类型）映射到 SQLite 兼容类型
- **新增 IPC 数据通道**：渲染进程通过 IPC 直接访问主进程的 SQLite 数据库，替代 HTTP API 调用
- **新增双向同步引擎**：基于 `updated_at` 时间戳的增量同步，支持 push（本地→云端）和 pull（云端→本地）
- **新增同步状态管理**：跟踪每条记录的同步状态（local_only / synced / pending_push / pending_pull / conflict）
- **修改前端 API 适配层**：Electron 生产模式下，API 请求优先走 IPC → SQLite，降级到 HTTP → Express → Supabase
- **修改 Electron 主进程**：启动时初始化 SQLite 数据库、执行迁移、启动同步引擎

## Impact

- Affected specs: 数据访问层、离线存储、同步服务、Electron 主进程
- Affected code:
  - `electron/main.ts` — 新增 SQLite 初始化和同步引擎启动
  - `electron/preload.ts` — 新增 IPC 数据通道
  - `src/services/api/adapter.ts` — Electron 模式优先走 IPC
  - `src/services/api/createApiClient.ts` — Electron 模式降级逻辑
  - `src/utils/offlineStorage.ts` — 被 SQLite 替代（保留兼容）
  - `src/utils/backgroundSync.ts` — 被新同步引擎替代（保留兼容）
  - `src/services/sync/` — 整合到新同步引擎
  - `api/services/` — 新增同步端点（pull/push）
  - `supabase/migrations/` — 新增 `sync_metadata` 相关表

## ADDED Requirements

### Requirement: Electron 主进程 SQLite 数据库

系统 SHALL 在 Electron 主进程中使用 `better-sqlite3` 创建本地 SQLite 数据库，作为桌面端的主数据源。

#### Scenario: 首次启动初始化
- **WHEN** 用户首次启动 Electron 应用
- **THEN** 系统在 `userData` 目录创建 SQLite 数据库文件 `knowledgemap.db`，执行 Schema 迁移创建所有本地表

#### Scenario: 后续启动验证
- **WHEN** 用户再次启动 Electron 应用
- **THEN** 系统打开已有数据库，检查 Schema 版本，如需迁移则自动执行增量迁移

#### Scenario: 数据库文件位置
- **WHEN** 系统创建 SQLite 数据库
- **THEN** 数据库文件位于 Electron `app.getPath('userData')` 目录下，用户可通过设置查看路径

---

### Requirement: PostgreSQL 到 SQLite 的 Schema 适配

系统 SHALL 将 PostgreSQL 特有类型映射为 SQLite 兼容类型，保持数据语义一致。

#### Scenario: JSONB 类型映射
- **WHEN** PostgreSQL 列类型为 `JSONB`
- **THEN** SQLite 中使用 `TEXT` 类型存储，读写时自动 JSON 序列化/反序列化

#### Scenario: vector 类型映射
- **WHEN** PostgreSQL 列类型为 `vector(1024)`
- **THEN** SQLite 中使用 `TEXT` 类型存储嵌入向量的 JSON 数组表示，本地不支持向量搜索（需向量搜索时走云端）

#### Scenario: 枚举类型映射
- **WHEN** PostgreSQL 列类型为自定义枚举（如 `prompt_scope`, `user_role`）
- **THEN** SQLite 中使用 `TEXT` 类型存储，应用层校验枚举值合法性

#### Scenario: TIMESTAMPTZ 类型映射
- **WHEN** PostgreSQL 列类型为 `TIMESTAMPTZ`
- **THEN** SQLite 中使用 `TEXT` 类型存储 ISO 8601 格式字符串，应用层统一处理时区

#### Scenario: UUID 类型映射
- **WHEN** PostgreSQL 列类型为 `UUID`
- **THEN** SQLite 中使用 `TEXT` 类型存储，应用层生成 UUID v4

---

### Requirement: IPC 数据通道

系统 SHALL 通过 Electron IPC 通道暴露 SQLite 数据库操作，渲染进程通过 IPC 直接访问本地数据库。

#### Scenario: IPC 请求格式
- **WHEN** 渲染进程发起数据请求
- **THEN** 通过 `ipcRenderer.invoke('db:query', { resource, method, params })` 格式调用，主进程路由到对应的数据库操作

#### Scenario: IPC 响应格式
- **WHEN** 主进程完成数据库操作
- **THEN** 返回 `{ success: boolean, data?: T, error?: string }` 格式的响应

#### Scenario: 批量操作支持
- **WHEN** 渲染进程需要执行多个数据库操作
- **THEN** 支持通过 `db:batch` 通道在单个 IPC 调用中执行多个操作，使用 SQLite 事务保证原子性

---

### Requirement: 前端 API 适配层

系统 SHALL 在 Electron 生产模式下优先使用 IPC → SQLite 路径，当本地数据不可用时降级到 HTTP → Express → Supabase。

#### Scenario: Electron 模式 API 路由
- **WHEN** 应用运行在 Electron 打包模式且本地数据库已初始化
- **THEN** API 请求优先走 IPC → SQLite 路径，响应时间 < 5ms

#### Scenario: 降级到 HTTP
- **WHEN** IPC 请求失败或本地数据库未初始化
- **THEN** 自动降级到 HTTP API 调用（现有行为），用户无感知

#### Scenario: 云端专属操作
- **WHEN** 请求涉及向量搜索、AI 调用等必须云端处理的操作
- **THEN** 直接走 HTTP API 路径，不尝试本地 IPC

#### Scenario: 开发模式不变
- **WHEN** 应用运行在开发模式（`npm run electron:dev`）
- **THEN** 继续使用 HTTP → Express → Supabase 路径，不启用 IPC 路径

---

### Requirement: 双向同步引擎

系统 SHALL 实现本地 SQLite 与云端 Supabase 之间的双向增量同步。

#### Scenario: 增量 Pull 同步
- **WHEN** 网络可用且距上次同步超过配置间隔（默认 30 秒）
- **THEN** 系统从云端拉取 `updated_at > lastSyncTimestamp` 的变更记录，合并到本地 SQLite

#### Scenario: 增量 Push 同步
- **WHEN** 本地有 `sync_status = 'pending_push'` 的记录且网络可用
- **THEN** 系统将本地变更推送到云端 Supabase，成功后更新 `sync_status = 'synced'`

#### Scenario: 首次全量同步
- **WHEN** 用户首次登录或本地数据库为空
- **THEN** 系统从云端全量拉取用户数据到本地 SQLite，显示同步进度

#### Scenario: 同步冲突处理
- **WHEN** 本地和云端对同一条记录都有修改（`updated_at` 都晚于 `lastSyncTimestamp`）
- **THEN** 系统默认使用"云端优先"策略（云端版本覆盖本地），同时保留本地版本到冲突日志，用户可在冲突面板中恢复

#### Scenario: 网络断开时操作
- **WHEN** 用户在离线状态下进行数据操作
- **THEN** 操作直接写入本地 SQLite，标记 `sync_status = 'pending_push'`，网络恢复后自动推送

#### Scenario: 同步状态持久化
- **WHEN** 同步引擎记录每张表的最后同步时间戳
- **THEN** 时间戳持久化到本地 SQLite 的 `sync_metadata` 表，应用重启后不丢失

---

### Requirement: 同步状态 UI

系统 SHALL 提供同步状态可视化界面，让用户了解当前数据同步情况。

#### Scenario: 全局同步状态指示器
- **WHEN** 用户查看应用状态栏
- **THEN** 显示当前同步状态图标：✅ 已同步 / 🔄 同步中 / ⚠️ 离线 / ❌ 同步错误

#### Scenario: 同步详情面板
- **WHEN** 用户点击同步状态指示器
- **THEN** 显示同步详情面板：最后同步时间、待推送数量、待拉取数量、冲突数量

#### Scenario: 冲突解决面板
- **WHEN** 存在同步冲突
- **THEN** 用户可在冲突面板中查看本地版本和云端版本的差异，选择保留哪个版本

---

### Requirement: 本地数据优先的离线体验

系统 SHALL 确保核心功能在完全离线状态下可用。

#### Scenario: 离线图谱浏览和编辑
- **WHEN** 用户在无网络环境下打开应用
- **THEN** 可正常浏览和编辑已同步到本地的所有图谱，操作即时响应

#### Scenario: 离线学习模式
- **WHEN** 用户在离线状态下使用学习功能
- **THEN** 可正常进行复习和练习，学习进度记录到本地，网络恢复后同步

#### Scenario: 离线任务管理
- **WHEN** 用户在离线状态下管理任务
- **THEN** 可正常创建、编辑、完成任务，变更在网络恢复后同步

#### Scenario: 离线功能边界提示
- **WHEN** 用户在离线状态下尝试使用需要云端的功能（如 AI 生成、向量搜索）
- **THEN** 系统显示友好提示"此功能需要网络连接"，而非报错

---

### Requirement: 后端同步 API 端点

系统 SHALL 在 Express 后端新增同步专用 API 端点，支持增量数据拉取和推送。

#### Scenario: Pull 端点
- **WHEN** 客户端调用 `POST /api/sync/pull`
- **THEN** 接收 `{ tables: { tableName: lastSyncTimestamp }[] }` 参数，返回各表 `updated_at > lastSyncTimestamp` 的变更记录

#### Scenario: Push 端点
- **WHEN** 客户端调用 `POST /api/sync/push`
- **THEN** 接收 `{ operations: [{ table, action, data }] }` 参数，批量应用变更到 Supabase，返回每条操作的成功/失败状态

#### Scenario: 同步权限校验
- **WHEN** 同步请求到达
- **THEN** 校验用户对每条记录的访问权限（RLS），拒绝无权限的 pull/push 操作

## MODIFIED Requirements

### Requirement: Electron 主进程启动流程（现有）

现有 Electron 主进程启动流程新增 SQLite 初始化阶段：在 Phase 2（API 服务器启动）之前，先初始化 SQLite 数据库和同步引擎。如果 SQLite 初始化失败，降级到纯 HTTP 模式（现有行为）。

### Requirement: 前端 API 适配器（现有）

现有 `adapter.ts` 的 `createAdapter` 函数新增 `electron-local` 模式：当检测到 Electron 生产模式且 SQLite 可用时，API 调用优先路由到 IPC 通道。

## REMOVED Requirements

（无移除项，Local-First 是增量改造，现有功能全部保留作为降级路径）
