# SM2 → FSRS 迁移 Spec

## Why

系统当前有两套间隔重复算法并行运行：`knowledge_review_tasks`（SM2）和 `study_cards`（FSRS，基于 `ts-fsrs` 库）。FSRS 相比 SM2 有明确的学术优势（复习次数减少 20-30%，个性化自适应），且 FSRS 的 `studyService.ts` 已在 `api/services/study/` 中完整实现。本轮切换默认算法为 FSRS，SM2 降级为向后兼容路径。

## What Changes

- **新复习任务默认走 FSRS**：`reviewTaskService.createFirstReviewTask()` 改为创建 `study_cards` 而非 `knowledge_review_tasks`
- **复习完成路由到 FSRS**：`spacedRepetitionBridge.processReviewResult()` 默认使用 FSRS 更新（`studyService.updateProgress()`）
- **UI 组件支持 FSRS 状态显示**：`ReviewTaskCard` 增加 FSRS 的状态/稳定性/难度字段展示，SM2 字段保留向后兼容
- **类型定义扩展**：`shared/types` 新增 `FSRSReviewTask` 类型，标记 `ReviewTask` / `PendingReviewTask` 为 `@deprecated`
- **SM2 服务标记废弃**：`sm2Service.ts` 添加 `@deprecated` 注释，`reviewTaskService.ts` 添加废弃说明

## Impact

- Affected specs: 无
- Affected code:
  - `api/services/scheduler/reviewTaskService.ts` — 默认创建路径切换
  - `api/services/study/spacedRepetitionBridge.ts` — 复习路由切换
  - `api/services/scheduler/sm2Service.ts` — 废弃标记
  - `src/components/Scheduler/ReviewTaskCard.tsx` — UI 升级
  - `shared/types/scheduler.ts` — 类型扩展
- **BREAKING**: `ReviewTask` 接口字段从 SM2（`interval_days`, `ease_factor`, `repetitions`）切换到 FSRS（`stability`, `difficulty`, `state`），旧调用方需适配

## ADDED Requirements

### Requirement: 新复习任务走 FSRS
系统 SHALL 在创建新知识点的首次复习任务时，默认写入 `study_cards` 表而非 `knowledge_review_tasks` 表。

#### Scenario: 首次复习使用 FSRS
- **WHEN** 用户对新知识点发起首次复习
- **THEN** 系统在 `study_cards` 表中创建一条 `card_type = 'review'` 的记录，FSRS 状态初始化为 New

### Requirement: 复习完成路由到 FSRS
系统 SHALL 在用户完成复习后，默认调用 `studyService.updateProgress()`（FSRS）更新卡片状态，而非 `sm2Service.calculateNextReview()`。

#### Scenario: 复习后 FSRS 更新
- **WHEN** 用户完成一次复习并评分
- **THEN** FSRS 引擎重新计算 `stability`、`difficulty`、`next_review`，写入 `study_cards` 表

### Requirement: UI 支持 FSRS 状态显示
`ReviewTaskCard` 组件 SHALL 同时支持 FSRS 和 SM2 两种数据格式，优先展示 FSRS 状态。

#### Scenario: FSRS 卡片展示
- **WHEN** 卡片来自 `study_cards` 表（FSRS）
- **THEN** UI 显示"稳定性: X"、"难度: Y"、"状态: New/Learning/Review/Relearning"

#### Scenario: 遗留 SM2 卡片兼容
- **WHEN** 卡片来自 `knowledge_review_tasks` 表（SM2）
- **THEN** UI 降级显示原有"间隔: X天"、"EF: Y"

### Requirement: SM2 服务标记废弃
`sm2Service.ts` SHALL 添加文件级 `@deprecated` JSDoc 注释，说明推荐使用 `studyService.ts`（FSRS）。

## MODIFIED Requirements

### Requirement: `ReviewTask` 类型扩展
`shared/types/scheduler.ts` 中的 `ReviewTask` 接口 SHALL 新增可选 FSRS 字段（`fsrs_stability`, `fsrs_difficulty`, `fsrs_state`, `algorithm`），保留原有 SM2 字段作为 optional。

## REMOVED Requirements

无。