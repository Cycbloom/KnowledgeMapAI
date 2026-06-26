# Tasks

> 6 个 P0 修复相互独立，可并行执行。Task 1/2/3 是小修复（数据库 schema/IPC handler），Task 4 是性能批量化，Task 5/6 涉及 AI 监控统一和路由层下沉（建议合并执行，因 chat.ts 同时涉及这两项）。

- [x] Task 1: db:batch IPC handler 事务包裹（P0-2）
  - [x] SubTask 1.1: 确认 `electron/db/database.ts` 中 `dbManager.transaction(fn)` 方法签名（同步回调 vs 异步回调、返回值、错误传播）— 新增 `transaction<T>(fn: () => T): T` 方法，基于 better-sqlite3 API
  - [x] SubTask 1.2: 修改 [electron/ipc/dbHandlers.ts](file:///d:/KnowledgeMap/electron/ipc/dbHandlers.ts) 第 67-103 行 `db:batch` handler，用 `dbManager.transaction(() => { ... })` 包裹 for 循环
  - [x] SubTask 1.3: 循环内任一操作抛错时，事务自动回滚，handler 返回 `{ success: false, error: message }`
  - [x] SubTask 1.4: 若 `dbManager.transaction` 不可用（typeof 检查），回退到原逐条执行模式并 `console.warn` 提示
  - [x] SubTask 1.5: 运行 `npm run check:electron` 确保类型检查通过（修改文件无类型错误，预存在 4 个错误位于 api/services/ 与本次无关）

- [x] Task 2: study_cards 同步字段修正（P0-3）
  - [x] SubTask 2.1: 在 `supabase/migrations/06_study_and_cards.sql` 中为 `study_cards` 表新增 `updated_at TIMESTAMPTZ DEFAULT NOW()` 列定义
  - [x] SubTask 2.2: `15_triggers.sql` 已有通用 `update_updated_at_column()` 函数，新增 `DROP TRIGGER IF EXISTS study_cards_updated_at` + `CREATE TRIGGER study_cards_updated_at BEFORE UPDATE` 幂等触发器
  - [x] SubTask 2.3: 修改 [api/services/sync/syncService.ts](file:///d:/KnowledgeMap/api/services/sync/syncService.ts) 第 38 行 `updatedAtColumn: "created_at"` → `updatedAtColumn: "updated_at"`
  - [x] SubTask 2.4: 修改 [electron/db/schema.ts](file:///d:/KnowledgeMap/electron/db/schema.ts) 中 studyCardsTable 定义，新增 `timestampColumn('updated_at', false)`，并将 `hasUpdatedAt: false` 改为 `true`
  - [x] SubTask 2.5: `shared/types/database.ts` 中 `StudyCardRow` 已包含 `updated_at: string` 字段（第 65 行），无需改动
  - [x] SubTask 2.6: 全局搜索确认应用层 INSERT/UPDATE 不手动维护 updated_at（由触发器处理）
  - [x] SubTask 2.7: 运行 `npm run check` 与 `npm run lint` 通过（exit 0）

- [x] Task 3: PG 函数 is_branch 列依赖修正（P0-4）
  - [x] SubTask 3.1: 定位 `27_graph_version_control.sql` 中 `ALTER TABLE knowledge_graphs ADD COLUMN IF NOT EXISTS is_branch BOOLEAN DEFAULT false` + COMMENT
  - [x] SubTask 3.2: `02_knowledge_graph.sql` 第 16 行 CREATE TABLE 中新增 `is_branch BOOLEAN DEFAULT false,`（紧随 parent_graph_id），第 38 行新增 COMMENT
  - [x] SubTask 3.3: 从 `27_graph_version_control.sql` 移除 is_branch 的 ALTER 和 COMMENT（保留 branch_name/branch_source_snapshot_id 的 ALTER，因未被 14_functions.sql 引用且有 FK 依赖）
  - [x] SubTask 3.4: 检查 `14_functions.sql` 仅引用 is_branch 和 parent_graph_id（后者已存在于 02 号文件）
  - [x] SubTask 3.5: 验证 4 个删除函数引用的列在 `02_knowledge_graph.sql` 后全部存在
  - [x] SubTask 3.6: `npx supabase db reset` 未能执行（CLI 二进制缺失 ENOENT），静态分析确认迁移依赖链已修复

- [x] Task 4: backupService 恢复批量化（P0-6）
  - [x] SubTask 4.1: 读取节点恢复逻辑（第 675-723 行）和 edges 恢复逻辑作为参考
  - [x] SubTask 4.2: 重构为构建 `knowledgePointsToInsert` 数组，通过 `nodesWithGraph` 数组索引保留 oldId 关联
  - [x] SubTask 4.3: 一次性 `supabase.from('knowledge_points').insert(knowledgePointsToInsert).select('id')`，1 次 HTTP 往返
  - [x] SubTask 4.4: 利用 Supabase 批量 insert 返回顺序与输入顺序一致的特性，通过数组索引建立 oldId→newId 映射
  - [x] SubTask 4.5: 构建 `graphNodesToInsert` 数组，过滤映射失败的节点
  - [x] SubTask 4.6: 一次性 `supabase.from('graph_nodes').insert(graphNodesToInsert)`，错误时 logger.warn
  - [x] SubTask 4.7: `stats.nodes = graphNodesToInsert.length`，映射仅在 gn 成功后设置（与原逻辑一致）
  - [x] SubTask 4.8: 运行 `npm run check` 与 `npm run lint` 通过（exit 0），edges/study_cards 恢复逻辑未修改

- [x] Task 5: AI 监控入口统一（P0-7）
  - [x] SubTask 5.1: 读取 [api/services/ai/aiMonitor.ts](file:///d:/KnowledgeMap/api/services/ai/aiMonitor.ts) 的 `withAIMonitoring` 函数签名与 [api/services/ai/utils/performanceTracker.ts](file:///d:/KnowledgeMap/api/services/ai/utils/performanceTracker.ts) 的 `withAIPerformanceTracking` 签名，确认参数兼容性（operation/provider/model/metadata/sessionId）
  - [x] SubTask 5.2: 全局搜索 `withAIPerformanceTracking` 调用方（Grep `withAIPerformanceTracking`），逐一迁移到 `withAIMonitoring`，注意 fn 返回值结构差异（performanceTracker 要求 `{ result, usage }`，aiMonitor 可能不同）
  - [x] SubTask 5.3: 全局搜索 `withAutoGraphTracking` 调用方，逐一迁移到 `withAIMonitoring`
  - [x] SubTask 5.4: 删除 [api/services/ai/utils/performanceTracker.ts](file:///d:/KnowledgeMap/api/services/ai/utils/performanceTracker.ts) 文件
  - [x] SubTask 5.5: 删除 [api/services/ai/performanceMonitor.ts](file:///d:/KnowledgeMap/api/services/ai/performanceMonitor.ts) 中的 `withAutoGraphTracking` 函数及其相关导入
  - [x] SubTask 5.6: 检查 `api/services/ai/utils/index.ts` 是否导出了被删除的函数，同步清理
  - [x] SubTask 5.7: 在 `aiMonitor.ts` 顶部 JSDoc 注释强化："此函数是所有 AI 调用监控的唯一规范入口。路由层禁止直接调用 performanceMonitor.recordLog，必须通过本函数包装"
  - [x] SubTask 5.8: 运行 `npm run check` 与 `npm run lint` 确保无类型错误

- [x] Task 6: chat.ts 路由层下沉（P0-8）
  - [x] SubTask 6.1: 读取 chat.ts 全文（398 行），梳理流式分支与非流式分支差异
  - [x] SubTask 6.2: 读取 chatService.ts 现有 chat() 方法，确认其已封装 provider 选择/mock 降级/withTimeoutAndRetry 重试
  - [x] SubTask 6.3: 在 chatService.ts 新增 `chatStream(req, res, options)` 方法，封装上下文构建/Prompt 渲染/元数据 enrichment/流式迭代/token 累加/监控记录（withAIMonitoring）/错误处理（SSE 错误事件）。同时新增 `tutorChatStream` 方法处理 `/tutor-chat` 流式分支
  - [x] SubTask 6.4: 流式方法用 withTimeoutAndRetry 仅包装 `provider.client.chat.completions.create`（连接阶段可重试），for await 迭代在其外（流开始后不重试）
  - [x] SubTask 6.5: 重写 chat.ts 流式分支：移除业务逻辑，改为 `setSSEHeaders + chatService.chatStream/tutorChatStream`
  - [x] SubTask 6.6: 保留路由层非流式分支不变（已委托 chatService.chat）
  - [x] SubTask 6.7: 保留路由层的请求体解析、auth 校验、sessionId 生成等 HTTP 层职责
  - [x] SubTask 6.8: 验证路由层行数 67 行 ≤ 80 行（原 398 行，移除约 331 行业务逻辑）
  - [x] SubTask 6.9: 运行 `npm run check` 与 `npm run lint` 通过（exit 0）

# Task Dependencies

- [Task 1] [Task 2] [Task 3] [Task 4] 之间无依赖，可完全并行执行
- [Task 5] 与 [Task 6] 建议串行执行：Task 6 的 chatStream 依赖 Task 5 完成后的 `withAIMonitoring` 单一入口（chatStream 内部使用 withAIMonitoring 而非手动 recordLog）
- [Task 5] 必须在 [Task 6] 之前完成，否则 chat.ts 下沉时仍会使用手动 recordLog 模式
- 推荐执行顺序：Task 1/2/3 并行 → Task 4 并行 → Task 5 → Task 6

# Validation

每个 Task 完成后：
1. 运行 `npm run check:incremental` 通过类型检查（若脚本 bug 持续，用 `npm run check` 替代）
2. 运行 `npm run lint` 通过代码规范检查
3. 在 Tasks 文件中勾选对应 checkbox

全部完成后：
4. 运行 `npm run check` 全量类型检查
5. 运行 `npm run lint` 全量代码规范检查
6. 运行 `npx supabase db reset` 验证迁移可重放（Task 2/3 涉及 SQL 改动）
7. 运行 `npx vitest run` 验证现有测试不被破坏
8. 验证 `routes/ai/chat.ts` 行数 ≤ 80 行
9. 验证 `api/services/ai/utils/performanceTracker.ts` 文件已删除
10. 验证全局无 `withAIPerformanceTracking` / `withAutoGraphTracking` 残留引用
