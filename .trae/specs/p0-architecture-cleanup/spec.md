# P0 架构清理与数据一致性修复 Spec

## Why

系统性架构优化分析识别出 6 个 P0 级别问题，均属于数据一致性风险、运行时崩溃风险或重复实现导致的行为漂移。其中 2 个 P0（同步类型分裂、errorReporter userId）已由 `unify-sync-framework` 和 `p0-critical-fixes` spec 完成，本 spec 处理剩余 6 个 P0 项：

1. **db:batch 未使用事务**：`electron/ipc/dbHandlers.ts` 注释写"transaction"但实际是 for 循环逐条执行，批量操作中途失败导致数据部分写入，违反 `local-first-sqlite` spec 第 91 行"使用 SQLite 事务保证原子性"要求。
2. **study_cards 同步冲突检测失效**：`api/services/sync/syncService.ts` 配置 `updatedAtColumn: "created_at"`（永不变），但 study_cards 复习时更新 `last_reviewed/next_review/fsrs_*` 字段。Pull 拉不到复习更新，Push 跳过冲突检测直接覆盖云端，跨端复习数据静默丢失。
3. **PG 函数引用未定义列**：`14_functions.sql` 中 4 个删除函数使用 `is_branch` 列，但该列直到 `27_graph_version_control.sql:44` 才 ALTER 添加。PostgreSQL 函数创建不校验列存在，**调用时崩溃**；只跑核心迁移集时删图功能失败。
4. **backupService 恢复 N+1 串行查询**：`backupService.ts:675-723` 对每个节点执行 2 次 Supabase 请求（insert knowledge_point + insert graph_node），N 节点 = 2N 次往返。edges/cards 已批量化，唯独节点遗漏。
5. **AI 监控代码四处重复**：`aiMonitor.ts` 注释明确警告"避免两套逻辑漂移"，但实际存在四套：`withAIMonitoring`、`withAIPerformanceTracking`、`withAutoGraphTracking`（adapter）、`chat.ts` 路由层手动 `recordLog`。维护成本翻倍，路由层版本缺少重试和请求去重。
6. **chat.ts 路由层混入业务逻辑**：`routes/ai/chat.ts`（398 行）直接构建上下文、渲染 prompt、流式迭代、手动监控，完全绕过已封装的 `chatService.chat()`。同一业务两套实现，路由版本缺少重试和请求去重。

## What Changes

### 修复 1：db:batch 事务包裹（P0-2）
- `electron/ipc/dbHandlers.ts` 的 `db:batch` handler 用 `dbManager.transaction(() => { ... })` 包裹 for 循环
- 循环内任一操作失败时整个批量回滚，返回失败错误
- 验证 `dbManager.transaction` 方法签名是否支持同步回调（参考 `electron/db/database.ts`）

### 修复 2：study_cards 同步字段修正（P0-3）
- 为 `study_cards` 表新增 `updated_at` 列（`supabase/migrations/04_study_cards.sql` 或对应模块化文件）
- 更新 `study_cards` 的 INSERT/UPDATE 触发器自动维护 `updated_at`（若已有 `15_triggers.sql` 通用触发器则复用）
- 更新 `api/services/sync/syncService.ts` 第 38 行 `updatedAtColumn: "created_at"` → `"updated_at"`
- 同步更新 `electron/db/schema.ts` 中 `study_cards` 表定义，新增 `updated_at` 列
- 同步更新 `shared/types/database.ts` 中 `StudyCardRow` 类型，新增 `updated_at` 字段

### 修复 3：PG 函数 is_branch 列依赖修正（P0-4）
- 将 `supabase/migrations/27_graph_version_control.sql` 第 44 行的 `ALTER TABLE knowledge_graphs ADD COLUMN is_branch` 移到 `supabase/migrations/02_knowledge_graph.sql`（与表定义同文件）
- 保留 `27_graph_version_control.sql` 中其他版本控制相关字段（如 `parent_graph_id` 若已存在则不动）
- 验证 `14_functions.sql` 第 842/897/932/969 行的 4 个删除函数能正常调用

### 修复 4：backupService 恢复批量化（P0-6）
- 重构 `api/services/common/backupService.ts:675-723` 的节点恢复逻辑
- 改为先批量 `insert(knowledgePointsArray).select('id')` 一次性插入所有 knowledge_points，建立 `oldId → newId` 映射
- 再批量 `insert(graphNodesArray)` 一次性插入所有 graph_nodes
- 错误处理：批量插入失败的记录跳过，记录 warn 日志，不影响其他节点
- 参考：同文件 `edges` 恢复（第 726+ 行）和 `study_cards` 恢复已使用批量模式

### 修复 5：AI 监控入口统一（P0-7）
- 删除 `api/services/ai/utils/performanceTracker.ts`（87 行重复实现）
- 全局搜索 `withAIPerformanceTracking` 调用方，迁移到 `aiMonitor.ts` 的 `withAIMonitoring`
- 删除 `performanceMonitor.withAutoGraphTracking`（已是 `withAIMonitoring` 的 adapter，无独立价值）
- 全局搜索 `withAutoGraphTracking` 调用方，迁移到 `withAIMonitoring`
- 在 `aiMonitor.ts` 顶部注释明确"路由层禁止直接调用 performanceMonitor.recordLog，必须通过 withAIMonitoring 包装"

### 修复 6：chat.ts 路由层下沉（P0-8）
- 在 `api/services/ai/chatService.ts` 新增 `chatStream` 方法，封装：
  - 上下文构建（getGraphNodes + buildGraphContext）
  - Prompt 渲染（promptService.getRenderedPrompt）
  - 元数据enrichment（enrichMetadata）
  - 流式迭代 + token 累加
  - 监控记录（通过 `withAIMonitoring` 包装，不再手动 recordLog）
  - 错误处理
- `routes/ai/chat.ts` 流式分支改为只做 SSE header 设置 + 调用 `chatService.chatStream(req, res, options)`
- 保留 `chatService.chat()` 非流式方法不变
- 路由层变薄至约 50-80 行

## Impact

- **Affected specs**:
  - `local-first-sqlite` — db:batch 事务修复落实其第 91 行要求
  - `unify-sync-framework` — study_cards 同步修复补全同步框架的最后一处失效
  - `p0-critical-fixes` — 本 spec 是其后续 P0 修复
  - `optimize-db-query-n1` — backupService 批量化与其 N+1 消除目标一致
- **Affected code**:
  - `electron/ipc/dbHandlers.ts` — db:batch handler 事务包裹
  - `electron/db/database.ts` — 确认 transaction 方法可用
  - `supabase/migrations/02_knowledge_graph.sql` — 新增 is_branch 列定义
  - `supabase/migrations/04_study_cards.sql`（或对应文件）— 新增 updated_at 列
  - `supabase/migrations/15_triggers.sql` — study_cards updated_at 自动维护触发器（若需）
  - `supabase/migrations/27_graph_version_control.sql` — 移除 is_branch ALTER（已移到 02）
  - `supabase/migrations/14_functions.sql` — 无需改动（is_branch 列已存在）
  - `api/services/sync/syncService.ts` — study_cards updatedAtColumn 修正
  - `api/services/common/backupService.ts` — restoreBackupData 批量化
  - `api/services/ai/utils/performanceTracker.ts` — **删除**
  - `api/services/ai/performanceMonitor.ts` — 删除 withAutoGraphTracking
  - `api/services/ai/aiMonitor.ts` — 强化注释（路由层禁用 recordLog）
  - `api/services/ai/chatService.ts` — 新增 chatStream 方法
  - `api/routes/ai/chat.ts` — 流式分支下沉到 chatService
  - `electron/db/schema.ts` — study_cards 新增 updated_at 列定义
  - `shared/types/database.ts` — StudyCardRow 新增 updated_at 字段
  - 全局 `withAIPerformanceTracking` / `withAutoGraphTracking` 调用方 — 迁移到 withAIMonitoring

## ADDED Requirements

### Requirement: db:batch 事务原子性

系统 SHALL 在 `db:batch` IPC handler 中使用事务包裹所有批量操作，确保原子性。

#### Scenario: 批量操作全部成功
- **WHEN** 调用 `db:batch` 传入 N 个操作且全部成功
- **THEN** 所有操作在同一事务中提交，返回所有结果

#### Scenario: 批量操作中途失败
- **WHEN** 调用 `db:batch` 传入 N 个操作，第 K 个失败
- **THEN** 前 K-1 个已执行操作回滚，返回失败错误，不产生部分写入

#### Scenario: 事务不可用降级
- **WHEN** `dbManager.transaction` 方法不可用或抛错
- **THEN** 回退到原有逐条执行模式，并记录 warn 日志

### Requirement: study_cards 跨端同步一致性

系统 SHALL 确保 `study_cards` 表的复习更新能被同步引擎正确检测和推送。

#### Scenario: 复习后 updated_at 更新
- **WHEN** 用户复习一张 study_card 并提交 quality
- **THEN** `study_cards.updated_at` 字段自动更新为当前时间戳（由触发器或应用层维护）

#### Scenario: Pull 同步拉取复习更新
- **WHEN** 同步引擎执行 Pull，云端 study_cards 有复习更新
- **THEN** 基于 `updated_at > last_sync_time` 条件拉取到复习后的卡片数据

#### Scenario: Push 同步冲突检测
- **WHEN** 同步引擎执行 Push，本地 study_cards 复习更新与云端存在冲突
- **THEN** 基于 `updated_at` 字段执行冲突检测，而非直接覆盖

### Requirement: PG 函数列依赖顺序正确

系统 SHALL 确保 `14_functions.sql` 中所有函数引用的列在函数创建前已存在。

#### Scenario: 仅运行核心迁移集后调用删图功能
- **WHEN** 用户只运行迁移 1-16（核心集）后调用 `permanent_delete_graph` 函数
- **THEN** 函数正常执行，不抛出 "column is_branch does not exist" 错误

#### Scenario: 完整迁移后调用删图功能
- **WHEN** 用户运行所有迁移后调用 4 个删除函数
- **THEN** 函数正常执行，行为与原有完整迁移集场景一致

### Requirement: backupService 恢复批量化

系统 SHALL 在 `restoreBackupData` 中批量插入节点数据，消除 N+1 查询。

#### Scenario: 批量恢复节点成功
- **WHEN** 调用 `restoreBackupData` 恢复包含 N 个节点的备份
- **THEN** knowledge_points 批量插入（1 次请求），graph_nodes 批量插入（1 次请求），总 HTTP 往返从 2N 降为 2

#### Scenario: 部分节点恢复失败
- **WHEN** 批量插入中部分节点失败
- **THEN** 失败节点跳过，记录 warn 日志，成功节点仍建立 oldId→newId 映射

#### Scenario: 边和卡片恢复不受影响
- **WHEN** 调用 `restoreBackupData`
- **THEN** edges 和 study_cards 恢复逻辑保持原有批量模式不变

### Requirement: AI 监控单一入口

系统 SHALL 仅通过 `aiMonitor.withAIMonitoring` 提供 AI 调用监控，删除所有重复实现。

#### Scenario: AI 服务调用监控
- **WHEN** 任何 AI 服务（chat/embedding/reranking/autograph）调用 provider
- **THEN** 通过 `withAIMonitoring` 包装，统一记录 token/成本/时长

#### Scenario: 路由层禁止直接监控
- **WHEN** 路由层（如 `routes/ai/chat.ts`）需要监控 AI 调用
- **THEN** 必须通过调用 `chatService` 等服务层方法间接获得监控，禁止直接调用 `performanceMonitor.recordLog`

#### Scenario: 旧 API 调用方迁移
- **WHEN** 代码中存在 `withAIPerformanceTracking` 或 `withAutoGraphTracking` 调用
- **THEN** 迁移到 `withAIMonitoring`，签名对齐（operation/provider/model/metadata/sessionId）

### Requirement: chat.ts 路由层薄化

系统 SHALL 将 `routes/ai/chat.ts` 的业务逻辑下沉到 `chatService`，路由层只做 HTTP 编解码。

#### Scenario: 流式聊天请求
- **WHEN** 客户端调用 `POST /api/ai/chat` 且 `stream: true`
- **THEN** 路由层设置 SSE header 后委托给 `chatService.chatStream()`，由 chatService 完成上下文构建、流式迭代、监控记录

#### Scenario: 非流式聊天请求
- **WHEN** 客户端调用 `POST /api/ai/chat` 且 `stream: false`
- **THEN** 路由层委托给 `chatService.chat()`，行为与原有非流式分支一致

#### Scenario: 流式聊天错误处理
- **WHEN** 流式聊天过程中发生错误
- **THEN** chatService.chatStream 捕获错误，通过 SSE 发送错误事件，并通过 withAIMonitoring 记录失败监控

## MODIFIED Requirements

### Requirement: db:batch IPC handler
**原**：for 循环逐条执行，无事务包裹，中途失败产生部分写入。
**新**：使用 `dbManager.transaction` 包裹整个循环，原子提交或回滚。

### Requirement: study_cards 同步配置
**原**：`updatedAtColumn: "created_at"`，复习更新无法被检测。
**新**：`updatedAtColumn: "updated_at"`，复习更新自动维护 updated_at，同步引擎正确检测。

### Requirement: knowledge_graphs 表结构
**原**：`is_branch` 列在 `27_graph_version_control.sql` 通过 ALTER 添加，核心迁移集不含此列。
**新**：`is_branch` 列在 `02_knowledge_graph.sql` 表定义中直接声明，核心迁移集即包含此列。

### Requirement: restoreBackupData 节点恢复
**原**：for 循环逐条 insert knowledge_point + insert graph_node，N 节点 2N 次往返。
**新**：批量 insert 所有 knowledge_points，建立映射后批量 insert 所有 graph_nodes，2 次往返完成。

### Requirement: AI 调用监控实现
**原**：四套监控实现并存（withAIMonitoring / withAIPerformanceTracking / withAutoGraphTracking / 路由层手动 recordLog），行为漂移风险。
**新**：单一入口 withAIMonitoring，删除 performanceTracker.ts 和 withAutoGraphTracking，路由层禁用直接 recordLog。

### Requirement: chat.ts 路由处理
**原**：路由层 398 行，混入上下文构建、prompt 渲染、流式迭代、手动监控等业务逻辑。
**新**：路由层约 50-80 行，只做 HTTP 编解码 + 委托 chatService.chatStream/chat。

## REMOVED Requirements

### Requirement: withAIPerformanceTracking 函数
**Reason**：与 withAIMonitoring 完全重复，行为漂移风险，违反 aiMonitor.ts 注释明确的"单一规范入口"原则。
**Migration**：所有调用方迁移到 withAIMonitoring，签名兼容（operation/provider/model/metadata/sessionId），token 提取逻辑由 withAIMonitoring 内部完成。

### Requirement: performanceMonitor.withAutoGraphTracking 函数
**Reason**：仅是 withAIMonitoring 的 thin adapter，无独立价值，增加调用层级和心智负担。
**Migration**：所有调用方（autoGraphService 等）直接调用 withAIMonitoring。
