# Tasks

- [x] Task 1: 定义 AchievementConditionEvaluator 接口和注册表
  - [x] SubTask 1.1: 创建 `api/services/achievements/types.ts`，定义 `AchievementConditionEvaluator` 接口（`conditionType`、`getCurrentValue(userId)`、`relevantEvents`、`getIncrementalDelta(event)`）
  - [x] SubTask 1.2: 创建 `api/services/achievements/evaluatorRegistry.ts`，实现注册表（`register(evaluator)`、`get(conditionType)`、`getByEvent(eventType)`）

- [x] Task 2: 为每种 condition_type 实现 Evaluator 类
  - [x] SubTask 2.1: 创建 `api/services/achievements/evaluators/focusEvaluators.ts` — 实现 `focus_sessions`、`total_focus_hours`、`focus_minutes`、`daily_focus_hours`、`pomodoros_completed` 五种
  - [x] SubTask 2.2: 创建 `api/services/achievements/evaluators/streakEvaluators.ts` — 实现 `consecutive_days`、`streak_days` 两种
  - [x] SubTask 2.3: 创建 `api/services/achievements/evaluators/taskEvaluators.ts` — 实现 `tasks_completed` 一种
  - [x] SubTask 2.4: 创建 `api/services/achievements/evaluators/studyEvaluators.ts` — 实现 `cards_mastered` 一种
  - [x] SubTask 2.5: 创建 `api/services/achievements/evaluators/creationEvaluators.ts` — 实现 `graphs_created`、`nodes_created` 两种
  - [x] SubTask 2.6: 创建 `api/services/achievements/evaluators/periodicStreakEvaluators.ts` — 实现 `weekly_streak`、`monthly_streak`、`quarterly_streak`、`daily_task_streak` 四种
  - [x] SubTask 2.7: 创建 `api/services/achievements/evaluators/specialEvaluators.ts` — 实现 `special_condition` 一种（委托给 checkSpecialAchievements 等现有方法）
  - [x] SubTask 2.8: 创建 `api/services/achievements/evaluators/index.ts` — 统一注册所有 Evaluator 到注册表

- [x] Task 3: 数据库 Schema 变更
  - [x] SubTask 3.1: 在 `09_gamification.sql` 的 `achievements` 表中增加 `trigger_events TEXT[] DEFAULT '{}'` 字段
  - [x] SubTask 3.2: 在 `51_seed_achievements.sql` 中为每个成就添加 `trigger_events` 值
  - [x] SubTask 3.3: 修改 `user_achievements.progress` 语义文档说明，从百分比改为实际值

- [x] Task 4: 重构 achievementService 核心引擎
  - [x] SubTask 4.1: 创建 `api/services/achievements/achievementEngine.ts`，实现 `evaluateAchievements(userId, eventType)` 方法
  - [x] SubTask 4.2: 实现增量进度更新逻辑
  - [x] SubTask 4.3: 实现幂等解锁：使用 upsert + onConflict 保证幂等
  - [x] SubTask 4.4: 实现每日校准任务：calibrateAllProgress 全量重算

- [x] Task 5: 简化 AchievementSubscriber
  - [x] SubTask 5.1: 将所有事件处理器统一为调用 `achievementEngine.evaluateAchievements(userId, eventType)`
  - [x] SubTask 5.2: 移除 Subscriber 中的业务逻辑
  - [x] SubTask 5.3: 特殊成就通过引擎内的委托调用处理

- [x] Task 6: 迁移现有调用点
  - [x] SubTask 6.1: 将旧方法标记为 @deprecated
  - [x] SubTask 6.2: autoGraph.ts 改为事件发布
  - [x] SubTask 6.3: 旧方法保留但标记 deprecated，achievements 路由改用 engine

- [x] Task 7: 更新前端类型和展示逻辑
  - [x] SubTask 7.1: 更新 Achievement 类型定义，增加 `trigger_events` 字段
  - [x] SubTask 7.2: 更新前端成就进度展示逻辑，从实际值计算百分比

- [x] Task 8: 类型检查与代码检查
  - [x] SubTask 8.1: 运行 `npm run check` 确保无类型错误
  - [x] SubTask 8.2: 运行 `npm run lint` 确保无代码规范问题

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 4] depends on [Task 1, Task 2, Task 3]
- [Task 5] depends on [Task 4]
- [Task 6] depends on [Task 4, Task 5]
- [Task 7] depends on [Task 3]
- [Task 3] 独立于其他任务
- [Task 8] depends on [Task 1-7]
