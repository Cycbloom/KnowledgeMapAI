# 成就系统架构重构 Spec

## Why

当前成就系统存在三个核心架构问题：**1)** `checkAndUnlockAchievements()` 用巨型 switch 语句硬编码 15 种 condition_type，每新增一种成就类型都要修改此方法，违反开闭原则；**2)** 每次事件触发都全量扫描所有成就定义并逐条查询数据库获取当前值，造成大量冗余 DB 查询（如 `streak_days` 每次都查 focus_sessions 全表）；**3)** 事件与成就的映射关系隐含在 Subscriber 的代码逻辑中，无法从数据层面配置"哪些事件触发哪些成就检查"。行业通行做法是采用**策略模式 + 触发映射 + 增量进度**三件套，实现数据驱动的成就引擎。

## 行业通行做法分析

### 1. 策略模式（Strategy Pattern）— 消除 switch 硬编码

行业核心共识：将每种 condition_type 的"获取当前值"逻辑封装为独立的策略类，通过注册表动态查找，而非 switch 分支。

**当前问题**：`checkAndUnlockAchievements()` 中 15 个 case 分支，每个分支内嵌 DB 查询逻辑，方法体超过 150 行。新增 condition_type 必须修改此方法。

**行业做法**：
```
interface AchievementConditionEvaluator {
  conditionType: string;                    // 如 "graphs_created"
  getCurrentValue(userId: string): Promise<number>;  // 获取当前值
  relevantEvents: AppEventType[];           // 关联的事件类型
}
```
每个 Evaluator 是一个独立类，只负责一种 condition_type 的值获取。新增成就类型只需新增一个 Evaluator 类并注册，无需修改任何已有代码。

### 2. 触发映射（Trigger Mapping）— 事件与成就的精确关联

**当前问题**：`AchievementSubscriber` 对所有事件都调用 `checkAndUnlockAchievements()`，该方法遍历全部成就定义。一次 `node_created` 事件会触发对 `focus_sessions`、`cards_mastered`、`streak_days` 等完全不相关成就的检查和 DB 查询。

**行业做法**：在成就定义中增加 `trigger_events` 字段，标记哪些事件可能触发该成就。事件到达时，只检查关联了该事件的成就：
```
achievements 表增加:
  trigger_events TEXT[] DEFAULT '{}'  -- 如 '{"graph_created", "node_created"}'
```
事件到达 → 查找 `trigger_events` 包含该事件的成就 → 只检查这些成就。这比全量扫描高效得多。

### 3. 增量进度（Incremental Progress）— 避免重复全量查询

**当前问题**：每次检查成就都从数据库全量计算当前值。例如 `nodes_created` 每次都 `SELECT COUNT(*) FROM graph_nodes JOIN knowledge_graphs`，`streak_days` 每次都扫描 focus_sessions 全表。

**行业做法**：在 `user_achievements` 表中维护增量进度值，事件到达时只做增量更新：
```
user_achievements.progress 存储当前进度值（如 nodes_created=45）
事件到达 → progress += delta → 直接与 condition_value 比较
```
全量重算仅作为定期校准（如每日定时任务），而非每次事件触发时执行。

### 4. 幂等解锁（Idempotent Unlock）— 当前已部分实现

当前 `checkAndUnlock()` 已使用 `UNIQUE(user_id, achievement_id)` 约束保证幂等，这是正确的。但 `checkAndUnlockAchievements()` 中的 insert 也需要同样的幂等保证（当前依赖查询已解锁列表来去重，存在竞态条件风险）。

## What Changes

### 核心重构：策略模式成就引擎
- 创建 `AchievementConditionEvaluator` 接口和注册表
- 为每种 condition_type 实现独立的 Evaluator 类
- 重构 `checkAndUnlockAchievements()` 使用 Evaluator 注册表替代 switch

### 数据层：触发映射 + 增量进度
- **BREAKING** `achievements` 表增加 `trigger_events TEXT[]` 字段
- **BREAKING** `user_achievements.progress` 语义从"百分比(0-100)"改为"当前实际值"
- 事件到达时只检查 trigger_events 包含该事件的成就
- 事件到达时对 progress 做增量更新而非全量重算

### 架构简化：统一成就检查入口
- 移除 `checkAndUnlock()` 和 `checkAndUnlockAchievements()` 两套方法
- 统一为 `evaluateAchievements(userId, eventType)` 单一入口
- `AchievementSubscriber` 简化为：事件 → `evaluateAchievements(userId, eventType)`

## Impact

- Affected specs: 游戏化系统、事件系统、数据库 Schema
- Affected code:
  - `api/services/achievementService.ts` — 核心重构，拆分为引擎 + Evaluator 注册表
  - `api/services/achievements/` — 新目录，存放各 condition_type 的 Evaluator
  - `api/services/core/subscribers/achievementSubscriber.ts` — 简化
  - `supabase/migrations/09_gamification.sql` — Schema 变更
  - `supabase/migrations/51_seed_achievements.sql` — 增加 trigger_events 数据
  - `shared/types/scheduler.ts` — 类型定义更新

## ADDED Requirements

### Requirement: 策略模式成就条件评估器
系统 SHALL 为每种 condition_type 提供独立的 `AchievementConditionEvaluator` 实现，通过注册表动态查找，而非 switch 硬编码。

#### Scenario: 新增成就类型无需修改已有代码
- **WHEN** 开发者需要新增一种 condition_type（如 `ai_queries_made`）
- **THEN** 只需创建一个新的 Evaluator 类并注册到注册表
- **AND** 无需修改 `achievementService.ts` 中的任何代码

#### Scenario: Evaluator 提供当前值和关联事件
- **WHEN** 成就引擎需要评估某个成就
- **THEN** 通过 Evaluator 的 `getCurrentValue(userId)` 获取当前值
- **AND** 通过 Evaluator 的 `relevantEvents` 知道哪些事件可能影响该成就

### Requirement: 触发映射精确关联
系统 SHALL 在成就定义中存储 `trigger_events` 字段，事件到达时只检查关联了该事件的成就。

#### Scenario: node_created 事件只触发创建类成就
- **WHEN** `node_created` 事件到达
- **THEN** 只检查 `trigger_events` 包含 `node_created` 的成就（如 `nodes_created`、`graphs_created`）
- **AND** 不检查 `focus_sessions`、`cards_mastered` 等不相关成就

#### Scenario: 无 trigger_events 的成就通过定时任务检查
- **WHEN** 成就的 `trigger_events` 为空
- **THEN** 该成就通过每日定时校准任务检查

### Requirement: 增量进度更新
系统 SHALL 在事件到达时对 `user_achievements.progress` 做增量更新，而非全量重算。

#### Scenario: 创建节点后增量更新进度
- **WHEN** 用户创建 1 个节点
- **THEN** `nodes_created` 类型成就的 progress 从 45 增加到 46
- **AND** 不执行 `SELECT COUNT(*) FROM graph_nodes` 全量查询

#### Scenario: 每日校准修正增量误差
- **WHEN** 每日定时校准任务运行
- **THEN** 对所有成就的 progress 做全量重算，修正增量更新可能产生的误差

### Requirement: 幂等成就解锁
系统 SHALL 使用数据库唯一约束保证成就解锁的幂等性，避免竞态条件导致重复解锁。

#### Scenario: 并发事件触发同一成就
- **WHEN** 两个并发事件同时触发同一成就的检查
- **THEN** 只有第一个成功插入，第二个因唯一约束冲突被忽略
- **AND** 不产生重复解锁或重复 XP 奖励

## MODIFIED Requirements

### Requirement: AchievementSubscriber 简化
`AchievementSubscriber` SHALL 只负责将事件转发给成就引擎的 `evaluateAchievements(userId, eventType)` 方法，不再包含任何成就检查的业务逻辑。

### Requirement: user_achievements.progress 语义
`user_achievements.progress` SHALL 存储当前实际值（如 45 个节点），而非百分比（0-100）。前端进度百分比由 `progress / condition_value * 100` 计算。

## REMOVED Requirements

### Requirement: checkAndUnlock() 和 checkAndUnlockAchievements() 两套方法
**Reason**: 两套方法逻辑不同、覆盖范围不同，造成混淆。统一为 `evaluateAchievements()` 单一入口。
**Migration**: 所有调用点改为 `evaluateAchievements(userId, eventType)`

### Requirement: switch 硬编码 condition_type
**Reason**: 违反开闭原则，新增成就类型必须修改 switch。改为策略模式注册表。
**Migration**: 每个 case 分支提取为独立的 Evaluator 类
