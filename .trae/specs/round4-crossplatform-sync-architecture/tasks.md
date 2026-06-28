# Tasks

- [x] Task 1: P1-20 删除 src/services/sync/syncTypes.ts + conflictService.ts
  - [x] SubTask 1.1: 检查 shared/sync/types.ts 是否包含 `SyncDevice`、`SyncBatch`、`SyncStatus` 等类型；若缺失则在 shared/sync/types.ts 中补充（参照 src/services/sync/syncTypes.ts 中的定义，但用 shared 的字段名约定 `action/data` 而非 `type/record`）
  - [x] SubTask 1.2: 修改 `src/services/sync/mobileSyncService.ts`：移除 `./syncTypes` 导入；移除 `toSharedOperation`/`fromSharedOperation`/`toSharedConflict` 三个转换函数（行 20-56）；将内部所有 `SyncOperation`/`SyncConflict` 引用改为 shared 类型（字段名随之从 `type/record` 改为 `action/data`）
  - [x] SubTask 1.3: 修改 `src/services/sync/deviceDiscoveryService.ts`：将 `SyncDevice` 类型导入路径从 `./syncTypes` 改为 `../../../shared/sync/types`
  - [x] SubTask 1.4: 删除 `src/services/sync/syncTypes.ts`
  - [x] SubTask 1.5: 删除 `src/services/sync/conflictService.ts`

- [x] Task 2: P1-21 抽取 shared/kernel/PluginLifecycleBase
  - [x] SubTask 2.1: 新建 `shared/kernel/types.ts`：定义 `PluginBase` 接口（含 `name`/`version`/`description`/`dependencies?`/`onInstall(kernel: T)`/`onActivate?`/`onDeactivate?`/`onUninstall?`，使用泛型 T 表示 KernelAPI 类型）、`KernelAPIBase` 接口（仅 `getPlugin(name)`）、`PluginState` 类型、`PluginEntry<T>` 接口
  - [x] SubTask 2.2: 新建 `shared/kernel/PluginLifecycleBase.ts`：抽象类，泛型 `<TPlugin extends PluginBase, TAPI>`，实现 7 个核心生命周期方法（`registerPlugin`/`activatePlugin`/`deactivatePlugin`/`activateAll`/`deactivateAll`/`getDependents`/`cleanupPluginRegistrations`）；定义抽象方法 `getPluginAPI(plugin: TPlugin): TAPI`（由子类实现以注入平台 API）；维护 `pluginRegistry: Map<string, PluginEntry>`
  - [x] SubTask 2.3: 修改 `src/services/kernel/Kernel.ts`：继承 `PluginLifecycleBase<Plugin, FrontendKernelAPI>`；重写 `getPluginAPI` 返回 `frontendKernelAPI`；删除被基类覆盖的 7 个方法；保留前端独有方法（`registerRoute`/`registerNavItem`/`registerApiModule`/`registerExtension` 等）
  - [x] SubTask 2.4: 修改 `api/services/kernel/Kernel.ts`：继承 `PluginLifecycleBase<Plugin, KernelAPI>`；重写 `getPluginAPI` 返回 `kernelAPI`；删除被基类覆盖的 7 个方法；保留后端独有方法（`registerRoutes`/`unregisterPlugin`/`loadPluginFromManifest` 等）；将 `console.warn` 改为 `logger.warn`
  - [x] SubTask 2.5: 新建 `shared/kernel/index.ts`：re-export PluginLifecycleBase 与 types

- [x] Task 3: P1-22 新建 electron/utils/logger.ts
  - [x] SubTask 3.1: 新建 `electron/utils/logger.ts`：参考 `api/utils/logger.ts` 实现，定义 LogLevel 枚举与 StructuredLogData 接口；实现 Logger 类（颜色化终端输出 + 生产环境 JSON 结构化）；导出单例 `logger`
  - [x] SubTask 3.2: 修改 `electron/main.ts`：import logger from `./utils/logger`；将 44 处 `console.log/info/warn/error/debug` 替换为对应 `logger.info/warn/error/debug`（按语义匹配，console.log → logger.info）
  - [x] SubTask 3.3: 修改 `electron/sync/syncEngine.ts`：import logger from `../utils/logger`；将 15 处 `console.*` 替换
  - [x] SubTask 3.4: 修改 `electron/ipc/dbHandlers.ts`：import logger；将 1 处 `console.*` 替换

- [x] Task 4: P1-23 mobileSyncService 加重试
  - [x] SubTask 4.1: 评估 `api/utils/retry.ts` 的 `withTimeoutAndRetry` 是否可在前端使用（依赖项检查）；若不可用则新建 `shared/sync/retry.ts` 实现轻量级 `withRetry(fn, options)` 工具（指数退避 + 最大重试 + 失败回调）
  - [x] SubTask 4.2: 修改 `mobileSyncService.ts` 的 `syncWithDevice`：用 `withRetry` 包裹核心同步逻辑；配置 `maxRetries: 3, initialDelay: 1000, maxDelay: 10000`
  - [x] SubTask 4.3: 在 mobileSyncService 中新增 `retryAttempts: Map<string, { count: number; lastFailure: number }>` 字段；syncWithDevice 失败时更新计数；连续失败 ≥ 5 次的设备在下次 sync 周期跳过

- [x] Task 5: P1-24 sync_operations 表 + 幂等性
  - [x] SubTask 5.1: 新建 `supabase/migrations/29_sync_operations.sql`：定义 `sync_operations` 表（`id` UUID PK、`client_op_id` TEXT NOT NULL UNIQUE、`user_id` UUID、`device_id` TEXT、`table_name` TEXT、`record_id` TEXT、`action` TEXT、`applied_at` TIMESTAMPTZ DEFAULT now()）；启用 RLS（user_id = auth.uid()）；创建索引 `idx_sync_operations_user_client` ON (user_id, client_op_id)
  - [x] SubTask 5.2: 修改 `shared/sync/types.ts` 的 `SyncOperation` 接口：增加可选字段 `clientOpId?: string`
  - [x] SubTask 5.3: 修改 `mobileSyncService.ts` 的 `applyOperation`：在执行 insert/update/delete 前，若 operation 有 clientOpId，则查询 `sync_operations` 表是否已存在该 client_op_id；已存在则跳过；执行成功后写入 `sync_operations` 记录
  - [x] SubTask 5.4: 修改 `mobileSyncService.ts` 的 `syncWithDevice`：在生成 SyncOperation 时调用 `crypto.randomUUID()`（或 `uuid` 库）填充 `clientOpId` 字段

- [x] Task 6: 4.9 useMobileInit 联动 mobileSyncService
  - [x] SubTask 6.1: 修改 `mobileSyncService.ts`：新增 `setOnlineStatus(isOnline: boolean): void` 方法；`isOnline = true` 时若服务未启动则 `start()`，并立即触发 `sync()`；`isOnline = false` 时仅记录状态不停止定时器
  - [x] SubTask 6.2: 修改 `useMobileInit.ts`：import `mobileSyncService`；在 `Network.addListener("networkStatusChange", ...)` 回调中添加 `mobileSyncService.setOnlineStatus(status.connected)`；在 useEffect 初始化时若 isOnline 为 true 则调用 `mobileSyncService.start()`；在 useEffect 清理函数中调用 `mobileSyncService.stop()`

- [x] Task 7: 4.5 SM2 残留清理
  - [x] SubTask 7.1: 修改 `api/services/scheduler/core/cronService.ts` 的 `checkReviewReminders` 方法（行 264-280 附近）：将 `.from("knowledge_review_tasks").select("id, user_id, knowledge_point_id, next_review_date")` 改为 `.from("study_cards").select("id, user_id, knowledge_point_id, next_review")`；将 `.lte("next_review_date", ...)` 改为 `.lte("next_review", ...)`
  - [x] SubTask 7.2: 修改 `supabase/migrations/03_knowledge_points.sql` 行 27：将 COMMENT 文本 "知识点掌握度 (0.00-1.00)，用于 SM-2 算法和智能调度" 改为 "知识点掌握度 (0.00-1.00)，用于评估知识点掌握程度"
  - [x] SubTask 7.3: 修改 `.trae/rules/project_rules.md` 行 300-310：将 "### SM2 算法" 章节标题改为 "### FSRS 算法"；将示例代码 `sm2Service.calculateNextReview(quality, interval, easeFactor)` 改为参照 `studyService` 实际 API 的示例（如 `studyService.scheduleReview(card, rating)`）；将参数说明从 quality/interval/easeFactor 改为 card/rating

# Task Dependencies

- Task 1 独立（修改 src/services/sync/）
- Task 2 独立（新建 shared/kernel/ + 修改前后端 Kernel.ts）
- Task 3 独立（新建 electron/utils/logger.ts + 替换 3 个文件的 console.*）
- Task 4 必须在 Task 5 之前完成（Task 5 的 applyOperation 修改基于 Task 4 的 retryAttempts 字段）；且 Task 4 与 Task 5 都修改 mobileSyncService.ts，需顺序执行
- Task 6 修改 mobileSyncService.ts（新增 setOnlineStatus）+ useMobileInit.ts；与 Task 4/5 都修改 mobileSyncService.ts，需顺序执行（建议 Task 4 → Task 5 → Task 6）
- Task 7 独立（修改 cronService + SQL 注释 + project_rules.md）
- Task 1 与 Task 4 都修改 mobileSyncService.ts，需顺序执行（建议 Task 1 → Task 4 → Task 5 → Task 6）
- 推荐并行批次：[Task 2, Task 3, Task 7] + [Task 1] → [Task 4] → [Task 5] → [Task 6]
- 注：Task 1 修改 mobileSyncService.ts（移除转换函数），需在 Task 4 之前完成以避免冲突
