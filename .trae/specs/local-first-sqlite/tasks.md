# Tasks

## Phase 1: 基础设施搭建

- [x] Task 1: 安装 better-sqlite3 并配置 Electron 原生模块构建
  - [x] SubTask 1.1: 安装 `better-sqlite3` 依赖，配置 `electron-rebuild` 确保原生模块与 Electron 版本兼容
  - [x] SubTask 1.2: 在 `electron-builder.yml` 或 `package.json` 的 build 配置中添加 `better-sqlite3` 到 native 模块列表，确保 ASAR 打包时正确处理
  - [x] SubTask 1.3: 验证开发模式下 `better-sqlite3` 可正常加载（`npm run electron:dev`）

- [x] Task 2: 实现 SQLite Schema 适配层
  - [x] SubTask 2.1: 创建 `electron/db/schema.ts`，定义 PostgreSQL → SQLite 类型映射规则（JSONB→TEXT+JSON, vector→TEXT, 枚举→TEXT, TIMESTAMPTZ→TEXT, UUID→TEXT）
  - [x] SubTask 2.2: 创建 `electron/db/migrations/` 目录，编写首批迁移文件，覆盖核心表：`users`, `knowledge_graphs`, `knowledge_points`, `graph_nodes`, `edges`, `relationship_types`, `domains`, `graph_domains`, `study_cards`, `quiz_sets`, `queues`, `user_tasks`, `focus_sessions`, `notifications`, `prompt_templates`, `ai_actions`, `achievements`, `learning_paths`
  - [x] SubTask 2.3: 每张本地表额外添加 `sync_status TEXT DEFAULT 'synced'` 和 `local_updated_at TEXT` 列，用于同步追踪
  - [x] SubTask 2.4: 创建 `sync_metadata` 表（`table_name TEXT PK, last_sync_at TEXT, sync_direction TEXT`）
  - [x] SubTask 2.5: 创建 `sync_conflicts` 表（`id TEXT PK, table_name TEXT, record_id TEXT, local_data TEXT, remote_data TEXT, resolved INTEGER DEFAULT 0, created_at TEXT`）

- [x] Task 3: 实现 SQLite 数据库管理器
  - [x] SubTask 3.1: 创建 `electron/db/database.ts`，实现 `DatabaseManager` 类：初始化数据库连接、执行迁移、关闭连接
  - [x] SubTask 3.2: 实现迁移版本管理：`getCurrentVersion()` 和 `runMigrations()`，支持增量迁移
  - [x] SubTask 3.3: 实现通用 CRUD 方法：`findAll(table, filters)`, `findById(table, id)`, `create(table, data)`, `update(table, id, data)`, `delete(table, id)`
  - [x] SubTask 3.4: 实现批量操作方法：`batchCreate(table, items)`, `batchUpdate(table, items)`，使用事务保证原子性
  - [x] SubTask 3.5: JSONB 字段自动序列化/反序列化（读取时 `JSON.parse`，写入时 `JSON.stringify`）

## Phase 2: IPC 数据通道

- [x] Task 4: 实现 IPC 数据访问层
  - [x] SubTask 4.1: 在 `electron/main.ts` 中注册 IPC 处理器：`db:query`, `db:batch`, `db:raw`
  - [x] SubTask 4.2: 实现 IPC 请求路由：根据 `{ resource, method, params }` 路由到 `DatabaseManager` 对应方法
  - [x] SubTask 4.3: 在 `electron/preload.ts` 中暴露 `db` 命名空间：`query()`, `batch()`, `getStatus()`
  - [x] SubTask 4.4: 定义 IPC 请求/响应 TypeScript 类型（`IpcDbRequest`, `IpcDbResponse`），放在 `shared/types/` 目录

- [x] Task 5: 实现前端 IPC 客户端
  - [x] SubTask 5.1: 创建 `src/services/api/localClient.ts`，封装 `window.electronAPI.db.query()` 调用
  - [x] SubTask 5.2: 实现 `localClient` 的 API 接口，与现有 `request()` 函数签名对齐，方便适配层切换
  - [x] SubTask 5.3: 实现降级逻辑：IPC 调用失败时自动回退到 HTTP API

## Phase 3: 前端 API 适配

- [x] Task 6: 修改 API 适配层支持 Local-First 路由
  - [x] SubTask 6.1: 修改 `src/services/api/client.ts`，在 `request()` 函数中添加 Local-First 路由逻辑
  - [x] SubTask 6.2: 定义云端专属操作白名单（AI、向量搜索、RAG 等），这些操作始终走 HTTP
  - [x] SubTask 6.3: 实现 `tryLocalQuery` 辅助函数，解析 URL 并路由到 IPC
  - [x] SubTask 6.4: 确保开发模式（`npm run electron:dev`）不启用 IPC 路径，保持现有行为

## Phase 4: 双向同步引擎

- [x] Task 7: 实现后端同步 API
  - [x] SubTask 7.1: 创建 `api/routes/sync.ts`，实现 `POST /api/sync/pull` 端点：接收各表时间戳，返回增量数据
  - [x] SubTask 7.2: 实现 `POST /api/sync/push` 端点：接收批量操作，应用变更到 Supabase，返回每条结果
  - [x] SubTask 7.3: 实现 `GET /api/sync/status` 端点：返回各表的最新 `updated_at` 时间戳，供客户端校对
  - [x] SubTask 7.4: Push 端点中实现 RLS 权限校验，确保用户只能推送自己有权限的数据
  - [x] SubTask 7.5: Push 端点中实现冲突检测：如果云端 `updated_at` 晚于 push 请求中的 `client_updated_at`，标记为冲突

- [x] Task 8: 实现本地同步引擎
  - [x] SubTask 8.1: 创建 `electron/sync/syncEngine.ts`，实现 `SyncEngine` 类
  - [x] SubTask 8.2: 实现 Pull 同步：调用 `/api/sync/pull`，将云端变更 merge 到本地 SQLite（upsert 逻辑：存在则更新，不存在则插入）
  - [x] SubTask 8.3: 实现 Push 同步：查询本地 `sync_status = 'pending_push'` 的记录，调用 `/api/sync/push` 推送
  - [x] SubTask 8.4: 实现冲突处理：Push 失败且为冲突时，将冲突记录写入 `sync_conflicts` 表，保留本地数据不变
  - [x] SubTask 8.5: 实现定时同步：默认 30 秒间隔自动执行 Pull + Push，网络断开时暂停
  - [x] SubTask 8.6: 实现首次全量同步：本地数据库为空时，从云端全量拉取所有用户数据
  - [x] SubTask 8.7: 实现网络状态监听：网络恢复时立即触发一次同步

- [x] Task 9: 集成同步引擎到 Electron 主进程
  - [x] SubTask 9.1: 修改 `electron/main.ts`，在 API 服务器启动后初始化 `SyncEngine`
  - [x] SubTask 9.2: 新增 IPC 通道 `sync:getStatus`、`sync:trigger`、`sync:pause`、`sync:resume`，供渲染进程控制同步
  - [x] SubTask 9.3: 在 `preload.ts` 中暴露 `sync` 命名空间

## Phase 5: 同步状态 UI

- [x] Task 10: 实现同步状态指示器和面板
  - [x] SubTask 10.1: 创建 `src/components/common/SyncStatusIndicator.tsx`，显示全局同步状态图标（已同步/同步中/离线/错误）
  - [x] SubTask 10.2: 创建 `src/components/common/SyncDetailPanel.tsx`，显示同步详情（最后同步时间、待推送/拉取数量、冲突数量）
  - [x] SubTask 10.3: 创建 `src/components/common/SyncConflictPanel.tsx`，展示冲突列表，支持用户选择保留本地或云端版本
  - [x] SubTask 10.4: 在主 Layout 中集成 `SyncStatusIndicator`，点击展开 `SyncDetailPanel`
  - [x] SubTask 10.5: 创建 `src/hooks/common/useSyncStatus.ts`，通过 IPC 获取同步状态，轮询更新

## Phase 6: 集成测试与验证

- [x] Task 11: 端到端集成测试
  - [x] SubTask 11.1: 编写 Electron 启动测试：验证 SQLite 初始化、迁移执行、IPC 通道可用
  - [x] SubTask 11.2: 编写离线场景测试：断网后创建/编辑图谱，验证本地操作正常，重连后数据同步
  - [x] SubTask 11.3: 编写同步冲突测试：本地和云端同时修改同一记录，验证冲突检测和解决流程
  - [x] SubTask 11.4: 编写首次全量同步测试：新设备登录后全量拉取数据，验证数据完整性
  - [x] SubTask 11.5: 编写降级测试：SQLite 初始化失败时，验证降级到 HTTP 模式的行为

# Task Dependencies

- Task 2 依赖 Task 1（需要 better-sqlite3 可用）
- Task 3 依赖 Task 2（需要 Schema 定义）
- Task 4 依赖 Task 3（需要 DatabaseManager）
- Task 5 依赖 Task 4（需要 IPC 通道）
- Task 6 依赖 Task 5（需要 localClient）
- Task 8 依赖 Task 7（需要后端同步 API）和 Task 3（需要本地数据库）
- Task 9 依赖 Task 8（需要 SyncEngine）
- Task 10 依赖 Task 9（需要同步 IPC 通道）
- Task 11 依赖 Task 10（需要完整功能）
- Task 1 可独立开始
- Task 7 可与 Task 2-6 并行开发
