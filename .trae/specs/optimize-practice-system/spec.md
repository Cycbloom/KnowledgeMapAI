# 练习系统结构优化 Spec

## Why

当前练习系统存在 SM2/FSRS 双算法并存、掌握度量纲不统一（0-100 vs 0-1）、reviewTaskService 创建/更新路径断裂、练习/测验答题不反馈 FSRS 调度、命名歧义（review 语义混淆）等多处不一致，导致维护困难、行为不可预测，需要系统性地梳理并统一结构。

## What Changes

- 统一掌握度（mastery_level）量纲为 0-1，修正数据库 schema 注释与代码中的不一致
- 修正 `fsrs_state` 类型不匹配问题（数据库 INTEGER vs 代码字符串 "New"）
- 修复 `reviewTaskService` 创建走 FSRS、更新走 SM2 的路径断裂，统一为 FSRS 路径
- 统一 `subtaskQuizIntegration` 中练习/测验答题结果反馈到 FSRS 调度
- 消除前端 `node_id` / `knowledge_point_id` 参数双轨，统一为 `knowledge_point_id`
- 消除 `card_type` vs `type` 字段名不一致
- 区分 "任务复盘"（task_reviews）与 "间隔重复复习"（spaced repetition review）的命名
- 为 `practice_sessions` / `quiz_sessions` 补充 API 路由
- 补充 FSRS 维度的统计 API
- 清理 SM2 遗留代码（标记废弃、移除无用导出）

## Impact

- Affected specs: 间隔重复调度、学习状态机、子任务-知识点同步、练习/测验会话
- Affected code:
  - `api/services/scheduler/reviewTaskService.ts` — 修复双写问题
  - `api/services/scheduler/subtaskQuizIntegration.ts` — 掌握度量纲统一 + FSRS 反馈
  - `api/services/scheduler/subtaskStateMachine.ts` — 掌握度量纲统一
  - `api/services/scheduler/subtaskKnowledgeSync.ts` — 掌握度量纲统一
  - `api/services/study/studyService.ts` — fsrs_state 类型修复
  - `api/services/study/spacedRepetitionBridge.ts` — SM2 清理
  - `api/services/scheduler/sm2Service.ts` — 废弃标记强化
  - `api/routes/study.ts` — 参数名统一
  - `api/routes/scheduler/reviewTasks.ts` — 统一 FSRS 路径
  - `src/services/api/study.ts` — 参数名统一
  - `src/services/api/review.ts` / `reviewTasks.ts` — 命名区分
  - `shared/types/scheduler.ts` — 类型清理
  - `shared/types/common.ts` — StudyCard 类型修正
  - `supabase/migrations/06_study_and_cards.sql` — fsrs_state 类型修正
  - `supabase/migrations/07_scheduler_tasks.sql` — mastery_level 注释修正

## ADDED Requirements

### Requirement: 统一掌握度量纲

系统 SHALL 在所有代码和数据库中使用 0-1 的小数表示掌握度（mastery_level），数据库字段 `task_subtasks.mastery_level` 的注释 SHALL 反映 0.00-1.00 范围。

#### Scenario: 代码中使用 0-1 量纲

- **WHEN** 任何服务读取或写入 `mastery_level`
- **THEN** 值的范围 SHALL 为 0-1 的小数

#### Scenario: 数据库注释一致

- **WHEN** 查看数据库 schema
- **THEN** `mastery_level` 字段注释 SHALL 标注为 "0.00-1.00"

### Requirement: 修复 fsrs_state 类型

系统 SHALL 在数据库中将 `study_cards.fsrs_state` 字段类型从 INTEGER 改为 TEXT，与代码中使用的 FSRS State 字符串枚举一致。

#### Scenario: 新卡片创建

- **WHEN** 创建新的 study_card
- **THEN** `fsrs_state` SHALL 存储为 FSRS State 枚举的字符串值（"New" | "Learning" | "Review" | "Relearning"）

#### Scenario: 现有数据兼容

- **WHEN** 读取已有 INTEGER 类型的 fsrs_state 值
- **THEN** 系统 SHALL 能正确处理数字到字符串的映射

### Requirement: 统一 reviewTaskService 为 FSRS 路径

系统 SHALL 将 `reviewTaskService.updateReviewTask` 从操作 `knowledge_review_tasks`（SM2）改为操作 `study_cards`（FSRS），与 `createFirstReviewTask` 的行为一致。

#### Scenario: 更新复习任务

- **WHEN** 调用 `reviewTaskService.updateReviewTask`
- **THEN** SHALL 使用 FSRS 算法更新 `study_cards` 表的 fsrs_* 字段

#### Scenario: 获取待复习任务

- **WHEN** 调用 `reviewTaskService.getPendingReviewTasks`
- **THEN** SHALL 从 `study_cards` 表查询到期卡片，而非 `knowledge_review_tasks`

### Requirement: 练习/测验答题反馈 FSRS 调度

系统 SHALL 在 `subtaskQuizIntegration.completePractice` 和 `completeQuiz` 完成时，将答题结果通过 FSRS 算法更新对应 study_card 的调度参数，而非仅更新 `last_reviewed` 和 `review_count`。

#### Scenario: 练习完成更新 FSRS

- **WHEN** 用户完成一次练习会话
- **THEN** 系统 SHALL 根据答题正确率计算 FSRS quality，并调用 `studyService.updateProgress` 更新卡片的 fsrs_* 字段

#### Scenario: 测验完成更新 FSRS

- **WHEN** 用户完成一次测验会话
- **THEN** 系统 SHALL 同样根据答题结果更新 FSRS 调度参数

### Requirement: 统一前端参数命名

系统 SHALL 在前端 API 客户端和后端路由中统一使用 `knowledge_point_id` / `knowledge_point_ids` 参数名，移除 `node_id` / `node_ids` 别名。

#### Scenario: 获取学习卡片

- **WHEN** 前端调用 `studyApi.getCards`
- **THEN** SHALL 只接受 `knowledge_point_id` 和 `knowledge_point_ids` 参数

#### Scenario: 后端路由参数

- **WHEN** 后端 `/study/cards` 路由接收请求
- **THEN** SHALL 只处理 `knowledge_point_id` 和 `knowledge_point_ids` 查询参数

### Requirement: 统一卡片类型字段名

系统 SHALL 在所有代码中使用 `card_type` 作为卡片类型字段名，AI 生成卡片返回的 `type` 字段 SHALL 在入库前映射为 `card_type`。

#### Scenario: AI 生成卡片

- **WHEN** AI 服务返回包含 `type` 字段的卡片数据
- **THEN** 系统 SHALL 在写入数据库前将 `type` 映射为 `card_type`

### Requirement: 区分 review 命名

系统 SHALL 明确区分"任务复盘"（task review）和"间隔重复复习"（spaced repetition review）的命名，避免歧义。

#### Scenario: 前端 API 模块命名

- **WHEN** 查看前端 API 服务模块
- **THEN** 任务复盘相关 SHALL 使用 `taskReview` 前缀，间隔重复复习相关 SHALL 使用 `spacedRepetition` 或 `studyReview` 前缀

### Requirement: 练习/测验会话 API 路由

系统 SHALL 为 `practice_sessions` 和 `quiz_sessions` 提供完整的 API 路由，包括创建会话、提交答题结果、完成会话等操作。

#### Scenario: 开始练习会话

- **WHEN** 前端调用 `POST /study/practice-sessions`
- **THEN** 系统 SHALL 创建练习会话并返回会话 ID 和卡片列表

#### Scenario: 完成练习会话

- **WHEN** 前端调用 `POST /study/practice-sessions/:id/complete`
- **THEN** 系统 SHALL 记录答题结果、更新掌握度、反馈 FSRS 调度

#### Scenario: 开始测验会话

- **WHEN** 前端调用 `POST /study/quiz-sessions`
- **THEN** 系统 SHALL 创建测验会话并返回会话 ID 和卡片列表

#### Scenario: 完成测验会话

- **WHEN** 前端调用 `POST /study/quiz-sessions/:id/complete`
- **THEN** 系统 SHALL 记录答题结果、计算分数、更新掌握度、反馈 FSRS 调度

### Requirement: FSRS 统计 API

系统 SHALL 提供 FSRS 维度的学习统计 API，替代当前仍读取 SM2 数据的统计接口。

#### Scenario: 获取 FSRS 统计

- **WHEN** 前端调用 `GET /study/stats`
- **THEN** 系统 SHALL 返回基于 `study_cards` 的统计，包括到期卡片数、各状态分布、平均记忆保持率等

### Requirement: SM2 遗留代码清理

系统 SHALL 将 `sm2Service` 和 `knowledge_review_tasks` 相关代码标记为废弃并逐步移除，所有功能统一到 FSRS 路径。

#### Scenario: SM2 服务废弃标记

- **WHEN** 查看 `sm2Service.ts`
- **THEN** 所有导出 SHALL 有明确的 `@deprecated` 注释，指向 FSRS 替代方案

#### Scenario: spacedRepetitionBridge 简化

- **WHEN** SM2 遗留数据迁移完成后
- **THEN** `spacedRepetitionBridge` SHALL 移除 SM2 队列合并逻辑，仅保留 FSRS 路径

## MODIFIED Requirements

### Requirement: reviewTaskService 统一 FSRS 路径

原 `reviewTaskService` 的 `updateReviewTask` 操作 `knowledge_review_tasks` 表（SM2），现修改为操作 `study_cards` 表（FSRS），与 `createFirstReviewTask` 行为一致。`getPendingReviewTasks` 改为从 `study_cards` 查询到期卡片。

### Requirement: subtaskQuizIntegration 掌握度与 FSRS 反馈

原 `subtaskQuizIntegration` 的掌握度计算使用 0-1 量纲但数据库注释为 0-100，现统一为 0-1。原 `updateCardReviewStats` 仅更新 `last_reviewed` 和 `review_count`，现增加调用 `studyService.updateProgress` 反馈 FSRS 调度。

### Requirement: studyService fsrs_state 处理

原 `studyService.dbCardToFSRS` 将 `fsrs_state` 当作数字枚举处理，现修改为处理字符串枚举（"New" | "Learning" | "Review" | "Relearning"），与数据库 TEXT 类型一致。

## REMOVED Requirements

### Requirement: SM2 复习任务查询

**Reason**: 统一到 FSRS 路径后，不再需要从 `knowledge_review_tasks` 表查询待复习任务
**Migration**: `getPendingReviewTasks` 改为从 `study_cards` 查询到期卡片；前端 `reviewTasksApi` 对应方法改为调用 FSRS 路径

### Requirement: node_id 参数别名

**Reason**: 与 `knowledge_point_id` 语义重复，增加维护成本
**Migration**: 前端和后端统一使用 `knowledge_point_id` / `knowledge_point_ids`
