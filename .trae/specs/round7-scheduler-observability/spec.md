# Round 7: 调度可靠性与可观测性 Spec

## Why

第 7 轮优化聚焦于消除调度竞态、补全性能监控、统一类型与状态管理基础。当前问题：
- Cron 调度无分布式锁，Electron + Web 双实例会重复执行同一 schedule
- `asyncTaskService` 进程崩溃后 pending 任务永久滞留，无启动恢复，无并发上限
- `performanceMonitor` 内存 buffer + DB 混合，多实例部署内存不一致
- `eventBus` fire-and-forget，handler 失败无重试无死信
- `shared/types/database.ts` 手写 Row 类型易与 schema 漂移
- `User` 类型两处不兼容定义（`api/models/user.ts` 含 DB 密码字段；`shared/types/user.ts` 是 Supabase Auth 风格）
- 多个 Zustand store 重复 `persist(devtools(...))` 配置，key 前缀不统一
- `errorReporter.userId` 通过 localStorage 存取，登出未清理

## What Changes

- **P2-24**：`cronService.executeDueSchedules` 改用原子 claim（`UPDATE ... WHERE next_run_at = ? RETURNING *`），避免多实例重复拾取
- **P2-25**：`asyncTaskService` 增加 `recoverPendingTasks()` 启动恢复 + 基于 `system_tasks` 表的乐观锁并发上限（默认 3）
- **P2-10**：`performanceMonitor` 移除内存 buffer，`getStats`/`getLogs` 强制走 DB 查询（保留启动 warmup 但只用于预聚合统计）
- **P2-12**：`eventBus` 引入死信队列，失败 handler 入队后定时重试 N 次（默认 3 次），超限入死信日志
- **P2-14**：新增 `supabase gen types` npm 脚本，生成 `shared/types/database.generated.ts`，将手写 Row 类型逐步替换为生成类型（保留 `toGraph` 等转换函数）
- **P2-15**：统一 `User` 类型到 `shared/types/user.ts`，`api/models/user.ts` 改为 `UserWithCredentials extends User`（增加 `password_hash` 字段）
- **4.6**：抽取 `createPersistedStore` 工厂函数统一 `persist + devtools` 配置，统一 key 前缀 `km-`
- **4.7**：`errorReporter.userId` 改由 `useStore` 订阅注入，登出时自动 `clearContext()`

## Impact

- **Affected specs**：Round 4 跨平台同步（eventBus 已触及）、Round 5 类型安全（User 类型统一）、Round 6 P3-13 测试覆盖（performanceMonitor/eventBus 测试）
- **Affected code**：
  - `api/services/scheduler/core/cronService.ts`
  - `api/services/asyncTaskService.ts`
  - `api/services/ai/performanceMonitor.ts`
  - `api/services/core/eventBus.ts`
  - `shared/types/database.ts` + 新增 `database.generated.ts`
  - `api/models/user.ts`、`shared/types/user.ts`
  - `src/store/useStore.ts`、`useFocusStore.ts`、`useConsoleStore.ts`、`usePerformanceStore.ts`、`useAIPerformanceStore.ts`、`useNoiseStore.ts`、`useShortcutStore.ts`、`useLearningSettingsStore.ts`
  - `src/utils/errorReporter.ts`
  - `package.json`（新增 `db:gen-types` 脚本）

## ADDED Requirements

### Requirement: Cron 任务原子 claim

#### Scenario: 多实例并发执行
- **WHEN** 两个进程同时运行 `executeDueSchedules`
- **THEN** 同一 schedule 只被一个进程 claim 成功（`UPDATE ... WHERE id = ? AND next_run_at = ? RETURNING *` 返回行数为 1），另一进程返回空
- **AND** claim 成功的进程继续 `executeSchedule`，失败的跳过

#### Scenario: 单实例正常执行
- **WHEN** 单进程运行
- **THEN** 行为与原逻辑等价：查询 due schedules → claim → execute → update next_run_at

### Requirement: asyncTaskService 启动恢复

#### Scenario: 进程崩溃后重启
- **WHEN** 进程启动且 `asyncTaskService.initialize()` 被调用
- **THEN** 查询 `system_tasks WHERE status = 'pending' AND created_at < now() - interval '5 minutes'`
- **AND** 对每个滞留任务调用 `processTaskAsync` 恢复执行
- **AND** 恢复前将状态改为 `running` 并写入 `claimed_at` 防止双实例重复处理

### Requirement: asyncTaskService 并发控制

#### Scenario: 并发上限
- **WHEN** 同时有 N > 3 个 pending 任务待处理
- **THEN** 最多 3 个任务并发执行（基于 `system_tasks` 表乐观锁 `UPDATE ... WHERE status = 'pending' RETURNING *` claim）
- **AND** 其余任务在 `pending` 状态等待下次 claim

### Requirement: eventBus 死信队列

#### Scenario: Handler 失败重试
- **WHEN** handler 抛出错误
- **THEN** 入死信队列，延迟 1s/4s/16s（指数退避）重试 3 次
- **AND** 重试 3 次仍失败则记录 `dead_letter` 日志（含 eventType、payload 摘要、错误堆栈）
- **AND** 不阻塞 publish 调用方

### Requirement: Supabase 自动生成类型

#### Scenario: 生成命令
- **WHEN** 运行 `npm run db:gen-types`
- **THEN** 调用 `supabase gen types typescript --local > shared/types/database.generated.ts`
- **AND** 生成文件包含所有表的 Row 类型（自动同步 schema 变更）

### Requirement: store middleware 工厂化

#### Scenario: 统一创建模式
- **WHEN** 新建或重构 Zustand store
- **THEN** 使用 `createPersistedStore(name, stateCreator, persistOptions?)` 工厂
- **AND** persist key 自动加前缀 `km-<name>`
- **AND** devtools 自动启用，name 与 persist key 一致

### Requirement: errorReporter userId 注入

#### Scenario: 登出时清理
- **WHEN** 用户调用 `useStore.clearAuth()`
- **THEN** `errorReporter.clearContext()` 自动被调用
- **AND** 后续上报的错误不含 userId

## MODIFIED Requirements

### Requirement: performanceMonitor 多实例化

`getStats`/`getLogs` 不再读取内存 buffer，直接走 DB 查询：
- `getLogs(query)` 走 `SELECT * FROM ai_performance_logs WHERE ... LIMIT ?`
- `getStats(query)` 走聚合 SQL（`SUM(input_tokens)`, `COUNT(*)`, `AVG(duration)` 等）
- `recordLog` 仍同步写入 DB（已实现），不再维护内存数组
- 移除 `loadFromDatabase()` 启动加载逻辑

### Requirement: User 类型统一

- `shared/types/user.ts` 的 `User` 接口保留为唯一基础定义
- `api/models/user.ts` 的 `User` 重命名为 `UserWithCredentials`，`extends User` 增加 `password_hash: string` 字段
- 受影响引用（auth service、login route 等）更新为 `UserWithCredentials`
- `database.ts` 的 `toUser` 函数签名保持兼容

## REMOVED Requirements

### Requirement: performanceMonitor 内存 buffer

**Reason**: 多实例部署内存不一致，`getStats` 返回本地 1000 条而非全量
**Migration**: 移除 `private logs: AIPerformanceLog[]`、`loadFromDatabase()`、`addLog` 写入内存的逻辑；保留 `recordLog` 直接写 DB
