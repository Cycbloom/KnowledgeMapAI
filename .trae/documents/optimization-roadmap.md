# KnowledgeMap 架构优化路线图

> 生成时间：2026-06-28
> 范围：后端 (api/)、前端 (src/)、Electron (electron/)、移动端 (android/ + src/services/mobile/)、共享层 (shared/)、数据库 (supabase/migrations/)
> 用途：作为后续多轮优化的参考清单，按优先级分批实施

---

## 一、分析概述

### 1.1 项目技术栈

- **运行目标**：Electron 桌面（主）、Web（辅）、Android（Capacitor，辅）
- **后端**：Express + TypeScript，Supabase（PostgreSQL）+ pgvector，NodeCache 内存缓存
- **前端**：React 18 + Vite + Zustand + TanStack Query + React Router + Tailwind + Three.js（@react-three/fiber）+ d3-force + umap-js
- **AI**：多 Provider（OpenAI、Deepseek、Aliyun、Moonshot、Zhipu），RAG/Embedding/Agent/Chat
- **学习算法**：ts-fsrs（替代 SM2，但旧 SM2 残留）
- **同步**：Electron 用 operation-based（sync_operations 表）；Mobile 用 LAN P2P + IndexedDB；API 用 timestamp-based

### 1.2 评估方法

通过 4 个并行子代理对四层架构（后端、前端、跨平台、数据/基础设施）进行深度审查，共扫描 200+ 文件，输出原始发现 150+ 条。本文档对其进行去重、归并与优先级排序，形成最终可执行清单。

### 1.3 关键指标

| 维度 | 数量 |
|------|------|
| 总优化点 | 78 |
| P0（正确性/安全，需立即修复） | 14 |
| P1（架构/性能，高优先级） | 24 |
| P2（可维护性/类型安全） | 26 |
| P3（可扩展性/长周期） | 14 |

---

## 二、优先级矩阵（总览）

### P0 — 立即修复（影响正确性或安全）

| # | 优化点 | 域 | 影响类型 |
|---|--------|----|---------|
| P0-01 | 流式响应被 `withTimeoutAndRetry` 包裹导致内容重复 | AI | 正确性 |
| P0-02 | 路由层直连 admin Supabase 客户端绕过 RLS | 后端/安全 | 安全 |
| P0-03 | `validate.ts` 响应格式与 errorHandler 不一致 | 错误处理 | 一致性 |
| P0-04 | `aiActions.ts` 完全跳过 zod 校验 | 校验 | 安全 |
| P0-05 | `update_user_focus_stats` 触发器 streak 计算逻辑 bug | 数据库 | 正确性 |
| P0-06 | JWT 密钥缺失时静默生成 in-memory 密钥 | 安全 | 安全 |
| P0-07 | `ai_performance_logs` RLS 策略越权（任意用户可读所有日志） | 数据库/隐私 | 隐私 |
| P0-08 | `document_chunks` 表未启用 RLS | 数据库/安全 | 安全 |
| P0-09 | Embedding 缓存键用 32 位 DJB2 弱哈希，存在碰撞 | RAG | 正确性 |
| P0-10 | `backfill_embeddings.ts` 脚本指向不存在的 `nodes` 表 | 脚本 | 不可用 |
| P0-11 | `enrichMetadata` 查询不存在的 `profiles` 表（实为 `users`） | 监控 | 监控失效 |
| P0-12 | `operationMerger` 未处理 delete+update，丢失删除意图 | 同步 | 正确性 |
| P0-13 | Electron `sandbox: false` + Capacitor `cleartext/mixedContent/debuggingEnabled` | 安全 | 安全 |
| P0-14 | `authConfig.ts` 硬编码本地 Supabase anon key | 安全 | 安全 |

### P1 — 高优先级（架构/性能）

| # | 优化点 | 域 | 影响类型 |
|---|--------|----|---------|
| P1-01 | AI Provider 实例每次调用都重建（性能热点） | AI/性能 | 性能 |
| P1-02 | RAG 主 chat 与 streamChat 未走性能监控 | AI/监控 | 可观测性 |
| P1-03 | EmbeddingService 全程未走监控 | AI/监控 | 可观测性 |
| P1-04 | Embedding 批量更新 N+1（20 条 = 20 次 round trip） | AI/性能 | 性能 |
| P1-05 | 缺失复合索引（`agent_messages(session_id, timestamp)` 等） | 数据库/性能 | 性能 |
| P1-06 | `requireAdmin` 中间件重复定义且查不同表 | 后端 | 一致性 |
| P1-07 | `getOrSet` 推广不足，热点路径未做请求去重 | 缓存/性能 | 性能 |
| P1-08 | LRU 淘汰 O(N) 全表扫描 | 缓存/性能 | 性能 |
| P1-09 | `transactionExecutor` 几乎未使用，多步写无事务 | 数据库 | 正确性 |
| P1-10 | `ragService.keywordSearch` 用 ilike 全表扫描未利用 trgm 索引 | RAG/性能 | 性能 |
| P1-11 | `promptService.getTemplate` 拉所有模板到内存过滤 | AI/性能 | 性能 |
| P1-12 | `enrichMetadata` 每次 AI 调用前 2 次 DB 查询且未缓存 | AI/性能 | 性能 |
| P1-13 | GraphEditor.tsx 1627 行巨型组件 | 前端 | 可维护性 |
| P1-14 | `useGraphEditorState` 展开返回新对象引发全树重渲染 | 前端/性能 | 性能 |
| P1-15 | `useAIPerformanceStore` 违反 Zustand vs TanStack Query 边界 | 前端 | 可维护性 |
| P1-16 | `useConsoleStore` 持久化无限增长的 output 数组到 localStorage | 前端/性能 | 性能 |
| P1-17 | `useTaskMutations` 失效范围过宽（全 tasks 缓存清空） | 前端/性能 | 性能 |
| P1-18 | React.memo 覆盖率极低（仅 5 处） | 前端/性能 | 性能 |
| P1-19 | 移动端服务被无条件静态 import 打入 Web bundle | 前端/性能 | 性能 |
| P1-20 | 删除 `src/services/sync/syncTypes.ts` + `conflictService.ts`，统一用 `shared/sync` | 跨平台 | 可维护性 |
| P1-21 | Kernel 系统前后端重复实现（约 200 行） | 跨平台 | 可维护性 |
| P1-22 | Electron 主进程无结构化日志，全用 `console.*` | Electron | 合规/可观测性 |
| P1-23 | `mobileSyncService` 无重试机制，单次失败即放弃 | 同步/移动 | 可靠性 |
| P1-24 | `mobileSyncService` 无幂等性保证 | 同步/移动 | 正确性 |

### P2 — 中优先级（可维护性/类型安全）

| # | 优化点 | 域 | 影响类型 |
|---|--------|----|---------|
| P2-01 | 超大文件拆分（`AgentService.ts` 40K 字符等） | 后端 | 可维护性 |
| P2-02 | 超大路由文件拆分（`ai/config.ts` 18K 字符等 9 个） | 后端 | 可维护性 |
| P2-03 | 路由内联 zod schema，未集中到 `schemas/` | 后端 | 一致性 |
| P2-04 | 路由层错误处理三种风格混用 | 后端 | 一致性 |
| P2-05 | `req.supabase!` 222 处非空断言违反项目规则 | 后端 | 类型安全 |
| P2-06 | `errorHandler` 使用 `any` 类型 + `(req as any).user` | 后端 | 类型安全 |
| P2-07 | 28 个文件 150 处 `any` 类型 | 后端 | 类型安全 |
| P2-08 | `requireAuth` 每请求调 Supabase Auth（应用 jwtService 本地验证） | 后端/性能 | 性能 |
| P2-09 | `pricingService` 硬编码模型表，OpenAI/Zhipu/Moonshot 缺失 | AI | 成本统计 |
| P2-10 | `performanceMonitor` 内存+DB 混合，单实例假设 | 监控 | 可扩展性 |
| P2-11 | SSE/eventBus 完全单实例，无横向扩展（Web 部署前必修） | 实时通信 | 可扩展性 |
| P2-12 | `eventBus` fire-and-forget，无重试与死信 | 实时通信 | 正确性 |
| P2-13 | retry 配置无差异化（embedding/chat/reasoning 同配置） | AI | 性能 |
| P2-14 | 缺少 Supabase 自动生成类型，手写 `database.ts` 易漂移 | 类型 | 正确性 |
| P2-15 | `User` 类型三处定义冲突 | 类型 | 正确性 |
| P2-16 | 26 个文件使用 `as any`，17 处非空断言 `!` | 前端 | 类型安全 |
| P2-17 | i18n：JSX 中 386 处硬编码中文字符串 | 前端 | i18n |
| P2-18 | 错误处理三套机制重叠（errors.ts/useError.ts/asyncHandler.ts） | 前端 | 可维护性 |
| P2-19 | `errorReporter` 全局 override `console.error` 造成噪声 | 前端 | 可观测性 |
| P2-20 | HNSW 索引参数未调优，查询未设置 `ef_search` | 数据库 | 性能 |
| P2-21 | 分块策略过简单，无语言感知（中英文 token 差异 7 倍） | RAG | 召回质量 |
| P2-22 | 混合搜索缺少真正的 BM25 稀疏检索 | RAG | 召回质量 |
| P2-23 | Reranking 调用无缓存与阈值（候选仅 2-3 也调用） | RAG | 成本 |
| P2-24 | Cron 任务无分布式锁，多实例会重复执行 | 调度 | 正确性 |
| P2-25 | `asyncTaskService` 无启动恢复与并发控制 | 调度 | 可靠性 |
| P2-26 | `tsconfig.electron.json` 关闭 `strict` 违反项目规则 | 配置 | 类型安全 |

### P3 — 长周期（可扩展性/清理）

| # | 优化点 | 域 | 影响类型 |
|---|--------|----|---------|
| P3-01 | Kernel 启动顺序耦合模块加载阶段 | 后端 | 可测试性 |
| P3-02 | 缺少 Repository 层，服务内联原始查询 | 后端 | 可维护性 |
| P3-03 | 服务相互循环依赖（chatService ↔ aiService ↔ promptService） | 后端 | 可测试性 |
| P3-04 | 抽取 Repository/RepositoryBase 统一 softDelete/filter | 后端 | 可维护性 |
| P3-05 | `cacheService` 单进程，多实例部署不一致 | 缓存 | 可扩展性 |
| P3-06 | Rate limiter 单实例内存，多实例可绕过 | 安全 | 可扩展性 |
| P3-07 | Refresh token 不轮换 | 安全 | 安全 |
| P3-08 | Ownership 中间件覆盖不全（缺 graph/task/quiz/template） | 安全 | 安全 |
| P3-09 | `main.ts` IPC 处理器未按域拆分 | Electron | 可维护性 |
| P3-10 | `windowManager`/`trayManager` 为"死代码"，main.ts 重复造轮子 | Electron | 可维护性 |
| P3-11 | `autoUpdater` 强制下载+2 秒后强制重启 | Electron | UX |
| P3-12 | SQLite 与 PostgreSQL 双 schema 定义无自动同步 | 跨平台 | 正确性 |
| P3-13 | 测试覆盖率严重不足（前后端均缺关键模块测试） | 测试 | 质量 |
| P3-14 | 缺少 TypeScript Project References，构建性能与隔离差 | 构建 | 性能 |

---

## 三、详细优化点清单

> 每条优化点结构：**编号 + 标题**、问题文件路径、问题现象、影响、实施方向

### 3.1 P0 详细清单（立即修复）

#### P0-01 流式响应被 retry 包裹导致内容重复

- **文件**：[chatService.ts](file:///d:/KnowledgeMap/api/services/ai/chatService.ts)（行 253-270）
- **现象**：`streamChatCompletion` 把 `provider.client.chat.completions.create({ stream: true })` 整体包在 `withTimeoutAndRetry` 内。若第一次流已发送部分 chunks 后失败，retry 会重新发起请求并再次发送重复内容，客户端会看到"重复段落"。
- **影响**：正确性 / UX
- **方向**：流式只对"建立流连接"做 retry（首 chunk 前可重试）；一旦开始 receive chunks 就不可重试；或干脆 stream 不 retry，仅做 timeout + onChunk 失败上报。

#### P0-02 路由层直连 admin Supabase 客户端绕过 RLS

- **文件**：[aiActions.ts](file:///d:/KnowledgeMap/api/routes/aiActions.ts)、[auth.ts](file:///d:/KnowledgeMap/api/routes/auth.ts)、[ai/content.ts](file:///d:/KnowledgeMap/api/routes/ai/content.ts)、[ai/document.ts](file:///d:/KnowledgeMap/api/routes/ai/document.ts)、[ai/config.ts](file:///d:/KnowledgeMap/api/routes/ai/config.ts)、[database.ts](file:///d:/KnowledgeMap/api/routes/database.ts)、[sync.ts](file:///d:/KnowledgeMap/api/routes/sync.ts)、[rag.ts](file:///d:/KnowledgeMap/api/routes/rag.ts)、[systemMonitor.ts](file:///d:/KnowledgeMap/api/routes/systemMonitor.ts)、[tasks.ts](file:///d:/KnowledgeMap/api/routes/tasks.ts)
- **现象**：共 11 个路由文件 import `getSupabaseAdmin`，在路由处理器内用 admin client 执行用户级 CRUD（如 `aiActionService.listActions(getSupabaseAdmin(), userId, graphId)`），绕过 RLS 与 `req.supabase`（用户上下文 client）。
- **影响**：安全（admin 权限越权）、可维护性、多租户隔离弱化
- **方向**：路由必须只使用 `req.supabase`；只允许 `auth.refresh`、`database.reset`、admin 接口使用 admin client，并在代码层加白名单注释。

#### P0-03 `validate.ts` 响应格式与 errorHandler 不一致

- **文件**：[validate.ts](file:///d:/KnowledgeMap/api/middleware/validate.ts)（行 40-45）
- **现象**：校验失败直接 `res.status(400).json({ success, code, error, details })`，字段名是 `error` 而非 `message`，且缺 `requestId`/`timestamp`，与 [errorHandler.ts](file:///d:/KnowledgeMap/api/middleware/errorHandler.ts)（行 185-191）的 `ErrorResponse` 结构不符。
- **影响**：前端需特殊处理两类响应
- **方向**：改 `validate.ts` 抛 `new AppError(ErrorCodes.VALIDATION_ERROR, { details: errorMessages })`；errorHandler 已支持 details 字段。

#### P0-04 `aiActions.ts` 完全跳过 zod 校验

- **文件**：[aiActions.ts](file:///d:/KnowledgeMap/api/routes/aiActions.ts)（全文件）
- **现象**：4 处 `const userId = (req as any).user.id;`，且全部路由无 `validate({ body: ... })`，直接用 `req.body`。同时违反 `any` 禁令。
- **影响**：安全 / 类型安全
- **方向**：在 `schemas/index.ts` 补 `executeActionSchema` 等，路由加 `validate({ body: ... })`；改用 `AuthRequest` 类型。

#### P0-05 `update_user_focus_stats` 触发器 streak 计算逻辑 bug

- **文件**：[14_functions.sql](file:///d:/KnowledgeMap/supabase/migrations/14_functions.sql)（行 601-649）
- **现象**：函数先 `INSERT ... ON CONFLICT DO UPDATE SET last_focus_date = focus_date`，随后 `SELECT last_focus_date INTO prev_focus_date` —— 此时读到的是刚写入的 `focus_date`，而非"上一次"的日期。导致 `prev_focus_date = focus_date - 1` 永远不成立，连续学习天数（streak）逻辑失效。
- **影响**：正确性（影响所有用户的学习统计）
- **方向**：将 streak 计算移到 `ON CONFLICT DO UPDATE` 的 `WHERE` 子句中，或在 INSERT 前先 SELECT 旧值。

#### P0-06 JWT 密钥缺失时静默生成 in-memory 密钥

- **文件**：[jwtService.ts](file:///d:/KnowledgeMap/api/services/auth/jwtService.ts)（行 25-50）
- **现象**：生产环境若 `JWT_SECRET` 未设且 `.jwt_secret` 文件写入失败，回退到内存随机密钥。进程重启后所有 token 失效；多实例部署每实例密钥不同，token 跨实例无效。
- **影响**：安全 / 可用性
- **方向**：`NODE_ENV=production` 时硬失败 `throw new Error('JWT_SECRET required in production')`。

#### P0-07 `ai_performance_logs` RLS 策略越权

- **文件**：[13_rls_policies.sql](file:///d:/KnowledgeMap/supabase/migrations/13_rls_policies.sql)（行 564-566）
- **现象**：策略 "Authenticated users can view ai performance logs" 使用 `auth.role() = 'authenticated'`，任何登录用户可读取**所有用户**的 AI 调用日志，而 `metadata` 字段含 `graphId`、`userId`、`nodeTitle` 等敏感信息。
- **影响**：隐私 / 安全
- **方向**：增加 `user_id` 列到 `ai_performance_logs`，策略改为 `user_id = auth.uid()` 或仅 admin 读取跨用户日志。

#### P0-08 `document_chunks` 表未启用 RLS

- **文件**：[26_document_chunks.sql](file:///d:/KnowledgeMap/supabase/migrations/26_document_chunks.sql)、[13_rls_policies.sql](file:///d:/KnowledgeMap/supabase/migrations/13_rls_policies.sql)
- **现象**：`document_chunks` 通过 `knowledge_point_id` 关联用户数据，但表未启用 RLS。`match_document_chunks` 函数手动拼接 `visibility`/`owner_id` 过滤，绕过 RLS。
- **影响**：安全
- **方向**：为 `document_chunks` 启用 RLS，策略参照 `knowledge_points`。

#### P0-09 Embedding 缓存键用 32 位 DJB2 弱哈希

- **文件**：[cacheService.ts](file:///d:/KnowledgeMap/api/services/common/cacheService.ts)（行 478-485 `computeTextHash`）、[embeddingOps.ts](file:///d:/KnowledgeMap/api/services/ai/embeddingOps.ts)（行 11）
- **现象**：`((hash << 5) - hash) + char` 是 32 位 DJB2 哈希，基 36 编码后约 6-7 字符。对于 RAG 系统中可能数百万级不同文本，碰撞概率非可忽略。两个不同文本碰撞时，`getOrSet` 返回错误嵌入，导致语义搜索结果错误且无告警。
- **影响**：正确性（RAG 召回错误）
- **方向**：改用 `crypto.createHash('sha256').update(text).digest('hex').slice(0, 32)`。

#### P0-10 `backfill_embeddings.ts` 脚本指向不存在的 `nodes` 表

- **文件**：[backfill_embeddings.ts](file:///d:/KnowledgeMap/scripts/backfill_embeddings.ts)（行 17、51、53）
- **现象**：脚本调用 `from('nodes')`，但实际表名是 `knowledge_points`（见 `03_knowledge_points.sql`）。脚本运行即报 PostgrestError。同时使用 `console.log`（违反日志规范）。
- **影响**：脚本完全不可用
- **方向**：修正为 `knowledge_points`，改用 `logger`。

#### P0-11 `enrichMetadata` 查询不存在的 `profiles` 表

- **文件**：[performanceMonitor.ts](file:///d:/KnowledgeMap/api/services/ai/performanceMonitor.ts)（行 538-543）
- **现象**：`getUserInfo` 查询 `from('profiles')`，但实际用户表是 `users`（`01_core_users.sql` 行 5）。`maybeSingle` 返回 null，`userName` 永远 undefined。
- **影响**：监控元数据缺失
- **方向**：改为 `from('users').select('id, name')`。

#### P0-12 `operationMerger` 未处理 delete+update

- **文件**：[operationMerger.ts](file:///d:/KnowledgeMap/shared/sync/operationMerger.ts)（行 11-50）
- **现象**：处理了 `create+update`、`update+update`、`create+delete`、`delete+任意(覆盖)`，但未处理 `update+create`、`delete+update`（落入 default "保留最新操作"，即保留 update，丢失 delete）。若客户端先 delete 一条记录然后又收到对该记录的 update，merge 后会变成 update，记录被"复活"。
- **影响**：正确性（数据丢失/复活）
- **方向**：补充分支：`existing.action === "delete"` 时，若新 op 是 `update`，应保留 delete（删除意图优先）；若新 op 是 `create`，应保留 create 但带新数据。增加单元测试。

#### P0-13 Electron sandbox + Capacitor 安全配置宽松

- **文件**：[electron/main.ts](file:///d:/KnowledgeMap/electron/main.ts)（行 268 `sandbox: false`）、[capacitor.config.ts](file:///d:/KnowledgeMap/capacitor.config.ts)
- **现象**：Electron `sandbox: false` 让 preload 可访问 Node API；Capacitor `cleartext: true`、`allowMixedContent: true`、`webContentsDebuggingEnabled: true` 允许明文 HTTP 与生产可调试。
- **影响**：安全
- **方向**：开启 Electron `sandbox: true`（preload 仅用 `ipcRenderer`，无需 Node）；Capacitor 仅在 dev 环境开启 `cleartext/mixedContent/debuggingEnabled`，生产关闭。

#### P0-14 `authConfig.ts` 硬编码本地 Supabase anon key

- **文件**：[authConfig.ts](file:///d:/KnowledgeMap/src/config/authConfig.ts)（行 4-5）
- **现象**：`LOCAL_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."` 硬编码在源码中。
- **影响**：安全 / 可维护性
- **方向**：移到 `.env.development` 的 `VITE_SUPABASE_ANON_KEY`，authConfig 只读 env。

---

### 3.2 P1 详细清单（高优先级 — 架构/性能）

#### P1-01 AI Provider 实例每次调用都重建

- **文件**：[factory.ts](file:///d:/KnowledgeMap/api/services/ai/factory.ts)（行 14-29）、[providers/base.ts](file:///d:/KnowledgeMap/api/services/ai/providers/base.ts)（行 23-26）
- **现象**：`getAIProvider` 每次调用都 `return new DeepseekProvider(config)`，构造函数内 `new OpenAI({...})`。一次 RAG chat 会调用 3-5 次 `getAIProvider`。
- **影响**：性能（OpenAI SDK 初始化 HTTP client 较重）、GC 压力
- **方向**：引入 provider 单例缓存 `Map<AIProviderType, AIProvider>`，config 变更时显式失效。

#### P1-02 RAG 主 chat 与 streamChat 未走性能监控

- **文件**：[ragService.ts](file:///d:/KnowledgeMap/api/services/ai/ragService.ts)（行 965-1003 chat、1071-1178 streamChat）
- **现象**：`chat()` 内的 `aiProvider.client.chat.completions.create(...)` 未包 `withAIMonitoring`；`streamChat` 既无监控也无 timeout/retry。
- **影响**：监控覆盖缺口（RAG 是 token 大户）
- **方向**：让两者都用 `withAIMonitoring` 包装；流式版本读 `chunk.usage`（需 `stream_options: { include_usage: true }`）。

#### P1-03 EmbeddingService 全程未走监控

- **文件**：[embeddingService.ts](file:///d:/KnowledgeMap/api/services/ai/embeddingService.ts)、[embeddingOps.ts](file:///d:/KnowledgeMap/api/services/ai/embeddingOps.ts)
- **现象**：`withEmbeddingMonitoring` 已定义但从未被调用；embedding 成本/耗时完全未上报。
- **影响**：监控覆盖缺口、成本不可见
- **方向**：在 `aiService.generateEmbedding`、`generateEmbeddingsBatch` 内统一包 `withEmbeddingMonitoring`。

#### P1-04 Embedding 批量更新 N+1

- **文件**：[embeddingService.ts](file:///d:/KnowledgeMap/api/services/ai/embeddingService.ts)（行 64-79、149-165）
- **现象**：内层循环 `for (let j = 0; j < batch.length; j++) { await supabase.from('knowledge_points').update({embedding}).eq('id', batch[j].id) }`，单条 update。20 条 batch = 20 次 round trip。
- **影响**：性能（IO 时间放大 20 倍）
- **方向**：使用 PostgREST 批量 upsert：`supabase.from('knowledge_points').upsert(batch.map(...), { onConflict: 'id' })`；或 RPC `update_embeddings_batch(payload jsonb)`。

#### P1-05 缺失复合索引

- **文件**：[12_indexes.sql](file:///d:/KnowledgeMap/supabase/migrations/12_indexes.sql)、[28_agent_sessions.sql](file:///d:/KnowledgeMap/supabase/migrations/28_agent_sessions.sql)
- **现象**：
  - `agent_messages` 仅有单列 `idx_agent_messages_session_id`，但查询 `.eq('session_id', sessionId).order('timestamp', { ascending: true })` 缺 `(session_id, timestamp)` 复合索引
  - `agent_tool_calls` 同样缺复合索引
  - `ai_performance_logs` 同样
- **影响**：性能（大表 sort 需 filesort）
- **方向**：添加 `CREATE INDEX IF NOT EXISTS idx_agent_messages_session_ts ON agent_messages(session_id, timestamp ASC)` 等。

#### P1-06 `requireAdmin` 中间件重复定义

- **文件**：[auth.ts](file:///d:/KnowledgeMap/api/middleware/auth.ts)（行 124-150）、[ownership.ts](file:///d:/KnowledgeMap/api/middleware/ownership.ts)（行 32-44）
- **现象**：两份实现且查的表不同：auth.ts 版本查 `users.role`；ownership.ts 版本调 `authService.getProfile(req.user.id)`（查 `profiles` 表，且 `profiles` 表实际不存在，见 P0-11）。`knowledgePoints.ts:14` 从 ownership 导入 `requireAdmin`。
- **影响**：正确性（权限判定结果可能不一致）、维护性
- **方向**：删除其中一份；统一通过 `authService.getProfile` + cacheService 缓存用户角色。

#### P1-07 `getOrSet` 推广不足

- **文件**：[promptService.ts](file:///d:/KnowledgeMap/api/services/ai/promptService.ts)（行 1172）、[graphService.ts](file:///d:/KnowledgeMap/api/services/graph/graphService.ts)、[graphNodeService.ts](file:///d:/KnowledgeMap/api/services/graph/graphNodeService.ts)
- **现象**：大量 service 方法用 `const cached = await cacheService.get(key); if (cached) return cached; const data = await fetch(); await cacheService.set(key, data);` 模式，未用现成的 `getOrSet`（含 pending request 去重）。
- **影响**：性能（高并发下同一 key 多次穿透 DB）
- **方向**：全面替换为 `getOrSet`。

#### P1-08 LRU 淘汰 O(N) 全表扫描

- **文件**：[cacheService.ts](file:///d:/KnowledgeMap/api/services/common/cacheService.ts)（行 93-106）
- **现象**：当 keys 数 ≥ MAX_CACHE_KEYS（1000）时，每次 set 都 `for (const [k, t] of accessOrder)` 全表扫描找最旧 key。
- **影响**：性能（缓存写性能在满载时退化为 O(N)）
- **方向**：改用 `lru-cache` 库（专门优化的 LRU）；或维护一个最小堆按 accessTime 排序。

#### P1-09 `transactionExecutor` 几乎未被使用

- **文件**：[transactionExecutor.ts](file:///d:/KnowledgeMap/api/database/transactionExecutor.ts)、[index.ts](file:///d:/KnowledgeMap/api/database/index.ts)、[graphs/crud.ts](file:///d:/KnowledgeMap/api/routes/graphs/crud.ts)（行 128-138）
- **现象**：工具类设计良好但极少使用。多步写操作如 `graphService.createGraph` 后又 `graphDomainService.updateGraphDomains`，中间失败会留下孤立 graph 记录。
- **影响**：正确性（数据不一致）
- **方向**：梳理所有"先 create 主资源 + 再 create 关联资源"的场景，统一用 `executeInTransaction`。

#### P1-10 `ragService.keywordSearch` 用 ilike 全表扫描

- **文件**：[ragService.ts](file:///d:/KnowledgeMap/api/services/ai/ragService.ts)（行 271-280）
- **现象**：`.or('title.ilike."%query%",content.ilike."%query%"')`，未利用 `12_indexes.sql:26-27` 中已有的 `idx_knowledge_points_title_trgm`（pg_trgm GIN 索引）。PostgREST 的 `ilike` 走全表扫描，trgm 索引只在 `LIKE`/`~` 操作符下生效。
- **影响**：性能（大表全表扫描）
- **方向**：改用 `.or(\`title.like."${pattern}",content.like."${pattern}"\`)` 或 textSearch。

#### P1-11 `promptService.getTemplate` 拉所有模板到内存过滤

- **文件**：[promptService.ts](file:///d:/KnowledgeMap/api/services/ai/promptService.ts)（行 1176-1213）
- **现象**：`supabase.from('prompt_templates').select('*').eq('code', code)` 拉所有 scope（system + 所有 user + 所有 graph）的模板，然后内存 `.filter` 取 relevant。
- **影响**：性能（用户量大时返回行数膨胀）、安全（admin client 看到所有用户模板）
- **方向**：用 PostgREST `or` 过滤；或加 `.in('user_id', [userId])` + scope 条件组合。

#### P1-12 `enrichMetadata` 每次 AI 调用前 2 次 DB 查询且未缓存

- **文件**：[performanceMonitor.ts](file:///d:/KnowledgeMap/api/services/ai/performanceMonitor.ts)（行 522-544）
- **现象**：`enrichMetadata` 在 chatService 每次调用前都额外发两个查询（`getGraphInfo`、`getUserInfo`），且未缓存。
- **影响**：性能（每次 AI 调用前多 2 次 DB round trip）
- **方向**：`enrichMetadata` 走 `cacheService.getOrSet`（key 含 graphId/userId，TTL 5min）。

#### P1-13 GraphEditor.tsx 1627 行巨型组件

- **文件**：[GraphEditor.tsx](file:///d:/KnowledgeMap/src/pages/GraphEditor.tsx)
- **现象**：混合了叙事模式、演示模式、学习路径选择、移动端操作菜单、右键菜单、键盘快捷键、AI 操作、导出操作等至少 8 类关注点；导入 15+ 个 hooks，约 25 个本地 useState。
- **影响**：可维护性、可测试性、HMR 性能
- **方向**：按"模式"或"功能区"拆分为多个编排子组件（`<NarrativeModePanel>`、`<PresentationModePanel>`、`<MobileActionMenu>`、`<ContextMenuLayer>`、`<KeyboardShortcutLayer>` 等），主组件仅负责组合。

#### P1-14 `useGraphEditorState` 展开返回新对象引发重渲染

- **文件**：[graphEditor/index.ts](file:///d:/KnowledgeMap/src/hooks/graphEditor/index.ts)
- **现象**：`useGraphEditorState` 通过展开 10 个子 hook 返回新对象，每次渲染都生成新引用，下游 memoized 子组件的浅比较失效。
- **影响**：性能（全树重渲染）
- **方向**：用 `useMemo` 包裹返回对象；或采用 context + selector 模式让子组件仅订阅所需切片。

#### P1-15 `useAIPerformanceStore` 违反 Zustand vs TanStack Query 边界

- **文件**：[useAIPerformanceStore.ts](file:///d:/KnowledgeMap/src/store/useAIPerformanceStore.ts)
- **现象**：内含 `fetchLogs`、`fetchStats`、`clearLogs` 方法直接调用 `request()`，将服务端状态混入 UI store，绕过 TanStack Query 的缓存/失效/重试/去重。
- **影响**：可维护性 / 性能 / 正确性
- **方向**：将 `fetchLogs`/`fetchStats` 迁移到 `useAiPerformanceQueries.ts`，store 仅保留 UI 状态。

#### P1-16 `useConsoleStore` 持久化无限增长数组到 localStorage

- **文件**：[useConsoleStore.ts](file:///d:/KnowledgeMap/src/store/useConsoleStore.ts)
- **现象**：`output[]` 与 `history[]` 持久化到 localStorage（key `knowledgeMap-console`），长时间运行后 output 数组无限增长，localStorage 配额耗尽风险高。
- **影响**：性能 / 存储
- **方向**：仅持久化 `history[]`（上限 50 条），`output[]` 在 persist `partialize` 中排除。

#### P1-17 `useTaskMutations` 失效范围过宽

- **文件**：[useTaskMutations.ts](file:///d:/KnowledgeMap/src/hooks/mutations/useTaskMutations.ts)
- **现象**：仅 3 个 mutation（create/retry/delete），均使用 `createInvalidationMutation` 失效 `[["tasks"]]`，会清除所有 tasks 相关查询缓存（含不同 status/limit/offset 变体）。
- **影响**：性能 / UX（列表全量重拉，抖动）
- **方向**：使用细粒度 queryKey 失效（参考 `queries/config.ts` 中的 `queryKeys.tasks`），或采用 optimistic update 局部更新。

#### P1-18 React.memo 覆盖率极低

- **文件**：全局仅 5 处使用 `React.memo`：`MindMapNode`、`MindMapLink`、`TreeNode`、`DraggableTaskCard`、`TaskCard`
- **现象**：列表型/高频更新组件（节点、卡片、行）未 memo，父组件状态变化会触发全量重渲染。
- **影响**：性能（3D 图谱与长列表场景尤其明显）
- **方向**：对所有纯展示型列表项批量添加 `React.memo` + 浅比较；配合 P1-14 的 selector 优化。

#### P1-19 移动端服务被无条件静态 import 打入 Web bundle

- **文件**：[adapter.ts](file:///d:/KnowledgeMap/src/services/api/adapter.ts)（行 3 `import { mobileApi } from "../mobile";`）、[mobile/index.ts](file:///d:/KnowledgeMap/src/services/mobile/index.ts)
- **现象**：Web 用户永远不会用到 mobileApi，但它通过 adapter 的静态 import 被打入主 chunk。fsrsEngine、scheduler、aiClient 等大量代码都被打入 Web bundle。
- **影响**：性能（Web bundle 体积膨胀）
- **方向**：将 adapter 改为动态 import；在 vite.config.ts 的 `getChunkStrategy` 中将 `src/services/mobile` 单独切分为 `mobile-only` chunk。

#### P1-20 删除 sync 重复实现，统一用 `shared/sync`

- **文件**：[syncTypes.ts](file:///d:/KnowledgeMap/src/services/sync/syncTypes.ts)、[conflictService.ts](file:///d:/KnowledgeMap/src/services/sync/conflictService.ts)、[mobileSyncService.ts](file:///d:/KnowledgeMap/src/services/sync/mobileSyncService.ts)（行 19-56）、[shared/sync/](file:///d:/KnowledgeMap/shared/sync/)
- **现象**：`SyncOperation` 类型双轨制（字段名 `action/data/recordId` vs `type/record/recordId`）；`conflictService` 完整重写了 `detectConflict`/`autoResolveConflict`/`mergeOperations`，与 `shared/sync/conflictDetector.ts` + `conflictResolver.ts` 逻辑几乎一致但用不同类型；`mobileSyncService` 用 `toSharedOperation`/`fromSharedOperation` 来回转换。
- **影响**：可维护性 / 正确性（容易漂移）
- **方向**：删除 `src/services/sync/syncTypes.ts` 和 `conflictService.ts`，让 mobileSyncService 直接使用 `shared/sync` 的类型和函数。

#### P1-21 Kernel 系统前后端重复实现

- **文件**：[src/services/kernel/Kernel.ts](file:///d:/KnowledgeMap/src/services/kernel/Kernel.ts)、[api/services/kernel/Kernel.ts](file:///d:/KnowledgeMap/api/services/kernel/Kernel.ts)
- **现象**：两者都实现了 `registerPlugin`/`activatePlugin`/`deactivatePlugin`/`activateAll`/`deactivateAll`/`getDependents`/`cleanupPluginRegistrations`，逻辑高度相似；类型不兼容（`Plugin.onInstall(kernel: FrontendKernelAPI)` vs `KernelAPI`）。
- **影响**：可维护性（约 200 行重复代码）
- **方向**：抽取 `shared/kernel/PluginLifecycleBase.ts`，定义抽象的 install/activate/deactivate 模板方法，前后端各继承实现自己的 API。

#### P1-22 Electron 主进程无结构化日志

- **文件**：[electron/main.ts](file:///d:/KnowledgeMap/electron/main.ts)（30+ 处 console.*）、[syncEngine.ts](file:///d:/KnowledgeMap/electron/sync/syncEngine.ts)（10+ 处）、[dbHandlers.ts](file:///d:/KnowledgeMap/electron/ipc/dbHandlers.ts)
- **现象**：Electron 主进程全用 `console.*`，违反项目规则"后端：使用 logger 工具，禁止 console"。
- **影响**：合规性 / 可观测性
- **方向**：在 `electron/utils/logger.ts` 复用 `api/utils/logger.ts` 的 Logger 类，将所有 `console.*` 替换。

#### P1-23 `mobileSyncService` 无重试机制

- **文件**：[mobileSyncService.ts](file:///d:/KnowledgeMap/src/services/sync/mobileSyncService.ts)（行 165-231）
- **现象**：`syncWithDevice` 仅 try/catch + `console.warn`，单次失败即跳过该设备，无指数退避、无失败计数，下次同步要等 15 分钟。
- **影响**：可靠性（移动网络不稳定时）
- **方向**：复用 `api/utils/retry.ts` 的 `withTimeoutAndRetry`，或抽到 `shared/sync/retry.ts` 让 Electron 和 Mobile 共用。

#### P1-24 `mobileSyncService` 无幂等性保证

- **文件**：[mobileSyncService.ts](file:///d:/KnowledgeMap/src/services/sync/mobileSyncService.ts)（行 259-298）
- **现象**：`applyOperation` 直接 supabase.insert/update/delete，无幂等键。若 push 后网络中断未收到响应，重试会触发重复 insert。
- **影响**：正确性
- **方向**：为每个 SyncOperation 生成 `clientOpId`（UUID），在 supabase 表加 `last_applied_op_id` 列，applyOperation 前检查是否已应用。

---

### 3.3 P2 详细清单（中优先级 — 可维护性/类型安全）

#### P2-01 超大文件拆分

- **文件**（按字符数排序）：
  - [AgentService.ts](file:///d:/KnowledgeMap/api/services/agent/AgentService.ts)（40282 字符）
  - [literatureApplyService.ts](file:///d:/KnowledgeMap/api/services/literature/literatureApplyService.ts)（27892）
  - [achievementService.ts](file:///d:/KnowledgeMap/api/services/achievementService.ts)（23876）
  - [learningTools.ts](file:///d:/KnowledgeMap/api/services/agent/tools/learningTools.ts)（19314）
  - [aiActionService.ts](file:///d:/KnowledgeMap/api/services/ai/aiActionService.ts)（18286）
  - [cacheService.ts](file:///d:/KnowledgeMap/api/services/common/cacheService.ts)（16335）
- **方向**：按职责拆分。`AgentService` 拆为 `SessionOrchestrator` + `ToolExecutor` + `SSEWriter` + `PendingActionManager`；`cacheService` 拆为 `cacheCore` + `cacheInvalidation` + `cacheWarmup`。

#### P2-02 超大路由文件拆分

- **文件**：[ai/config.ts](file:///d:/KnowledgeMap/api/routes/ai/config.ts)（18091）、[autoGraph.ts](file:///d:/KnowledgeMap/api/routes/autoGraph.ts)（16811）、[knowledgePoints.ts](file:///d:/KnowledgeMap/api/routes/knowledgePoints.ts)（16460）、[learningPaths.ts](file:///d:/KnowledgeMap/api/routes/learningPaths.ts)（14660）、[graphs/expansion.ts](file:///d:/KnowledgeMap/api/routes/graphs/expansion.ts)（13662）、[literature.ts](file:///d:/KnowledgeMap/api/routes/literature.ts)（13403）、[agent.ts](file:///d:/KnowledgeMap/api/routes/agent.ts)（11291）、[ai/document.ts](file:///d:/KnowledgeMap/api/routes/ai/document.ts)（10778）、[ai/content.ts](file:///d:/KnowledgeMap/api/routes/ai/content.ts)（10074）
- **方向**：参照 `routes/graphs/` 已有的拆分模式（crud/analysis/expansion/versions），按子资源拆分。

#### P2-03 路由内联 zod schema 未集中

- **文件**：[knowledgePoints.ts](file:///d:/KnowledgeMap/api/routes/knowledgePoints.ts)（行 20-77 内联 5 个 schema）、[graphs/crud.ts](file:///d:/KnowledgeMap/api/routes/graphs/crud.ts)（行 27-34）
- **方向**：按资源域拆分到 `schemas/knowledgePoint.ts`、`schemas/graph.ts` 等，从 `schemas/index.ts` re-export。

#### P2-04 路由层错误处理三种风格混用

- **文件**：[auth.ts](file:///d:/KnowledgeMap/api/routes/auth.ts)（register 用 try/catch + throw AppError；login 用 try/catch + next(error)）、[graphs/crud.ts](file:///d:/KnowledgeMap/api/routes/graphs/crud.ts)（intelligent-suggestions）、[knowledgePoints.ts](file:///d:/KnowledgeMap/api/routes/knowledgePoints.ts)（list）
- **方向**：移除路由层 try/catch，直接 `throw new AppError(...)`；express-async-errors 已启用。

#### P2-05 `req.supabase!` 222 处非空断言

- **文件**：30 个路由文件，前 5：[graphs/crud.ts](file:///d:/KnowledgeMap/api/routes/graphs/crud.ts)（28 次）、[knowledgePoints.ts](file:///d:/KnowledgeMap/api/routes/knowledgePoints.ts)（21 次）、[learningPaths.ts](file:///d:/KnowledgeMap/api/routes/learningPaths.ts)（21 次）、[agent.ts](file:///d:/KnowledgeMap/api/routes/agent.ts)（13 次）、[study.ts](file:///d:/KnowledgeMap/api/routes/study.ts)（13 次）
- **方向**：把 `requireAuth` 改为 generic，使下游 handler 的 `req.supabase` 是 `SupabaseClient` 而非 `SupabaseClient | undefined`；或新增 `AuthenticatedRequest` 类型。

#### P2-06 `errorHandler` 使用 `any` 类型

- **文件**：[errorHandler.ts](file:///d:/KnowledgeMap/api/middleware/errorHandler.ts)（行 204 `err: any`）、[auth.ts](file:///d:/KnowledgeMap/api/middleware/auth.ts)（行 8 `user?: any`）
- **方向**：`err: unknown` + 类型守卫；`AuthRequest.user?: User`（用 Supabase `User` 类型）。

#### P2-07 28 个文件 150 处 `any` 类型

- **文件**：重灾区 [autoGraphService.test.ts](file:///d:/KnowledgeMap/api/__tests__/services/graph/autoGraphService.test.ts)（43 处）、[aiActionService.ts](file:///d:/KnowledgeMap/api/services/ai/aiActionService.ts)（13 处）、[searchService.ts](file:///d:/KnowledgeMap/api/services/ai/searchService.ts)（6 处）
- **方向**：用 `unknown` + 类型守卫替代；service 内部接口用 `Record<string, unknown>`。

#### P2-08 `requireAuth` 每请求调 Supabase Auth

- **文件**：[auth.ts](file:///d:/KnowledgeMap/api/middleware/auth.ts)（行 70）
- **现象**：每次 `getSupabaseAdmin().auth.getUser(token)` 是网络调用。已有 `jwtService` 可本地验证，但未使用。
- **方向**：本地 `jwt.verify(token, secret)` 验证签名与过期；仅在校验用户存在时（如每 5 分钟一次）回调 Supabase。

#### P2-09 `pricingService` 硬编码模型表

- **文件**：[pricingService.ts](file:///d:/KnowledgeMap/api/services/ai/pricingService.ts)（行 3-46）
- **现象**：`MODEL_PRICING` 常量数组，仅覆盖 deepseek/volcengine/aliyun 三家共 6 个模型；openai/zhipu/moonshot 完全缺失，命中 fallback 与真实价格不符。
- **方向**：把 pricing 表迁入数据库（`ai_model_pricing`），通过 cacheService 缓存（TTL 1h）。

#### P2-10 `performanceMonitor` 内存+DB 混合，单实例假设

- **文件**：[performanceMonitor.ts](file:///d:/KnowledgeMap/api/services/ai/performanceMonitor.ts)（行 34-54、116-120）
- **现象**：`private logs: AIPerformanceLog[]` 内存数组限 1000，启动时从 DB load 1000 条；多实例部署时各实例内存不一致，`getStats()` 返回的是本地 1000 条。
- **方向**：短期：`getStats`/`getLogs` 强制走 DB；长期：移除内存 buffer，全部走 DB + 索引优化。

#### P2-11 SSE/eventBus 完全单实例

- **文件**：[sseService.ts](file:///d:/KnowledgeMap/api/services/core/sseService.ts)（行 5）、[eventBus.ts](file:///d:/KnowledgeMap/api/services/core/eventBus.ts)（行 9）
- **现象**：进程内 Map，多实例部署时用户连接只在某台机器，事件无法跨实例广播。当前 Electron 单实例问题不暴露，但 Web 部署会坏。
- **方向**：引入 Redis Pub/Sub 作为 eventBus 后端。

#### P2-12 `eventBus` fire-and-forget 无重试与死信

- **文件**：[eventBus.ts](file:///d:/KnowledgeMap/api/services/core/eventBus.ts)（行 54-63）
- **方向**：失败 handler 入死信队列，定时重试 N 次。

#### P2-13 retry 配置无差异化

- **文件**：[retry.ts](file:///d:/KnowledgeMap/api/utils/retry.ts)、[chatService.ts](file:///d:/KnowledgeMap/api/services/ai/chatService.ts)（行 80-87、184-192）
- **现象**：所有 AI 调用都用相同 `maxRetries: 3`；`isRetryableError` 只判断 message 字符串，未看 HTTP status code。
- **方向**：区分 task 类型配置（embedding: 1 retry, chat: 2, reasoning: 0）；解析 OpenAI SDK error 的 `status`，仅 retry 5xx / 429。

#### P2-14 缺少 Supabase 自动生成类型

- **文件**：[shared/types/database.ts](file:///d:/KnowledgeMap/shared/types/database.ts)（手写）
- **现象**：所有 `*Row` 接口手写，schema 变更需手动同步。`toGraph` 静默丢弃 `template_type`、`parent_graph_id` 等字段。
- **方向**：运行 `supabase gen types typescript --local > shared/types/database.generated.ts`，将手写 Row 替换为生成类型。

#### P2-15 `User` 类型三处定义冲突

- **文件**：[api/models/user.ts](file:///d:/KnowledgeMap/api/models/user.ts)（行 1-13）、[shared/types/user.ts](file:///d:/KnowledgeMap/shared/types/user.ts)（行 13-43）、[shared/types/database.ts](file:///d:/KnowledgeMap/shared/types/database.ts)（行 191-203）
- **方向**：统一到 `shared/types/user.ts`，`api/models/user.ts` 改为 `UserWithCredentials extends User`。

#### P2-16 前端 26 个文件使用 `as any`，17 处非空断言

- **文件**：[createApiClient.ts](file:///d:/KnowledgeMap/src/services/api/createApiClient.ts)（行 73、221）、[Layout.tsx](file:///d:/KnowledgeMap/src/components/Layout/Layout.tsx)（行 431）、[PlanetView.tsx](file:///d:/KnowledgeMap/src/three/PlanetView.tsx)（行 26、247）、[mobileApiConfig.ts](file:///d:/KnowledgeMap/src/config/mobileApiConfig.ts)、[electronConfig.ts](file:///d:/KnowledgeMap/src/config/electronConfig.ts)
- **方向**：定义 `UserMetadata` 接口；`localFirstAdapter` 返回 `Promise<AxiosResponse>`；添加 ESLint `no-non-null-assertion` 规则强制。

#### P2-17 i18n：386 处硬编码中文

- **文件**：跨 100 个文件（grep `>[\u4e00-\u9fff]`）
- **方向**：分批迁移，优先处理高频组件（Layout、GraphEditor、Dashboard、Scheduler）；建立 ESLint 规则禁止 JSX 文本节点中出现中文字符。

#### P2-18 错误处理三套机制重叠

- **文件**：[errors.ts](file:///d:/KnowledgeMap/src/utils/errors.ts)、[asyncHandler.ts](file:///d:/KnowledgeMap/src/utils/asyncHandler.ts)、[useError.ts](file:///d:/KnowledgeMap/src/hooks/common/useError.ts)
- **方向**：统一入口，`errors.ts` 仅保留错误类与分类，`useError.ts` 作为唯一 hook 入口，`asyncHandler` 作为非 React 上下文工厂；删除重复的 `withErrorHandling`。

#### P2-19 `errorReporter` 全局 override `console.error`

- **文件**：[errorReporter.ts](file:///d:/KnowledgeMap/src/utils/errorReporter.ts)（行 109）
- **方向**：仅在 production 环境 override；或改用显式 `reportError(err)` API。

#### P2-20 HNSW 索引参数未调优

- **文件**：[12_indexes.sql](file:///d:/KnowledgeMap/supabase/migrations/12_indexes.sql)（行 21、28）、[14_functions.sql](file:///d:/KnowledgeMap/supabase/migrations/14_functions.sql)（行 106-167）
- **现象**：HNSW 使用默认 `m=16, ef_construction=64`，对 1024 维向量偏低；查询函数未 `SET LOCAL hnsw.ef_search`，使用默认 40，召回率不足。
- **方向**：重建索引为 `WITH (m=32, ef_construction=128)`；在 match 函数开头 `SET LOCAL hnsw.ef_search = 80`。

#### P2-21 分块策略无语言感知

- **文件**：[chunkingService.ts](file:///d:/KnowledgeMap/api/services/ai/chunkingService.ts)（行 1-2、81）
- **现象**：`CHUNK_SIZE = 400` 是字符数，中文 400 字 ≈ 600 token，英文 400 字 ≈ 80 token；句子分割正则遗漏 `；;` 和换行。
- **方向**：改用 `tiktoken` 按 token 计数（如 512 token）；按语言切换分块大小；增加 `；;` 到分隔符。

#### P2-22 混合搜索缺少真正的 BM25

- **文件**：[ragService.ts](file:///d:/KnowledgeMap/api/services/ai/ragService.ts)（行 253-371）
- **现象**：当前"关键词检索"是 `title.ilike.%query%` 模糊匹配，无 IDF 加权、无词频、无短语匹配。
- **方向**：在 `knowledge_points` 加 `tsvector` 列 + GIN 索引，使用 `websearch_to_tsquery` + `ts_rank_cd`。

#### P2-23 Reranking 调用无缓存与阈值

- **文件**：[ragService.ts](file:///d:/KnowledgeMap/api/services/ai/ragService.ts)（行 203-226）、[rerankingService.ts](file:///d:/KnowledgeMap/api/services/ai/rerankingService.ts)
- **方向**：加 `if (results.length < 5) return results;` 阈值；用 `computeTextHash(query) + candidateIds.join()` 作为 rerank 缓存键，TTL 300s。

#### P2-24 Cron 任务无分布式锁

- **文件**：[cronService.ts](file:///d:/KnowledgeMap/api/services/scheduler/core/cronService.ts)（行 98-137）
- **现象**：`executeDueSchedules` 查询 `task_schedules WHERE next_run_at <= now() AND is_active = true`，无 `SELECT FOR UPDATE` 或原子 claim。Electron + Web 双实例运行时同一 schedule 被两个实例拾取。
- **方向**：用 `UPDATE ... WHERE id = ? AND next_run_at = ? RETURNING *` 原子 claim；或加 Redis 锁。

#### P2-25 `asyncTaskService` 无启动恢复与并发控制

- **文件**：[asyncTaskService.ts](file:///d:/KnowledgeMap/api/services/asyncTaskService.ts)（行 94-97、228-238）
- **现象**：进程崩溃后 `pending` 状态任务永久滞留；`createTask` 立即 `processTaskAsync` 无并发限制。
- **方向**：启动时调用 `getPendingTasks` 恢复；引入 `p-limit` 或基于 `system_tasks` 表的乐观锁；加全局并发上限（如 3）。

#### P2-26 `tsconfig.electron.json` 关闭 strict

- **文件**：[tsconfig.electron.json](file:///d:/KnowledgeMap/tsconfig.electron.json)（行 12-13 `"strict": false, "noImplicitAny": false`）
- **方向**：改为 `"strict": true, "noImplicitAny": true`，逐步修复编译错误。

---

### 3.4 P3 详细清单（长周期 — 可扩展性/清理）

#### P3-01 Kernel 启动顺序耦合模块加载阶段

- **文件**：[app.ts](file:///d:/KnowledgeMap/api/app.ts)（行 32-41）、[Kernel.ts](file:///d:/KnowledgeMap/api/services/kernel/Kernel.ts)
- **方向**：把 Kernel 构造与插件注册移到 `bootstrap()` 函数内显式分阶段执行；`app.ts` 只导出 `createApp(kernel?)` 工厂。

#### P3-02 缺少 Repository 层

- **文件**：全 `services/graph/*` 与 `services/scheduler/*`
- **方向**：抽出薄 repository 层（按表/聚合根），暴露 `findById`、`listByOwner`、`softDelete` 等方法；服务只组合 repository 调用与业务规则。

#### P3-03 服务相互循环依赖

- **文件**：[chatService.ts](file:///d:/KnowledgeMap/api/services/ai/chatService.ts)、[promptService.ts](file:///d:/KnowledgeMap/api/services/ai/promptService.ts)、[aiService.ts](file:///d:/KnowledgeMap/api/services/ai/aiService.ts)
- **方向**：将 `buildGraphContext`、`buildTutorContext` 抽到 `services/ai/contextBuilder.ts`；`promptService.optimizeWithAI` 不应直接 import factory。

#### P3-04 统一 softDelete helper

- **文件**：多处 `.is('deleted_at', null)` 散落
- **方向**：repository 层统一封装 `notDeleted()` filter。

#### P3-05 `cacheService` 单进程

- **文件**：[cacheService.ts](file:///d:/KnowledgeMap/api/services/common/cacheService.ts)、[csrf.ts](file:///d:/KnowledgeMap/api/middleware/csrf.ts)（行 53 检测 VERCEL）
- **方向**：抽象 `CacheInterface`，开发环境用 NodeCache，生产环境用 Redis（Upstash）或 Supabase 表作为共享存储。

#### P3-06 Rate limiter 单实例内存

- **文件**：[rateLimiter.ts](file:///d:/KnowledgeMap/api/middleware/rateLimiter.ts)（行 16、105-140）
- **方向**：抽象 `RateLimitStore`，生产用 Redis。

#### P3-07 Refresh token 不轮换

- **文件**：[jwtService.ts](file:///d:/KnowledgeMap/api/services/auth/jwtService.ts)（行 112-127）
- **方向**：每次 refresh 签发新 refreshToken，旧 token 加入黑名单（Redis 或 DB 表 `revoked_tokens`）。

#### P3-08 Ownership 中间件覆盖不全

- **文件**：[ownership.ts](file:///d:/KnowledgeMap/api/middleware/ownership.ts)
- **现象**：仅 `requireKnowledgePointOwnership`、`requireAdmin`，缺 `requireGraphOwnership`、`requireTaskOwnership`、`requireQuizSetOwnership`、`requireTemplateOwnership`。
- **方向**：为每个资源类型实现 ownership 中间件。

#### P3-09 `main.ts` IPC 处理器未按域拆分

- **文件**：[main.ts](file:///d:/KnowledgeMap/electron/main.ts)（行 439-590 内联 app/window/shell/update/config 全部）、[dbHandlers.ts](file:///d:/KnowledgeMap/electron/ipc/dbHandlers.ts)、[syncEngine.ts](file:///d:/KnowledgeMap/electron/sync/syncEngine.ts)（行 356-393）
- **方向**：建立 `electron/ipc/{appHandlers,windowHandlers,updateHandlers,configHandlers,dbHandlers,syncHandlers}.ts`。

#### P3-10 `windowManager`/`trayManager` 为死代码

- **文件**：[windowManager.ts](file:///d:/KnowledgeMap/electron/utils/windowManager.ts)、[trayManager.ts](file:///d:/KnowledgeMap/electron/utils/trayManager.ts)
- **现象**：封装好的多窗口与托盘功能完全闲置，main.ts 用裸 `BrowserWindow` API 重复造轮子。
- **方向**：在 main.ts 改用 `windowManager.createWindow(...)`；在 `app.whenReady()` 后调用 `trayManager.initialize(mainWindow)`。

#### P3-11 `autoUpdater` UX 粗糙

- **文件**：[main.ts](file:///d:/KnowledgeMap/electron/main.ts)（行 502-542）
- **现象**：`autoDownload = true`（无用户同意即下载）；`setTimeout(() => autoUpdater.quitAndInstall(), 2000)`（下载完成 2 秒后强制重启）；`crashReporter.submitURL` 域名未注册。
- **方向**：改为 `autoDownload = false`，监听 `update-available` 时通过 IPC 通知渲染进程弹窗询问；下载完成后仅在用户主动点击时安装。

#### P3-12 SQLite 与 PostgreSQL 双 schema 定义无自动同步

- **文件**：[schema.ts](file:///d:/KnowledgeMap/electron/db/schema.ts)（1894 行 SQLite schema）、`supabase/migrations/*.sql`（PostgreSQL schema）
- **方向**：短期：建立 CI 检查，对比 schema.ts 的 TABLES 与 migrations 中的 CREATE TABLE；长期：考虑用单一 schema 定义源（如 drizzle/schema.ts）生成两种方言。

#### P3-13 测试覆盖率严重不足

- **文件**：[api/__tests__/](file:///d:/KnowledgeMap/api/__tests__/)、[src/__tests__/](file:///d:/KnowledgeMap/src/__tests__/)、[e2e/](file:///d:/KnowledgeMap/e2e/)
- **现状**：
  - 后端缺口：无 RAG/Embedding/流式测试、无 prompt service 测试、无 performanceMonitor 测试、无 kernel 插件生命周期测试、无 agent 系统测试、无 eventBus 订阅者测试、无路由集成测试、无 transactionExecutor 测试
  - 前端缺口：hooks 层（graphEditor 10 个子 hook、mutations 7 个文件、queries 10 个文件）、store 层、services/api 层均零测试
  - e2e：仅 1 个 Page Object（GraphPage），核心业务流程（登录/注册/CRUD/调度/学习/同步冲突）无覆盖
- **方向**：
  1. 优先补 RAG 流式 + 成本监控测试
  2. 补 cache 失效链测试
  3. 引入 supertest 做路由层冒烟测试
  4. 补 Page Object（LoginPage、DashboardPage、SchedulerPage 等）
  5. 补关键用户流程 E2E（auth、graph-crud、scheduler-task-lifecycle、sync-conflict）

#### P3-14 缺少 TypeScript Project References

- **文件**：[tsconfig.json](file:///d:/KnowledgeMap/tsconfig.json)（行 35 `include: ["src", "api", "shared"]`）
- **方向**：拆分为 `tsconfig.base.json` + `tsconfig.src.json` / `tsconfig.api.json` / `tsconfig.shared.json` / `tsconfig.electron.json`，用 `references` 关联。

---

## 四、补充发现（高价值但非优先级）

### 4.1 RAG analyzeKnowledgeGaps 一次性 load 全图

- **文件**：[ragService.ts](file:///d:/KnowledgeMap/api/services/ai/ragService.ts)（行 1191-1235）
- **现象**：`select graph_nodes + knowledge_points + edges` 全部加载到内存；没有 limit、没有分页。
- **方向**：加 limit（如 200），按 level 排序；超过阈值的部分用 sample 或按重要性截断。

### 4.2 RAG 流式与非流式代码大段重复

- **文件**：[ragService.ts](file:///d:/KnowledgeMap/api/services/ai/ragService.ts)（行 880-1003 chat、1071-1178 streamChat）
- **现象**：两方法几乎完全一致，约 130 行重复。
- **方向**：抽 `prepareRAGContext(message, userId, options)` 返回 `{ messages, aiProvider, sources }`，chat / streamChat 共用。

### 4.3 `find_missing_connections` 笛卡尔积性能问题

- **文件**：[14_functions.sql](file:///d:/KnowledgeMap/supabase/migrations/14_functions.sql)（行 1560-1617）
- **现象**：`graph_nodes n1 JOIN graph_nodes n2 ON n1.kp_id < n2.kp_id` 是 O(N²) 笛卡尔积。
- **方向**：改为 `LEFT JOIN edges e ON ... WHERE e.id IS NULL` 反连接模式，或限制为同 `level` 内比较。

### 4.4 `reorder_tasks` 使用 N+1 循环

- **文件**：[14_functions.sql](file:///d:/KnowledgeMap/supabase/migrations/14_functions.sql)（行 1285-1315）
- **方向**：改写为单条 `UPDATE FROM unnest(p_task_ids) WITH ORDINALITY AS t(id, pos)`。

### 4.5 SM2 与 FSRS 共存，文档与代码矛盾

- **文件**：[spacedRepetitionBridge.ts](file:///d:/KnowledgeMap/api/services/study/spacedRepetitionBridge.ts)（行 11-13 "SM2 deprecated"）、[03_knowledge_points.sql](file:///d:/KnowledgeMap/supabase/migrations/03_knowledge_points.sql)（行 27 "用于 SM-2 算法"）、[cronService.ts](file:///d:/KnowledgeMap/api/services/scheduler/core/cronService.ts)（行 268 仍查询 `knowledge_review_tasks`）、[project_rules.md](file:///d:/KnowledgeMap/.trae/rules/project_rules.md)（引用 `sm2Service.calculateNextReview`）
- **方向**：彻底删除 `knowledge_review_tasks` 表与索引，cron `checkReviewReminders` 改查 `study_cards.next_review`；更新 `project_rules.md`。

### 4.6 `useConsoleStore` 持久化范围、store middleware 不一致

- **文件**：[useStore.ts](file:///d:/KnowledgeMap/src/store/useStore.ts)、[useConsoleStore.ts](file:///d:/KnowledgeMap/src/store/useConsoleStore.ts)、[useFocusStore.ts](file:///d:/KnowledgeMap/src/store/useFocusStore.ts)、[usePerformanceStore.ts](file:///d:/KnowledgeMap/src/store/usePerformanceStore.ts)、[useAIPerformanceStore.ts](file:///d:/KnowledgeMap/src/store/useAIPerformanceStore.ts)
- **方向**：抽取 `createPersistedStore` 工厂统一 persist + devtools 配置；统一 key 前缀 `km-`。

### 4.7 `errorReporter.userId` 存 localStorage

- **文件**：[errorReporter.ts](file:///d:/KnowledgeMap/src/utils/errorReporter.ts)
- **方向**：userId 改由 useStore 订阅注入；登出时调用 `errorReporter.clearContext()`。

### 4.8 `forceLayout3D.test.ts` 已过时

- **文件**：[forceLayout3D.test.ts](file:///d:/KnowledgeMap/src/three/forceLayout3D.test.ts)
- **现象**：该实现为 O(n²) 碰撞检测，已被 `graphCalculator.worker.ts` 中的 uniform-grid O(n) 版本取代，测试通过但不反映生产路径。
- **方向**：删除旧测试或将测试迁移到 worker 实现。

### 4.9 `mobileSyncService` 与 `useMobileInit` 未联动

- **文件**：[useMobileInit.ts](file:///d:/KnowledgeMap/src/hooks/useMobileInit.ts)、[mobileSyncService.ts](file:///d:/KnowledgeMap/src/services/sync/mobileSyncService.ts)（行 97-104 固定 15 分钟定时器）
- **方向**：在 useMobileInit 中拿到 isOnline 后调用 `mobileSyncService.setOnlineStatus(isOnline)`；网络恢复时立即 sync。

### 4.10 Android release 未开启 minify

- **文件**：[android/app/build.gradle](file:///d:/KnowledgeMap/android/app/build.gradle)（行 19-23 `minifyEnabled false`）
- **方向**：`minifyEnabled true` + 配置 `proguard-rules.pro`；`shrinkResources true`。

### 4.11 `main.tsx` 使用 `confirm()` 阻塞 UI

- **文件**：[main.tsx](file:///d:/KnowledgeMap/src/main.tsx)（行 47）
- **方向**：替换为项目内 `ConfirmationModal`，异步等待用户选择。

### 4.12 项目规则文档与迁移结构脱节

- **文件**：[project_rules.md](file:///d:/KnowledgeMap/.trae/rules/project_rules.md) 声明 "00-16 Schema, 17-25 Seed"，但实际 `supabase/migrations/` 有 00-28 Schema + 50-99 Seed。
- **方向**：更新规则文档为 "00-28 Schema, 50-99 Seed"。

---

## 五、建议实施路线图

按"风险等级 × 投入产出比"分批推进。每轮完成后运行 `npm run check` + `npm run lint` 验证，关键修改需补充测试。

### 第 1 轮：紧急正确性与安全修复（P0）

**目标**：消除会导致数据错误或安全漏洞的问题，每个都是独立 PR。

| 顺序 | 优化点 | 估计工作量 |
|------|--------|----------|
| 1 | P0-05 `update_user_focus_stats` 触发器 bug | 小（SQL 修复 + 验证） |
| 2 | P0-12 `operationMerger` 补 delete+update 分支 + 单测 | 小 |
| 3 | P0-09 Embedding 缓存键改 SHA-256 | 小 |
| 4 | P0-10 `backfill_embeddings.ts` 表名修正 | 小 |
| 5 | P0-11 `enrichMetadata` 表名 `profiles` → `users` | 小 |
| 6 | P0-06 JWT 密钥生产硬失败 | 小 |
| 7 | P0-07 `ai_performance_logs` RLS 收紧 | 小 |
| 8 | P0-08 `document_chunks` 启用 RLS | 中 |
| 9 | P0-13 Electron sandbox + Capacitor 安全配置 | 小 |
| 10 | P0-14 `authConfig.ts` 移除硬编码 key | 小 |
| 11 | P0-03 `validate.ts` 响应格式统一 | 小 |
| 12 | P0-04 `aiActions.ts` 加 zod 校验 + 类型修复 | 中 |
| 13 | P0-01 流式 retry 修正 | 中 |
| 14 | P0-02 路由层 admin client 审计与替换 | 大（涉及 11 个文件） |

**验证**：`npm run check && npm run lint`；新增对应单测；P0-12 必须有 operationMerger 完整覆盖测试。

### 第 2 轮：AI 与性能热点（P1 子集）

**目标**：消除 AI 子系统的性能瓶颈与监控缺口。

| 顺序 | 优化点 | 估计工作量 |
|------|--------|----------|
| 1 | P1-01 AI Provider 实例缓存 | 中 |
| 2 | P1-02 RAG chat/streamChat 加监控 | 中 |
| 3 | P1-03 EmbeddingService 加监控 | 中 |
| 4 | P1-04 Embedding 批量 upsert | 小 |
| 5 | P1-12 `enrichMetadata` 缓存 | 小 |
| 6 | P1-11 `promptService.getTemplate` 服务端过滤 | 小 |
| 7 | P1-10 `keywordSearch` 改用 trgm 索引 | 小 |
| 8 | P1-05 添加复合索引 | 小 |
| 9 | P1-06 `requireAdmin` 去重 | 小 |
| 10 | P1-07 推广 `getOrSet` | 中 |
| 11 | P1-08 LRU O(1) 优化 | 中 |
| 12 | P1-09 `transactionExecutor` 推广 | 中 |

**验证**：AI 性能监控数据完整；RAG 调用前后性能对比报告。

### 第 3 轮：前端架构与渲染性能（P1 子集）

**目标**：拆解巨型组件，提升渲染性能。

| 顺序 | 优化点 | 估计工作量 |
|------|--------|----------|
| 1 | P1-13 GraphEditor.tsx 拆分 | 大 |
| 2 | P1-14 `useGraphEditorState` 重渲染优化 | 中 |
| 3 | P1-15 `useAIPerformanceStore` 迁移到 TanStack Query | 中 |
| 4 | P1-16 `useConsoleStore` 持久化收窄 | 小 |
| 5 | P1-17 `useTaskMutations` 失效范围收窄 | 小 |
| 6 | P1-18 React.memo 批量补齐 | 中 |
| 7 | P1-19 移动端服务动态 import | 中 |
| 8 | 4.11 `main.tsx` `confirm()` 替换 | 小 |

**验证**：Chrome DevTools Performance 录制对比；bundle size 报告。

### 第 4 轮：跨平台与同步架构（P1 子集）

**目标**：统一同步逻辑，消除重复实现。

| 顺序 | 优化点 | 估计工作量 |
|------|--------|----------|
| 1 | P1-20 删除 `src/services/sync/syncTypes.ts` + `conflictService.ts` | 中 |
| 2 | P1-21 Kernel 抽取 `PluginLifecycleBase` | 大 |
| 3 | P1-22 Electron 主进程接入 logger | 中 |
| 4 | P1-23 `mobileSyncService` 加重试 | 小 |
| 5 | P1-24 `mobileSyncService` 加幂等性 | 中 |
| 6 | 4.9 `useMobileInit` 与 sync 联动 | 小 |
| 7 | 4.5 SM2 残留清理 | 中 |

**验证**：sync 操作单测；Electron 主进程日志结构化。

### 第 5 轮：类型安全与代码规范（P2 子集）

**目标**：消除 `any` 与非空断言，统一错误处理。

| 顺序 | 优化点 | 估计工作量 |
|------|--------|----------|
| 1 | P2-05 `req.supabase!` 222 处清理（先改 `requireAuth` 泛型） | 大 |
| 2 | P2-06 `errorHandler` + `AuthRequest` 类型修复 | 中 |
| 3 | P2-07 后端 150 处 `any` 清理 | 大 |
| 4 | P2-16 前端 `as any` 与 `!` 清理 | 中 |
| 5 | P2-04 路由层错误处理风格统一 | 中 |
| 6 | P2-03 zod schema 集中 | 中 |
| 7 | P2-18 前端错误处理三套机制合并 | 中 |
| 8 | P2-19 `errorReporter` 全局 override 收窄 | 小 |
| 9 | P2-26 `tsconfig.electron` 开 strict | 中 |
| 10 | P2-08 `requireAuth` 改本地 jwt 验证 | 中 |

**验证**：`npm run check:full && npm run lint:full` 通过。

### 第 6 轮：AI 质量与 RAG 召回（P2 子集）

**目标**：提升 RAG 检索质量与成本控制。

| 顺序 | 优化点 | 估计工作量 |
|------|--------|----------|
| 1 | P2-21 分块策略改 token 计数 + 语言感知 | 中 |
| 2 | P2-22 BM25 真正的稀疏检索 | 大 |
| 3 | P2-23 Reranking 加阈值与缓存 | 小 |
| 4 | P2-20 HNSW 索引调优 | 中 |
| 5 | P2-09 `pricingService` 迁入数据库 | 中 |
| 6 | P2-13 retry 配置差异化 | 小 |
| 7 | 4.1 RAG `analyzeKnowledgeGaps` 加 limit | 小 |
| 8 | 4.2 RAG chat/streamChat 代码去重 | 中 |

**验证**：RAG 召回率 A/B 对比；成本报表对照。

### 第 7 轮：调度可靠性与可观测性（P2 子集）

**目标**：消除调度竞态，补全性能监控。

| 顺序 | 优化点 | 估计工作量 |
|------|--------|----------|
| 1 | P2-24 Cron 任务加原子 claim | 中 |
| 2 | P2-25 `asyncTaskService` 启动恢复 + 并发控制 | 中 |
| 3 | P2-10 `performanceMonitor` 多实例化 | 中 |
| 4 | P2-12 `eventBus` 死信队列 | 中 |
| 5 | P2-14 引入 Supabase 自动生成类型 | 中 |
| 6 | P2-15 `User` 类型三处统一 | 小 |
| 7 | 4.6 store middleware 工厂化 | 小 |
| 8 | 4.7 `errorReporter.userId` 改注入 | 小 |

**验证**：并发场景下 cron 不重复执行；多实例部署模拟测试。

### 第 8 轮：可扩展性与长周期（P3）

**目标**：为多实例 Web 部署、长尾可维护性做准备。

| 顺序 | 优化点 | 估计工作量 |
|------|--------|----------|
| 1 | P3-05 `cacheService` 抽象 + Redis 后端 | 大 |
| 2 | P3-06 Rate limiter Redis 后端 | 中 |
| 3 | P2-11 SSE/eventBus Redis Pub/Sub | 大 |
| 4 | P3-07 Refresh token 轮换 + 黑名单 | 中 |
| 5 | P3-08 Ownership 中间件补全 | 中 |
| 6 | P3-01 Kernel 启动顺序解耦 | 中 |
| 7 | P3-02 Repository 层抽取 | 大 |
| 8 | P3-03 服务循环依赖解耦 | 中 |
| 9 | P3-09 Electron IPC 按域拆分 | 中 |
| 10 | P3-10 接入 `windowManager`/`trayManager` | 中 |
| 11 | P3-11 `autoUpdater` UX 优化 | 中 |
| 12 | P3-12 SQLite/PostgreSQL schema 同步 CI | 中 |
| 13 | P3-14 TypeScript Project References | 中 |

**验证**：多实例本地模拟部署；Redis 接入后端到端测试。

### 第 9 轮：i18n 与超大文件清理（P2 + P3）

**目标**：消除硬编码中文，拆分超大文件。

| 顺序 | 优化点 | 估计工作量 |
|------|--------|----------|
| 1 | P2-17 i18n 386 处硬编码迁移（按高频组件分批） | 大 |
| 2 | P2-01 超大 service 文件拆分（AgentService 等） | 大 |
| 3 | P2-02 超大路由文件拆分（9 个） | 大 |
| 4 | P2-02 mobile/graphs.ts 与 web/graphs.ts 去重 | 中 |

### 第 10 轮：测试体系补齐（P3-13）

**目标**：建立分层测试体系。

| 顺序 | 优化点 | 估计工作量 |
|------|--------|----------|
| 1 | 后端 RAG/Embedding/流式测试 | 大 |
| 2 | 后端 cache 失效链测试 | 中 |
| 3 | 后端路由层 supertest 冒烟测试 | 中 |
| 4 | shared/sync 完整单测（所有 action 组合） | 中 |
| 5 | Electron syncEngine 单测 | 中 |
| 6 | 前端 hooks 层单测（graphEditor/mutations/queries） | 大 |
| 7 | 前端 store 层单测 | 中 |
| 8 | e2e Page Object 补齐 | 中 |
| 9 | e2e 核心业务流程覆盖（auth/graph-crud/scheduler/study/sync-conflict） | 大 |
| 10 | 4.8 `forceLayout3D.test.ts` 迁移或删除 | 小 |

---

## 六、附录

### 6.1 关键依赖关系提示

- P1-13（拆 GraphEditor）应先于 P1-14（重渲染优化）和 P1-18（memo 补齐），否则拆分后的子组件仍可能继承重渲染问题。
- P1-20（删 sync 重复）应先于 P1-21（Kernel 抽取），因为 sync 重复更易识别为模板，可作为抽取范本。
- P0-02（路由层 admin client 审计）应配合 P3-08（Ownership 中间件补全）一起做，否则替换后缺少所有权校验仍不安全。
- P2-14（Supabase 生成类型）应作为 P2-15、P2-16 的前置，避免反复手工对齐类型。

### 6.2 验证命令速查

```bash
# 开发过程中快速检查（增量）
npm run check

# 提交前完整检查
npm run check && npm run lint

# 全量检查（CI/疑难）
npm run check:full && npm run lint:full

# 单元测试
npm run test

# E2E 测试
npx playwright test
npx playwright test --grep="功能名称"
```

### 6.3 不在本次路线图范围内的项

以下项已知存在但暂未列入（可后续追加）：

- AI Agent 工具集的进一步抽象（`agent/tools/*` 当前 4 个工具文件，未来可能需要 plugin 化）
- Console 命令系统的扩展性（`services/console/commands/*`）
- Story 创作模块（`api/routes/story/*` 与 `api/services/story/*`）的边界审视
- 备份系统的增量优化（`backupService.ts` 当前每 30 分钟全量备份所有用户）
- 移动端原生插件补充（`@capacitor/haptics`、`@capacitor/keyboard`、`@capacitor/local-notifications`、`@capacitor/share`）

### 6.4 推进原则

1. **每轮独立可验证**：每轮完成后必须通过 `check` + `lint`，关键修改需补单测。
2. **小步快跑**：单次 PR 控制在可 review 范围（建议 < 500 行变更）。
3. **优先级可调**：如业务需求变化，可重新评估优先级矩阵。
4. **保留回归点**：每轮完成后在本文档对应条目标注 ✅ 完成日期与 PR 链接，便于追溯。
