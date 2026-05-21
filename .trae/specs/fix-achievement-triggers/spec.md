# 成就系统与用户操作联动修复 Spec

## Why

成就系统存在大量与用户操作断联的问题：AI 生成知识图谱保存节点后不触发成就记录、`checkAndUnlockAchievements()` 仅覆盖 15 种 condition_type 中的 6 种、特殊成就（夜猫子/早起鸟/周末战士/完美主义者/多面手）从未被触发、`node_created`/`edge_created` 事件已定义但从未发布、`review_completed` 事件未被成就订阅者监听、周期性 streak 成就的检查方法从未被调用。这些问题导致用户完成操作后成就系统无响应，严重影响游戏化体验。

## What Changes

### 核心修复：补全成就触发链路
- 在 `/api/auto-graph/save-nodes` 路由中添加 `achievementService.updateCreationStats()` 调用
- 扩展 `checkAndUnlockAchievements()` 覆盖所有 15 种 condition_type
- 在 `AchievementSubscriber` 中增加对 `node_created`、`review_completed` 事件的监听
- 在 `graphNodeService` 中发布 `node_created` / `edge_created` 事件（当前已定义但从未发布）
- 在专注会话结束时调用 `checkSpecialAchievements()`
- 实现 `perfectionist`（完美主义者）和 `multitasker`（多面手）特殊成就的检查逻辑
- 在定时任务中调用 `checkPeriodicStreak()` 以触发周期性 streak 成就

### 架构改进：统一成就检查入口
- 统一两套成就检查机制：`checkAndUnlock()`（按类型+值）和 `checkAndUnlockAchievements()`（全量遍历）合并为一个完整覆盖的入口
- 将路由层直接调用 `achievementService` 的模式迁移为事件驱动模式，通过 `AchievementSubscriber` 统一处理

## Impact

- Affected specs: 游戏化系统、事件系统、AI 图谱生成流程
- Affected code:
  - `api/services/achievementService.ts` — 扩展 `checkAndUnlockAchievements()` 覆盖所有 condition_type
  - `api/services/core/subscribers/achievementSubscriber.ts` — 增加事件监听
  - `api/routes/autoGraph.ts` — 添加成就触发调用
  - `api/services/graph/graphNodeService.ts` — 发布 `node_created` / `edge_created` 事件
  - `api/services/scheduler/periodicTaskService.ts` — 确保 `checkPeriodicStreak()` 被定时调用
  - `api/services/scheduler/core/cronService.ts` — 添加周期性 streak 检查定时任务

## ADDED Requirements

### Requirement: AI 图谱保存节点触发成就
系统 SHALL 在用户通过 AI 生成知识图谱并保存节点时，正确触发 `graphs_created` 和 `nodes_created` 类型的成就检查。

#### Scenario: AI 生成图谱保存节点后成就更新
- **WHEN** 用户通过 `/api/auto-graph/save-nodes` 保存 AI 生成的节点
- **THEN** 系统调用 `achievementService.updateCreationStats()` 更新创建统计
- **AND** 对应的 `graphs_created` 和 `nodes_created` 成就被正确检查和解锁

### Requirement: 全量成就检查覆盖
系统 SHALL `checkAndUnlockAchievements()` 方法覆盖所有定义的 condition_type，包括：`streak_days`、`focus_minutes`、`cards_mastered`、`graphs_created`、`nodes_created`、`special_condition`、`weekly_streak`、`monthly_streak`、`quarterly_streak`、`daily_task_streak`。

#### Scenario: 所有 condition_type 均可被检查
- **WHEN** 调用 `checkAndUnlockAchievements(userId)`
- **THEN** 所有 15 种 condition_type 的成就均被检查
- **AND** 不再出现 `default: continue` 跳过未处理的 condition_type

### Requirement: 特殊成就自动触发
系统 SHALL 在专注会话结束时自动检查特殊成就（夜猫子、早起鸟、周末战士），并在每日任务完成时检查完美主义者和多面手成就。

#### Scenario: 专注会话结束检查特殊成就
- **WHEN** 专注会话结束事件触发
- **THEN** 系统调用 `checkSpecialAchievements()` 检查夜猫子/早起鸟/周末战士成就

#### Scenario: 每日任务完成检查完美主义者成就
- **WHEN** 用户一天内完成所有计划任务
- **THEN** 系统解锁"完美主义者"成就

#### Scenario: 一天内完成5个不同任务检查多面手成就
- **WHEN** 用户一天内完成5个不同类型的任务
- **THEN** 系统解锁"多面手"成就

### Requirement: 节点创建事件发布
系统 SHALL 在 `graphNodeService` 创建节点和边时发布 `node_created` 和 `edge_created` 事件。

#### Scenario: 创建节点时发布事件
- **WHEN** 通过 `graphNodeService` 创建新节点
- **THEN** 系统发布 `node_created` 事件，包含 `nodeId`、`graphId`、`userId`

#### Scenario: 创建边时发布事件
- **WHEN** 通过 `graphNodeService` 创建新边
- **THEN** 系统发布 `edge_created` 事件，包含 `edgeId`、`graphId`、`userId`

### Requirement: AchievementSubscriber 监听关键事件
系统 SHALL `AchievementSubscriber` 监听所有与成就相关的用户操作事件。

#### Scenario: 监听 node_created 事件
- **WHEN** `node_created` 事件发布
- **THEN** `AchievementSubscriber` 接收事件并触发 `updateCreationStats()` 成就检查

#### Scenario: 监听 review_completed 事件
- **WHEN** `review_completed` 事件发布
- **THEN** `AchievementSubscriber` 接收事件并触发 `updateMasteredStats()` 成就检查

### Requirement: 周期性 Streak 成就定时检查
系统 SHALL 在定时任务中调用 `checkPeriodicStreak()` 以检查和更新 `weekly_streak`、`monthly_streak`、`quarterly_streak` 成就。

#### Scenario: 周期结束时检查 streak 成就
- **WHEN** 一个周期（周/月/季度）结束
- **THEN** 系统调用 `checkPeriodicStreak()` 检查用户是否完成所有周期任务
- **AND** 根据结果更新 streak 值并检查对应成就

### Requirement: 统一成就检查入口
系统 SHALL 使用事件驱动模式作为成就触发的统一入口，路由层不再直接调用 `achievementService` 的更新方法。

#### Scenario: 路由层通过事件触发成就
- **WHEN** 路由层执行用户操作（创建图谱、创建节点、学习卡片等）
- **THEN** 通过事件总线发布事件，由 `AchievementSubscriber` 统一处理成就检查
- **AND** 路由层不再直接调用 `achievementService.updateCreationStats()` 等方法

## MODIFIED Requirements

### Requirement: AchievementSubscriber 事件监听范围
`AchievementSubscriber` SHALL 监听以下事件：`task_completed`、`focus_session_ended`、`graph_created`、`node_created`、`review_completed`、`study_session_completed`。

### Requirement: checkAndUnlockAchievements 全量覆盖
`checkAndUnlockAchievements()` SHALL 处理所有定义的 condition_type，不再跳过任何类型。对于需要查询数据库的 condition_type（如 `graphs_created`、`nodes_created`、`cards_mastered`），方法内直接查询数据库获取当前值。

## REMOVED Requirements

### Requirement: 路由层直接调用 achievementService
**Reason**: 路由层直接调用成就服务导致触发逻辑分散、容易遗漏，统一改为事件驱动模式
**Migration**: 路由层改为发布事件，由 `AchievementSubscriber` 统一处理
