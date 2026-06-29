# Round 7 Checklist

## Task 1: P2-24 Cron 原子 claim

- [x] `cronService.executeDueSchedules` 使用 `UPDATE ... WHERE id = ? AND next_run_at = ? AND is_active = true RETURNING *` 原子 claim
- [x] claim 失败（RETURNING 空）时跳过该 schedule
- [x] `updateScheduleNextRun` 不再在 executeSchedule 成功后二次调用（claim 时已更新）
- [x] executeSchedule 失败时回滚 next_run_at（恢复为原值）
- [x] `api/__tests__/services/scheduler/cronService.test.ts` 覆盖单实例正常执行、双实例并发仅一者 claim 成功、claim 失败跳过
- [x] `npm run check` 通过
- [x] `npm run lint` 通过

## Task 2: P2-25 asyncTaskService 启动恢复 + 并发控制

- [x] `asyncTaskService.initialize()` 方法已创建，查询 `status = 'pending' AND created_at < now() - interval '5 minutes'` 滞留任务
- [x] 滞留任务调用 `processTaskAsync` 恢复前先 claim（`UPDATE ... SET status = 'running', claimed_at = now() WHERE id = ? AND status = 'pending' RETURNING *`）
- [x] `processTaskAsync` 入口先 claim，claim 失败则跳过
- [x] 全局 `MAX_CONCURRENT = 3` 信号量，超过上限的任务保留 pending 状态
- [x] `api/app.ts` 启动钩子中调用 `asyncTaskService.initialize()`（Kernel bootstrap 之后）
- [x] `api/__tests__/services/asyncTaskService.test.ts` 覆盖启动恢复、并发上限、claim 失败跳过
- [x] `npm run check` 通过
- [x] `npm run lint` 通过

## Task 3: P2-10 performanceMonitor 多实例化

- [x] `performanceMonitor.ts` 移除 `private logs: AIPerformanceLog[]` 内存数组
- [x] 移除 `loadFromDatabase()` 启动加载逻辑与 `initialize()` 中的调用
- [x] `getLogs(query)` 直接查 DB：`SELECT * FROM ai_performance_logs WHERE ... ORDER BY timestamp DESC LIMIT ?`
- [x] `getStats(query)` 改为聚合 SQL（COUNT、SUM、AVG）
- [x] `recordLog` 同步写 DB 逻辑保留，移除写内存的代码路径
- [x] `api/__tests__/services/ai/performanceMonitor.test.ts` 覆盖 getLogs 走 DB、getStats 聚合、recordLog 写入
- [x] `npm run check` 通过
- [x] `npm run lint` 通过

## Task 4: P2-12 eventBus 死信队列

- [x] `AppEventBus` 新增 `private deadLetterQueue: DeadLetterEntry[]`（限 100 条，超限丢弃最旧）
- [x] `publish` 中 handler 失败时入死信队列，延迟 1s/4s/16s 重试 3 次
- [x] 重试 3 次仍失败则 `logger.error` 记录死信日志（含 eventType、event id、payload 摘要、错误堆栈）
- [x] `publish` 调用方不被阻塞（异步执行重试）
- [x] 新增 `getDeadLetterQueue()` 方法
- [x] `api/__tests__/services/core/eventBus.test.ts` 覆盖正常 publish、handler 失败重试 3 次、超限入死信
- [x] `npm run check` 通过
- [x] `npm run lint` 通过

## Task 5: P2-14 Supabase 自动生成类型

- [x] `package.json` 新增 `"db:gen-types": "supabase gen types typescript --local > shared/types/database.generated.ts"` 脚本
- [x] `shared/types/database.generated.ts` 已生成（包含所有表的 Row 类型）
- [x] `shared/types/database.ts` 顶部 `import type { Database } from "./database.generated"`
- [x] 5 个高频 Row 类型（KnowledgeGraphRow、GraphNodeRow、StudyCardRow、GraphRelationRow、DomainRow）已替换为 `Database["public"]["Tables"]["<table>"]["Row"]` 形式
- [x] `toGraph`、`toNode` 等转换函数签名保持兼容
- [x] `project_rules.md` 补充 "schema 变更后必须运行 `npm run db:gen-types`" 规范
- [x] `npm run check` 通过
- [x] `npm run lint` 通过

## Task 6: P2-15 User 类型统一

- [x] `shared/types/user.ts` 的 `User` 接口为基础定义（含可选 `profile`）
- [x] `api/models/user.ts` 的 `User` 重命名为 `UserWithCredentials extends User`，增加 `password_hash: string`
- [x] 移除 `UserWithCredentials` 与 `User` 重复的字段（id、email、name 等）
- [x] `UserWithoutPassword` 改为 `Omit<UserWithCredentials, 'password_hash'>`
- [x] `excludePassword` 签名更新为 `(user: UserWithCredentials) => UserWithoutPassword`
- [x] 全局引用 `from "../models/user"` 的 `User` 改为 `UserWithCredentials`
- [x] `database.ts` 的 `toUser` 函数返回类型仍为 `User`（从 `shared/types/user.ts`）
- [x] `npm run check` 通过
- [x] `npm run lint` 通过

## Task 7: 4.6 store middleware 工厂化

- [x] `src/store/createPersistedStore.ts` 已创建，导出 `createPersistedStore<T>(name, stateCreator, options?)` 工厂
- [x] persist key 自动加前缀 `km-<name>`
- [x] devtools 自动启用，name 与 persist key 一致
- [x] 8 个 store（useStore、useFocusStore、useConsoleStore、usePerformanceStore、useAIPerformanceStore、useNoiseStore、useShortcutStore、useLearningSettingsStore）全部改用 `createPersistedStore`
- [x] 启动时一次性迁移旧 localStorage key（`knowledgeMap-*` → `km-*`），迁移后删除旧 key
- [x] `npm run check` 通过
- [x] `npm run lint` 通过

## Task 8: 4.7 errorReporter userId 注入

- [x] `useStore.ts` 的 `setUser` 调用 `setUserContext(user.id, user.email)`
- [x] `useStore.ts` 的 `clearAuth` 调用 `errorReporter.clearContext()`
- [x] `errorReporter.ts` 移除 `localStorage.getItem("errorContext")` 读取逻辑，改为模块内 `let currentUserId: string | undefined`
- [x] `setUserContext` / `clearContext` 公开 API 保留，内部不再读写 localStorage
- [x] `main.tsx` 启动时若 `useStore` 已有 user（从 persist 恢复），调用 `setUserContext` 同步
- [x] `npm run check` 通过
- [x] `npm run lint` 通过

## 全局验证

- [x] `npm run check` 通过
- [x] `npm run check:electron` 通过
- [x] `npm run lint` 通过
- [x] `npm test` 通过（新增测试 55/55：cronService 10 + asyncTaskService 8 + performanceMonitor 20 + eventBus 17；既有核心测试 94/94 无回归）
- [x] 无新增 `any` 类型（生产代码）
- [x] 无新增非空断言（`!`）
- [x] 无新增 `console.log`/`console.info`（前端）
- [x] 无新增 `console.*`（后端，使用 logger）

## 已知遗留问题（非本轮引入）

- `api/__tests__/utils/retry.test.ts` 中 2 个测试失败：`DEFAULT_TIMEOUT` 已从 30000 改为 60000，但测试断言未同步更新。属 Round 2 遗留问题。
- Round 6 Task 10 Project References：因 `src` ↔ `api` 循环 import 阻止 build mode 启用。Round 7 已修复 `retry.ts` 跨边界 import，但仍有其他循环依赖需逐步清理。
