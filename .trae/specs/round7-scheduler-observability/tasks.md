# Tasks

- [x] Task 1: P2-24 Cron 原子 claim
  - [x] SubTask 1.1: 在 `cronService.executeDueSchedules` 中将普通 SELECT 改为原子 claim 模式：`UPDATE task_schedules SET next_run_at = <newNextRun> WHERE id = ? AND next_run_at = ? AND is_active = true RETURNING *`，失败（RETURNING 空）则跳过该 schedule
  - [x] SubTask 1.2: 移除 `updateScheduleNextRun` 在 `executeSchedule` 成功后的二次调用（claim 时已更新 next_run_at），改为仅在 executeSchedule 失败时回滚 next_run_at
  - [x] SubTask 1.3: 新增 `api/__tests__/services/scheduler/cronService.test.ts` 覆盖单实例正常执行、双实例并发仅一者 claim 成功、claim 失败跳过

- [x] Task 2: P2-25 asyncTaskService 启动恢复 + 并发控制
  - [x] SubTask 2.1: 在 `asyncTaskService` 新增 `initialize()` 方法，启动时查询 `system_tasks WHERE status = 'pending' AND created_at < now() - interval '5 minutes'`，对每个滞留任务调 `processTaskAsync` 恢复
  - [x] SubTask 2.2: 引入基于 `system_tasks` 表的乐观锁 claim：`UPDATE system_tasks SET status = 'running', claimed_at = now() WHERE id = ? AND status = 'pending' RETURNING *`，claim 失败则跳过（已被其他实例处理）
  - [x] SubTask 2.3: 在 `processTaskAsync` 入口处先 claim，claim 成功才执行；增加全局 `MAX_CONCURRENT = 3` 信号量，超过上限的任务保留 pending 状态等待下次轮询
  - [x] SubTask 2.4: 在 `api/app.ts` 启动钩子中调用 `asyncTaskService.initialize()`（在 Kernel bootstrap 之后）
  - [x] SubTask 2.5: 新增 `api/__tests__/services/asyncTaskService.test.ts` 覆盖启动恢复、并发上限、claim 失败跳过

- [x] Task 3: P2-10 performanceMonitor 多实例化
  - [x] SubTask 3.1: 移除 `private logs: AIPerformanceLog[]` 内存数组和 `loadFromDatabase()` 启动加载逻辑
  - [x] SubTask 3.2: `getLogs(query)` 改为直接查 DB：`SELECT * FROM ai_performance_logs WHERE ... ORDER BY timestamp DESC LIMIT ?`
  - [x] SubTask 3.3: `getStats(query)` 改为聚合 SQL：`SELECT COUNT(*), SUM(input_tokens), SUM(output_tokens), SUM(estimated_cost), AVG(duration), SUM(CASE WHEN success THEN 1 ELSE 0 END) FROM ai_performance_logs WHERE ...`
  - [x] SubTask 3.4: 保留 `recordLog` 同步写 DB 逻辑，移除 `addLog` 写内存的代码路径
  - [x] SubTask 3.5: 新增 `api/__tests__/services/ai/performanceMonitor.test.ts` 覆盖 getLogs 走 DB、getStats 聚合、recordLog 写入

- [x] Task 4: P2-12 eventBus 死信队列
  - [x] SubTask 4.1: 在 `AppEventBus` 新增 `private deadLetterQueue: DeadLetterEntry[]` 数组（限制 100 条，超限丢弃最旧）
  - [x] SubTask 4.2: 修改 `publish` 中的 handler 执行逻辑：失败时入死信队列，延迟 1s/4s/16s（指数退避）重试 3 次
  - [x] SubTask 4.3: 重试 3 次仍失败则记录 `logger.error` 死信日志（含 eventType、event id、payload 摘要、错误堆栈）
  - [x] SubTask 4.4: 新增 `getDeadLetterQueue()` 方法供运维查询
  - [x] SubTask 4.5: 新增 `api/__tests__/services/core/eventBus.test.ts` 覆盖正常 publish、handler 失败重试 3 次、超限入死信

- [x] Task 5: P2-14 Supabase 自动生成类型
  - [x] SubTask 5.1: 在 `package.json` 新增 `"db:gen-types": "supabase gen types typescript --local > shared/types/database.generated.ts"` 脚本
  - [x] SubTask 5.2: 运行 `npm run db:gen-types` 生成 `shared/types/database.generated.ts`
  - [x] SubTask 5.3: 在 `shared/types/database.ts` 顶部增加 `import type { Database } from "./database.generated"`，将手写 Row 类型逐步替换为 `Database["public"]["Tables"]["<table>"]["Row"]` 形式（先替换 5 个高频 Row：KnowledgeGraphRow、GraphNodeRow、StudyCardRow、GraphRelationRow、DomainRow 作为试点）
  - [x] SubTask 5.4: 保留 `toGraph`、`toNode` 等转换函数签名兼容，仅替换 Row 类型来源
  - [x] SubTask 5.5: 在 `project_rules.md` 补充"schema 变更后必须运行 `npm run db:gen-types`"规范

- [x] Task 6: P2-15 User 类型统一
  - [x] SubTask 6.1: 将 `shared/types/user.ts` 的 `User` 接口保留为基础定义（含可选 `profile` 字段）
  - [x] SubTask 6.2: 在 `api/models/user.ts` 中将 `User` 重命名为 `UserWithCredentials`，`extends User` 增加 `password_hash: string` 必填字段，移除与 `User` 重复的字段（id、email、name 等）
  - [x] SubTask 6.3: 更新 `UserWithoutPassword` 为 `Omit<UserWithCredentials, 'password_hash'>`
  - [x] SubTask 6.4: 更新 `excludePassword` 函数签名为 `(user: UserWithCredentials) => UserWithoutPassword`
  - [x] SubTask 6.5: 全局搜索 `from "../models/user"` 或 `from "../../models/user"` 的引用，将 `User` 改为 `UserWithCredentials`（涉及 authService、auth route、login 等）
  - [x] SubTask 6.6: 验证 `database.ts` 的 `toUser` 函数返回类型仍为 `User`（从 `shared/types/user.ts` 导入）

- [x] Task 7: 4.6 store middleware 工厂化
  - [x] SubTask 7.1: 在 `src/store/createPersistedStore.ts` 新建工厂函数，封装 `persist(devtools(stateCreator, { name }), { name, storage })` 模式
  - [x] SubTask 7.2: 工厂签名：`createPersistedStore<T>(name: string, stateCreator: StateCreator<T>, options?: { partialize?: ...; version?: number })`
  - [x] SubTask 7.3: persist key 自动加前缀 `km-<name>`（如 `km-console`、`km-focus`）
  - [x] SubTask 7.4: 将 `useStore.ts`、`useFocusStore.ts`、`useConsoleStore.ts`、`usePerformanceStore.ts`、`useAIPerformanceStore.ts`、`useNoiseStore.ts`、`useShortcutStore.ts`、`useLearningSettingsStore.ts` 全部改为使用 `createPersistedStore`
  - [x] SubTask 7.5: 迁移旧 localStorage key（启动时一次性迁移：`localStorage.getItem("knowledgeMap-console")` → `localStorage.getItem("km-console")`，迁移后删除旧 key）

- [x] Task 8: 4.7 errorReporter userId 注入
  - [x] SubTask 8.1: 在 `useStore.ts` 的 `setUser` 中调用 `setUserContext(user.id, user.email)`，`clearAuth` 中调用 `errorReporter.clearContext()`
  - [x] SubTask 8.2: 移除 `errorReporter.ts` 中通过 `localStorage.getItem("errorContext")` 读取 userId 的逻辑，改为模块内 `let currentUserId: string | undefined`，由 `setUserContext` 设置
  - [x] SubTask 8.3: 保留 `setUserContext` / `clearContext` 公开 API，但内部不再读写 localStorage
  - [x] SubTask 8.4: 在 `main.tsx` 启动时，若 `useStore` 已有 user（从 persist 恢复），调用 `setUserContext` 同步状态

# Task Dependencies

- Task 5 生成 `database.generated.ts` 后，Task 6 的 User 类型统一可参考生成类型字段（弱依赖，可并行）
- Task 7 与 Task 8 都涉及 `useStore.ts`，Task 7 先重构工厂，Task 8 再注入 errorReporter 调用
- Task 1/2/3/4 互相独立，可并行
