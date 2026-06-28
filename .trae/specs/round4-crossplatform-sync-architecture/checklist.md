# Checklist

## P1-20 删除 src/services/sync 重复实现

- [x] `src/services/sync/syncTypes.ts` 已删除
- [x] `src/services/sync/conflictService.ts` 已删除
- [x] `shared/sync/types.ts` 包含 `SyncDevice`、`SyncBatch`、`SyncStatus` 等类型（如原本缺失则已补充）
- [x] `src/services/sync/mobileSyncService.ts` 不再 import `./syncTypes`
- [x] `src/services/sync/mobileSyncService.ts` 不再包含 `toSharedOperation`/`fromSharedOperation`/`toSharedConflict` 转换函数
- [x] `mobileSyncService.ts` 中所有 `SyncOperation`/`SyncConflict` 引用使用 shared 类型（字段名为 `action/data` 而非 `type/record`）
- [x] `src/services/sync/deviceDiscoveryService.ts` 从 `../../../shared/sync/types` 导入 `SyncDevice`

## P1-21 抽取 shared/kernel/PluginLifecycleBase

- [x] `shared/kernel/types.ts` 存在并定义 `PluginBase`、`KernelAPIBase`、`PluginState`、`PluginEntry` 类型
- [x] `shared/kernel/PluginLifecycleBase.ts` 存在并实现 7 个核心生命周期方法（registerPlugin/activatePlugin/deactivatePlugin/activateAll/deactivateAll/getDependents/cleanupPluginRegistrations）
- [x] `shared/kernel/index.ts` 存在并 re-export PluginLifecycleBase 与 types
- [x] `src/services/kernel/Kernel.ts` 继承 `PluginLifecycleBase`，删除被基类覆盖的 7 个方法
- [x] `src/services/kernel/Kernel.ts` 保留前端独有方法（registerRoute/registerNavItem/registerApiModule/registerExtension 等）
- [x] `api/services/kernel/Kernel.ts` 继承 `PluginLifecycleBase`，删除被基类覆盖的 7 个方法
- [x] `api/services/kernel/Kernel.ts` 保留后端独有方法（registerRoutes/unregisterPlugin/loadPluginFromManifest 等）
- [x] `api/services/kernel/Kernel.ts` 中的 `console.*` 已替换为 `logger.*`（如有）

## P1-22 Electron 主进程接入 logger

- [x] `electron/utils/logger.ts` 存在并导出 `logger` 单例
- [x] `electron/utils/logger.ts` 实现与 `api/utils/logger.ts` 一致的结构化输出（颜色化终端 + 生产 JSON）
- [x] `electron/main.ts` 中所有 `console.*` 调用已替换为 `logger.*`（共 44 处）
- [x] `electron/sync/syncEngine.ts` 中所有 `console.*` 调用已替换为 `logger.*`（共 15 处）
- [x] `electron/ipc/dbHandlers.ts` 中 `console.*` 调用已替换为 `logger.*`（共 1 处）
- [x] electron 目录全量 grep `console\.(log|info|warn|error|debug)` 返回 0 处匹配

## P1-23 mobileSyncService 加重试

- [x] 评估 `api/utils/retry.ts` 是否可在前端使用；若不可用则 `shared/sync/retry.ts` 已新建并提供 `withRetry(fn, options)` 工具
- [x] `mobileSyncService.syncWithDevice` 用重试工具包裹核心同步逻辑
- [x] 重试配置：`maxRetries: 3`、指数退避 `initialDelay: 1000ms, maxDelay: 10000ms`
- [x] mobileSyncService 新增 `retryAttempts: Map<string, { count: number; lastFailure: number }>` 字段
- [x] 连续失败 ≥ 5 次的设备在下次 sync 周期被跳过

## P1-24 sync_operations 表 + 幂等性

- [x] `supabase/migrations/29_sync_operations.sql` 存在并定义 `sync_operations` 表
- [x] `sync_operations` 表包含 `id`、`client_op_id`（UNIQUE）、`user_id`、`device_id`、`table_name`、`record_id`、`action`、`applied_at` 字段
- [x] `sync_operations` 表启用 RLS（`user_id = auth.uid()`）
- [x] `sync_operations` 表有 `(user_id, client_op_id)` 复合索引
- [x] `shared/sync/types.ts` 的 `SyncOperation` 接口包含可选字段 `clientOpId?: string`
- [x] `mobileSyncService.applyOperation` 在执行前查询 `sync_operations` 表（若 operation 有 clientOpId）
- [x] `mobileSyncService.applyOperation` 执行成功后写入 `sync_operations` 记录
- [x] `mobileSyncService.syncWithDevice` 在生成 SyncOperation 时填充 `clientOpId`（UUID）

## 4.9 useMobileInit 联动 mobileSyncService

- [x] `mobileSyncService.ts` 新增 `setOnlineStatus(isOnline: boolean): void` 方法
- [x] `setOnlineStatus(true)` 时若服务未启动则 `start()` 并立即触发 `sync()`
- [x] `useMobileInit.ts` import `mobileSyncService`
- [x] `useMobileInit.ts` 在 `Network.addListener("networkStatusChange", ...)` 回调中调用 `mobileSyncService.setOnlineStatus(status.connected)`
- [x] `useMobileInit.ts` 在初始化时若 isOnline 为 true 调用 `mobileSyncService.start()`
- [x] `useMobileInit.ts` 在 useEffect 清理函数中调用 `mobileSyncService.stop()`

## 4.5 SM2 残留清理

- [x] `api/services/scheduler/core/cronService.ts` 的 `checkReviewReminders` 改为查询 `study_cards.next_review`
- [x] `cronService.ts` 不再读取 `knowledge_review_tasks` 表
- [x] `supabase/migrations/03_knowledge_points.sql` 行 27 注释不再包含 "SM-2"
- [x] `.trae/rules/project_rules.md` 不再包含 "SM2 算法" 章节
- [x] `.trae/rules/project_rules.md` 新增 "FSRS 算法" 章节，示例参照 `studyService` 实际 API
- [x] `knowledge_review_tasks` 表与索引保留（不删除，仅去引用）

## 类型与代码规范

- [x] `npm run check` 通过（无新增 TypeScript 错误）
- [x] `npm run lint` 通过（无新增 ESLint 错误）
- [x] 无新增 `any` 类型
- [x] 无新增非空断言（`!`）
- [x] 前端无新增 `console.log` / `console.info`
- [x] Electron 主进程无 `console.*` 调用（P1-22 完成后）
- [x] 后端无新增 `console.*`（使用 logger）
