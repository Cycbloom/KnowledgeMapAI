# 第四轮 跨平台与同步架构优化 Spec

## Why

第四轮优化路线图中的 P1-20、P1-21、P1-22、P1-23、P1-24、4.9、4.5 暴露了跨平台与同步子系统的七类问题。经核实，所有声明方向均成立，但有若干事实性修正：

1. **P1-20** — `src/services/sync/syncTypes.ts` + `conflictService.ts` 确为 `shared/sync` 的重复实现，应统一到 shared。**声明字段名归属颠倒**：实际是 src 用 `type/record`，shared 用 `action/data`。`conflictService.ts` 是死代码（0 外部引用）。
2. **P1-21** — 前后端 `Kernel.ts` 共 601 行，重复约 115-160 行核心生命周期逻辑（声明 200 行偏乐观）；`shared/kernel/` 目录需新建。
3. **P1-22** — electron 目录共 **60 处** `console.*` 调用（main.ts 44处、syncEngine.ts 15处、dbHandlers.ts 1处），违反项目规则"后端：使用 logger 工具，禁止 console"。
4. **P1-23** — `mobileSyncService.syncWithDevice` 仅 try/catch + console.warn，无重试机制，失败后需等 15 分钟下一周期。
5. **P1-24** — `mobileSyncService.applyOperation` 无幂等键，重试会重复 insert；**`sync_operations` 表本身不存在**。
6. **4.9** — `useMobileInit` 获取 isOnline 但未传给 mobileSyncService；`mobileSyncService.setOnlineStatus` 方法不存在。**重大发现**：mobileSyncService 在全工程零引用，是孤立死代码。用户已确认按"修复并激活接入"方向实施。
7. **4.5** — SM2 已废弃但仍被 `cronService.ts:268` 读取 `knowledge_review_tasks` 表；`sm2Service` 文件已不存在但 `project_rules.md` 行 302-310 仍引用。

## What Changes

### P1-20 删除 src/services/sync 重复实现

- 删除 `src/services/sync/syncTypes.ts`（仅 2 个外部消费者：`mobileSyncService.ts`、`deviceDiscoveryService.ts`）
- 删除 `src/services/sync/conflictService.ts`（0 个外部消费者，死代码）
- `mobileSyncService.ts`：移除 `./syncTypes` 导入，移除 `toSharedOperation`/`fromSharedOperation`/`toSharedConflict` 三个转换函数（直接使用 shared 类型）
- `deviceDiscoveryService.ts`：将 `SyncDevice` 类型改为从 `../../../shared/sync/types` 导入（如 shared 已有则用，否则在 shared 中补充）
- 若 shared/sync/types.ts 缺少 `SyncDevice`、`SyncBatch`、`SyncStatus` 等类型，需补充到 shared

### P1-21 抽取 shared/kernel/PluginLifecycleBase

- 新建 `shared/kernel/PluginLifecycleBase.ts`：抽取 7 个核心生命周期方法的模板方法（`registerPlugin`、`activatePlugin`、`deactivatePlugin`、`activateAll`、`deactivateAll`、`getDependents`、`cleanupPluginRegistrations`）
- 新建 `shared/kernel/types.ts`：定义 `PluginBase`（含 name/version/description/dependencies/onInstall/onActivate/onDeactivate/onUninstall）与 `KernelAPIBase`（最小通用接口，仅 `getPlugin`）
- 前端 `Kernel.ts` 继承 `PluginLifecycleBase`，保留前端独有方法（`registerRoute`、`registerNavItem`、`registerApiModule`、`registerExtension` 等）
- 后端 `Kernel.ts` 继承 `PluginLifecycleBase`，保留后端独有方法（`registerRoutes`、`unregisterPlugin`、`loadPluginFromManifest` 等）
- 前端 `Plugin.onInstall(kernel: FrontendKernelAPI)` 与后端 `Plugin.onInstall(kernel: KernelAPI)` 各自的 API 类型保持不变，但 `PluginBase` 接口共享

### P1-22 Electron 主进程接入 logger

- 新建 `electron/utils/logger.ts`：参考 `api/utils/logger.ts` 的结构化 Logger 实现，导出单例 `logger`
- 替换 `electron/main.ts` 中 44 处 `console.*` 为 `logger.info/warn/error/debug`
- 替换 `electron/sync/syncEngine.ts` 中 15 处 `console.*`
- 替换 `electron/ipc/dbHandlers.ts` 中 1 处 `console.*`

### P1-23 mobileSyncService 加重试

- 修改 `mobileSyncService.ts` 的 `syncWithDevice` 方法
- 复用 `api/utils/retry.ts` 的 `withTimeoutAndRetry`（若不可跨端使用，则在 `shared/sync/retry.ts` 新建轻量重试工具）
- 配置：`maxRetries: 3`、`initialDelay: 1000ms`、`maxDelay: 10000ms`
- 失败计数：维护 `Map<deviceId, { count: number; lastFailure: number }>`，连续失败 N 次后跳过该设备

### P1-24 mobileSyncService 加幂等性

- 在 `SyncOperation` 类型（shared/sync/types.ts）中增加可选字段 `clientOpId: string`（UUID，由客户端生成）
- 修改 `mobileSyncService.applyOperation`：在执行 insert/update/delete 前，先用 `clientOpId` 查询是否已应用
- 由于 `sync_operations` 表不存在，需在 `supabase/migrations/` 新增 schema 文件（按命名规范 `{两位序号}_sync_operations.sql`）创建 `sync_operations` 表，含 `id`、`client_op_id`（唯一索引）、`applied_at` 等字段
- 每次 applyOperation 成功后写入 `sync_operations` 表，重试时先查 client_op_id 是否已存在

### 4.9 useMobileInit 与 mobileSyncService 联动

- 在 `mobileSyncService.ts` 中实现 `setOnlineStatus(isOnline: boolean)` 方法：
  - `isOnline = true` 时：若服务未启动则 `start()`，并立即触发一次 `sync()`
  - `isOnline = false` 时：可选停止 sync（保留定时器以备恢复）
- 在 `useMobileInit.ts` 中 import `mobileSyncService`，在 `Network.addListener("networkStatusChange", ...)` 回调中调用 `mobileSyncService.setOnlineStatus(status.connected)`
- 在 `useMobileInit` 卸载时调用 `mobileSyncService.stop()`
- 确保移动端在 `useMobileInit` 调用后激活 mobileSyncService（首次 start）

### 4.5 SM2 残留清理

- 修改 `cronService.ts:268` 的 `checkReviewReminders` 方法：改查 `study_cards.next_review`（FSRS 表），不再读 `knowledge_review_tasks`
- 修改 `supabase/migrations/03_knowledge_points.sql:27`：注释 "用于 SM-2 算法和智能调度" 改为 "用于知识点掌握度评估"（保留 mastery_level 字段但更新注释）
- 修改 `.trae/rules/project_rules.md` 行 302-310：将 "SM2 算法" 章节改为 "FSRS 算法" 章节，示例改为 `studyService.scheduleReview(card, rating)` 之类（参照实际 API）
- **不删除** `knowledge_review_tasks` 表与索引（避免破坏向后兼容）；保留 DEPRECATED 标记

## Impact

- **Affected specs**: 无直接关联
- **Affected code**:
  - `src/services/sync/syncTypes.ts`（删除）
  - `src/services/sync/conflictService.ts`（删除）
  - `src/services/sync/mobileSyncService.ts`（P1-20 + P1-23 + P1-24 + 4.9）
  - `src/services/sync/deviceDiscoveryService.ts`（P1-20）
  - `shared/sync/types.ts`（P1-20 + P1-24）
  - `shared/kernel/PluginLifecycleBase.ts`（新建）
  - `shared/kernel/types.ts`（新建）
  - `src/services/kernel/Kernel.ts`（P1-21）
  - `api/services/kernel/Kernel.ts`（P1-21）
  - `electron/utils/logger.ts`（新建）
  - `electron/main.ts`（P1-22）
  - `electron/sync/syncEngine.ts`（P1-22）
  - `electron/ipc/dbHandlers.ts`（P1-22）
  - `src/hooks/useMobileInit.ts`（4.9）
  - `api/services/scheduler/core/cronService.ts`（4.5）
  - `supabase/migrations/03_knowledge_points.sql`（4.5）
  - `supabase/migrations/{新序号}_sync_operations.sql`（新建，P1-24）
  - `.trae/rules/project_rules.md`（4.5）

## ADDED Requirements

### Requirement: shared/sync 作为单一同步类型源

系统 SHALL 在 `shared/sync/` 中定义所有同步相关类型与函数；`src/services/sync/` 不得重复定义 `SyncOperation`、`SyncConflict` 等类型或 `detectConflict`、`mergeOperations` 等函数。

#### Scenario: 跨模块同步调用无类型转换

- **WHEN** mobileSyncService 调用 shared/sync 的 conflictDetector 或 conflictResolver
- **THEN** 无需 `toSharedOperation`/`fromSharedOperation` 转换函数，直接传 shared 类型实例

### Requirement: 前后端 Kernel 共享生命周期基类

系统 SHALL 在 `shared/kernel/PluginLifecycleBase.ts` 中实现插件生命周期模板方法（registerPlugin/activatePlugin/deactivatePlugin/activateAll/deactivateAll/getDependents/cleanupPluginRegistrations），前后端 Kernel 继承该基类并扩展自己的平台 API。

#### Scenario: 前端 Kernel 注册插件

- **WHEN** 前端调用 `kernel.registerPlugin(plugin)`
- **THEN** 调用 shared 基类的注册逻辑（依赖检查、状态切换），随后前端 Kernel 可调用 `plugin.onInstall(frontendKernelAPI)` 注入前端 API

### Requirement: Electron 主进程使用结构化 logger

系统 SHALL 在 `electron/utils/logger.ts` 提供与 `api/utils/logger.ts` 一致的结构化 Logger 单例，Electron 主进程的所有日志输出通过 `logger.info/warn/error/debug` 完成，禁止 `console.*`。

#### Scenario: Electron 启动失败时输出结构化错误

- **WHEN** Electron 主进程发生未捕获异常
- **THEN** logger 输出 JSON 格式（含 timestamp/level/message/stack），而非裸 `console.error`

### Requirement: mobileSyncService 失败重试

系统 SHALL 在 `syncWithDevice` 失败时按指数退避策略重试，最大重试 3 次；连续失败 N 次后跳过该设备。

#### Scenario: 网络抖动后重试成功

- **WHEN** syncWithDevice 第一次失败（如网络抖动）
- **THEN** 按 1s/2s/4s 退避重试，最多 3 次；若任一重试成功则视为同步成功

### Requirement: mobileSyncService 幂等性保证

系统 SHALL 为每个 SyncOperation 生成 `clientOpId`（UUID），applyOperation 前先查询 `sync_operations` 表是否已应用，已应用则跳过。

#### Scenario: 网络中断后重试不重复 insert

- **WHEN** mobileSyncService push operation 后未收到响应，下次重试同一 operation
- **THEN** 通过 `clientOpId` 查询 `sync_operations` 表发现已应用，跳过 insert，避免重复记录

### Requirement: useMobileInit 与 mobileSyncService 联动

系统 SHALL 在 `useMobileInit` 监听到网络状态变化时调用 `mobileSyncService.setOnlineStatus(isOnline)`；网络恢复时立即触发一次 sync。

#### Scenario: 网络从离线恢复到在线

- **WHEN** Capacitor Network 监听到 `networkStatusChange` 且 `connected = true`
- **THEN** `mobileSyncService.setOnlineStatus(true)` 启动 sync 定时器并立即触发一次 `sync()`

### Requirement: SM2 残留清理

系统 SHALL 将所有 SM2 引用替换为 FSRS；`cronService.checkReviewReminders` 改查 `study_cards.next_review`；`project_rules.md` 示例改为 FSRS。

#### Scenario: 定时任务读取 FSRS 表

- **WHEN** `cronService.checkReviewReminders` 触发
- **THEN** 查询 `study_cards` 表的 `next_review` 字段，不再读 `knowledge_review_tasks` 表

## MODIFIED Requirements

### Requirement: shared/sync 类型扩展

`shared/sync/types.ts` SHALL 包含 `SyncOperation`（含 `clientOpId` 可选字段）、`SyncConflict`、`SyncDevice`、`SyncBatch`、`SyncStatus` 等同步相关类型，作为前后端共享的唯一类型源。

### Requirement: mobileSyncService 内部状态

`mobileSyncService` SHALL 维护 `onlineStatus: boolean`、`retryAttempts: Map<deviceId, { count: number; lastFailure: number }>` 等内部状态，通过 `setOnlineStatus` 方法外部控制。

## REMOVED Requirements

### Requirement: src/services/sync/syncTypes.ts 类型定义

**Reason**: 与 shared/sync/types.ts 重复，且字段名不一致（src 用 `type/record`，shared 用 `action/data`），强制类型转换带来运行时开销与维护负担。
**Migration**: 删除该文件，2 个外部消费者改为从 shared/sync/types 导入；如 shared 缺失 `SyncDevice` 等类型，则在 shared 中补充。

### Requirement: src/services/sync/conflictService.ts 函数实现

**Reason**: 与 shared/sync/conflictDetector + conflictResolver 重复，且自身 0 外部引用，是死代码。
**Migration**: 直接删除，无需迁移。

### Requirement: project_rules.md SM2 算法示例

**Reason**: `sm2Service` 文件已不存在，规则文档引用已删除的服务误导开发者。
**Migration**: 替换为 FSRS 算法示例（参照 `studyService` 实际 API）。
