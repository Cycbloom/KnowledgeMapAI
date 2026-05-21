# Tasks

- [x] Task 1: 扩展 `checkAndUnlockAchievements()` 覆盖所有 condition_type
  - [x] SubTask 1.1: 在 `achievementService.ts` 的 `checkAndUnlockAchievements()` 中添加 `streak_days`、`focus_minutes`、`cards_mastered`、`graphs_created`、`nodes_created` 的 case 分支，通过查询数据库获取当前值
  - [x] SubTask 1.2: 添加 `weekly_streak`、`monthly_streak`、`quarterly_streak`、`daily_task_streak` 的 case 分支，从 `user_focus_stats` 表读取对应值
  - [x] SubTask 1.3: 添加 `special_condition` 的 case 分支（特殊成就通过独立方法检查，此处跳过即可）
  - [x] SubTask 1.4: 移除 `default: continue`，改为对未识别的 condition_type 记录警告日志

- [x] Task 2: 在路由层发布 `node_created` 事件
  - [x] SubTask 2.1: 在 `nodes.ts` 中导入 `appEventBus` 和事件 payload 类型
  - [x] SubTask 2.2: 在创建节点成功后发布 `node_created` 事件

- [x] Task 3: 扩展 `AchievementSubscriber` 监听更多事件
  - [x] SubTask 3.1: 添加对 `node_created` 事件的监听，触发 `updateCreationStats()`
  - [x] SubTask 3.2: 添加对 `review_completed` 事件的监听，触发 `updateMasteredStats()` 和 `addXp()`
  - [x] SubTask 3.3: 添加对 `focus_session_ended` 事件的特殊处理，在现有 `checkAchievements()` 之后追加 `checkSpecialAchievements()` 调用
  - [x] SubTask 3.4: 在 `destroy()` 方法中清理新增的事件订阅

- [x] Task 4: 在 `/api/auto-graph/save-nodes` 路由中添加成就触发
  - [x] SubTask 4.1: 在 `autoGraph.ts` 的 `/save-nodes` 路由成功保存节点后，调用 `achievementService.updateCreationStats()`
  - [x] SubTask 4.2: 确保批量保存时只触发一次成就检查（而非每个节点触发一次）

- [x] Task 5: 实现完美主义者和多面手特殊成就检查逻辑
  - [x] SubTask 5.1: 在 `achievementService.ts` 中实现 `checkPerfectionist()` 方法：查询当日所有计划任务，检查是否全部完成
  - [x] SubTask 5.2: 在 `achievementService.ts` 中实现 `checkMultitasker()` 方法：查询当日完成的任务数量和类型，检查是否达到5个不同类型
  - [x] SubTask 5.3: 在每日任务完成时（`updateDailyTask` 中任务状态变为 completed 时）调用这两个检查方法

- [x] Task 6: 确保周期性 Streak 成就定时检查
  - [x] SubTask 6.1: 在 `cronService.ts` 中添加每日定时任务，在周期结束时调用 `periodicTaskService.checkPeriodicStreak()`
  - [x] SubTask 6.2: 验证 `checkPeriodicStreak()` 中的 `weekly_streak`、`monthly_streak`、`quarterly_streak` 成就检查逻辑正确

- [x] Task 7: 将路由层直接调用迁移为事件驱动模式
  - [x] SubTask 7.1: 移除 `graphs.ts` 中创建图谱后的 `achievementService.updateCreationStats()` 直接调用（已有 `graph_created` 事件触发）
  - [x] SubTask 7.2: 移除 `nodes.ts` 中创建节点后的 `achievementService.updateCreationStats()` 直接调用（改为通过 `node_created` 事件触发）
  - [x] SubTask 7.3: 替换 `study.ts` 中更新卡片进度后的直接调用为 `review_completed` 事件发布
  - [x] SubTask 7.4: 移除 `templates.ts` 中从模板创建图谱后的 `achievementService.updateCreationStats()` 直接调用（已有 `graph_created` 事件触发）
  - [x] SubTask 7.5: 确保 `AchievementSubscriber` 中的事件处理逻辑完整覆盖上述移除的功能（包括 `addXp` 调用和 `onGraphCreated` 改为调用 `updateCreationStats()`）

- [x] Task 8: 类型检查与代码检查
  - [x] SubTask 8.1: 运行 `npm run check` 确保无类型错误
  - [x] SubTask 8.2: 运行 `npm run lint` 确保无代码规范问题

# Task Dependencies
- [Task 2] depends on [Task 1] — 需要先确保 `checkAndUnlockAchievements()` 能处理所有 condition_type
- [Task 3] depends on [Task 2] — 需要先有 `node_created` 事件发布，才能在 subscriber 中监听
- [Task 4] depends on [Task 2] — 需要先有 `node_created` 事件定义
- [Task 7] depends on [Task 3] — 需要先确保 subscriber 能处理所有事件，才能安全移除路由层直接调用
- [Task 5] 独立于其他任务
- [Task 6] 独立于其他任务
- [Task 8] depends on [Task 1-7] — 所有代码修改完成后执行检查
