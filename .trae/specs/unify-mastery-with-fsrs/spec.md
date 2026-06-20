# 统一掌握度体系：用 FSRS 参数驱动 mastery_level 计算

## Why

当前系统存在两套独立的掌握度指标：`mastery_level`（启发式累加，缺乏数学基础）和 `fsrs_retrievability`（FSRS 记忆模型，有严格数学基础）。两者各自独立运行，图谱节点着色用 retrievability，但状态机/进度条用 mastery_level，可能给出矛盾信号。统一掌握度体系可消除这种断裂，使所有掌握度判断具有概率语义。

## What Changes

- 将 `knowledge_points.mastery_level` 的计算逻辑从启发式增量累加改为基于 FSRS retrievability 的聚合值
- 将 `task_subtasks.mastery_level` 同步改为 FSRS 驱动
- 移除 `progressSyncService` 中的启发式增量计算函数（`calculateMasteryIncrement`、`calculateCompletionMasteryIncrement`）
- 移除 `subtaskKnowledgeSyncService.calculateKnowledgePointMastery` 中的启发式加权逻辑
- 统一 `masteryDecayService` 的衰减计算，直接使用 FSRS retrievability 而非自行计算指数衰减
- 保留 `masteryThresholds` 的阈值体系，但赋予其概率语义（如 0.7 = "有 70% 概率能回忆起来"）
- 为没有 study_cards 的知识点提供基于学习状态的初始 mastery_level 估算

## Impact

- Affected specs: study 模块、scheduler 模块、graph 节点状态展示
- Affected code:
  - `api/services/study/studyService.ts` — mastery_level 计算逻辑
  - `api/services/scheduler/progressSyncService.ts` — 启发式增量计算
  - `api/services/scheduler/subtaskKnowledgeSyncService.ts` — 知识点掌握度同步
  - `api/services/scheduler/masteryDecayService.ts` — 掌握度衰减
  - `api/services/graph/graphService.ts` — 图谱节点状态（getGraphNodeStatus）
  - `shared/constants/masteryThresholds.ts` — 阈值定义
  - `electron/db/schema.ts` — study_cards / knowledge_points 表结构
  - 前端组件中使用 mastery_level 的所有位置

## ADDED Requirements

### Requirement: FSRS-driven mastery_level calculation

系统 SHALL 基于 FSRS retrievability 计算 knowledge_points 的 mastery_level，而非使用启发式增量累加。

#### Scenario: 知识点有 study_cards 时的 mastery_level 计算
- **WHEN** 知识点关联了一个或多个 study_cards
- **THEN** mastery_level = 该知识点所有 study_cards 的 fsrs_retrievability 的加权平均值（权重为 stability，稳定性越高的卡片权重越大）

#### Scenario: 知识点无 study_cards 但有学习记录
- **WHEN** 知识点没有 study_cards，但有学习时长/任务完成记录
- **THEN** mastery_level 基于学习状态（learning_status）提供初始估算值：new=0.1, learning=0.2, review=0.35, practice=0.55, quiz=0.75, mastery=0.9

#### Scenario: 知识点完全无学习记录
- **WHEN** 知识点既没有 study_cards 也没有学习记录
- **THEN** mastery_level = 0

### Requirement: mastery_level 与 FSRS retrievability 自动同步

系统 SHALL 在每次 FSRS 复习后自动更新对应知识点的 mastery_level。

#### Scenario: 复习后 mastery_level 更新
- **WHEN** 用户完成一次 study_card 的复习
- **THEN** 系统更新该 study_card 的 FSRS 参数，并重新计算关联知识点的 mastery_level

#### Scenario: 时间衰减自动反映
- **WHEN** 知识点的 study_cards 随时间推移 retrievability 自然衰减
- **THEN** mastery_level 在下次查询时反映最新的 retrievability 聚合值（无需定时任务）

### Requirement: task_subtasks.mastery_level 与知识点同步

系统 SHALL 将 task_subtasks 的 mastery_level 与关联知识点的 mastery_level 保持同步。

#### Scenario: 子任务掌握度同步
- **WHEN** 知识点的 mastery_level 因复习更新
- **THEN** 关联该知识点的所有 subtask 的 mastery_level 同步更新

### Requirement: 图谱节点状态统一

系统 SHALL 确保图谱节点着色和状态判断使用统一的 mastery_level 值。

#### Scenario: 节点着色一致性
- **WHEN** 图谱节点展示掌握度状态
- **THEN** 着色逻辑基于 mastery_level（即 FSRS retrievability 聚合值），与进度条/状态机使用同一数据源

## MODIFIED Requirements

### Requirement: mastery_level 计算方式

**原**：mastery_level 通过启发式增量累加计算（学习时长线性累加 + 任务完成质量累加 + 学习状态加权），衰减通过 masteryDecayService 独立计算。

**新**：mastery_level 基于 FSRS retrievability 聚合计算，具有概率语义。衰减由 FSRS retrievability 的时间衰减自然体现，无需独立的衰减服务。

### Requirement: masteryDecayService 职责

**原**：masteryDecayService 独立计算掌握度衰减，使用 `mastery * e^(-days/stability)` 公式。

**新**：masteryDecayService 的衰减计算改为直接查询 FSRS retrievability，不再自行计算指数衰减。保留该服务作为查询接口，但内部实现委托给 FSRS 参数。

## REMOVED Requirements

### Requirement: 启发式 mastery_level 增量计算
**Reason**：被 FSRS-driven 计算替代，启发式增量缺乏数学基础且与 FSRS retrievability 矛盾
**Migration**：
- `progressSyncService.calculateMasteryIncrement()` → 改为触发 FSRS 参数更新后重新聚合
- `progressSyncService.calculateCompletionMasteryIncrement()` → 同上
- `subtaskKnowledgeSyncService.calculateKnowledgePointMastery()` → 改为基于 FSRS retrievability 聚合
- `handlePreviewMode()` 中硬编码的 0.1 → 改为基于学习状态的初始估算
