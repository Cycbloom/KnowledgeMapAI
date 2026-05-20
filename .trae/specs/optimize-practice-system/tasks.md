# Tasks

- [x] Task 1: 修正 fsrs_state 数据库类型与代码一致性
  - [x] SubTask 1.1: 修改 `supabase/migrations/06_study_and_cards.sql` 中 `study_cards.fsrs_state` 字段类型从 INTEGER 改为 TEXT，添加 CHECK 约束
  - [x] SubTask 1.2: 修改 `studyService.ts` 中 `dbCardToFSRS` 方法，处理字符串枚举（"New"/"Learning"/"Review"/"Relearning"）到 FSRS State 的映射
  - [x] SubTask 1.3: 修改 `reviewTaskService.ts` 中 `createFirstReviewTask`，确保插入 fsrs_state 时使用字符串值
  - [x] SubTask 1.4: 修改 `shared/types/common.ts` 中 StudyCard 接口的 fsrs_state 字段类型为 string

- [x] Task 2: 统一掌握度（mastery_level）量纲为 0-1
  - [x] SubTask 2.1: 修改 `supabase/migrations/07_scheduler_tasks.sql` 中 `task_subtasks.mastery_level` 注释，从 "0.00-100.00" 改为 "0.00-1.00"
  - [x] SubTask 2.2: 审查 `subtaskStateMachine.ts`、`subtaskQuizIntegration.ts`、`subtaskKnowledgeSync.ts` 中所有 mastery_level 使用，确认均为 0-1 量纲，修正不一致处
  - [x] SubTask 2.3: 审查 `autoTaskGenerator.ts` 中 mastery_level 初始值设置，确认使用 0-1 量纲

- [x] Task 3: 修复 reviewTaskService 双写问题，统一为 FSRS 路径
  - [x] SubTask 3.1: 重写 `reviewTaskService.updateReviewTask`，改为操作 `study_cards` 表，使用 FSRS 算法更新 fsrs_* 字段
  - [x] SubTask 3.2: 重写 `reviewTaskService.getPendingReviewTasks`，改为从 `study_cards` 查询到期卡片（next_review <= now），返回格式兼容现有前端
  - [x] SubTask 3.3: 重写 `reviewTaskService.getReviewTaskStats`，改为基于 `study_cards` 的 FSRS 统计
  - [x] SubTask 3.4: 更新 `api/routes/scheduler/reviewTasks.ts` 路由，适配新的 service 方法签名

- [x] Task 4: 练习/测验答题反馈 FSRS 调度
  - [x] SubTask 4.1: 修改 `subtaskQuizIntegration.completePractice`，在完成练习后根据正确率计算 FSRS quality，调用 `studyService.updateProgress` 更新每张卡片的 fsrs_* 字段
  - [x] SubTask 4.2: 修改 `subtaskQuizIntegration.completeQuiz`，同样增加 FSRS 反馈逻辑
  - [x] SubTask 4.3: 重构 `updateCardReviewStats` 方法，移除仅更新 last_reviewed/review_count 的简陋实现，统一走 FSRS 路径

- [x] Task 5: 统一前端参数命名（移除 node_id 别名）
  - [x] SubTask 5.1: 修改 `src/services/api/study.ts`，移除 `node_id`/`node_ids` 参数，统一使用 `knowledge_point_id`/`knowledge_point_ids`
  - [x] SubTask 5.2: 修改 `api/routes/study.ts`，移除 `node_id`/`node_ids` 查询参数处理，统一使用 `knowledge_point_id`/`knowledge_point_ids`
  - [x] SubTask 5.3: 搜索前端所有使用 `node_id` 调用 studyApi 的地方，改为 `knowledge_point_id`

- [x] Task 6: 统一卡片类型字段名（card_type vs type）
  - [x] SubTask 6.1: 审查 AI 生成卡片的代码路径，确保返回数据在入库前将 `type` 映射为 `card_type`
  - [x] SubTask 6.2: 搜索代码中所有 `card.type || card.card_type` 兼容写法，统一为 `card.card_type`
  - [x] SubTask 6.3: 更新相关类型定义，确保接口中只有 `card_type` 字段

- [x] Task 7: 区分 review 命名，消除语义歧义
  - [x] SubTask 7.1: 将前端 `src/services/api/review.ts`（任务复盘）的导出重命名为 `taskReviewApi`
  - [x] SubTask 7.2: 将前端 `src/services/api/modules/scheduler/reviewTasks.ts`（间隔重复复习）的导出重命名为 `studyReviewApi` 或 `spacedRepetitionApi`
  - [x] SubTask 7.3: 更新所有引用这两个 API 模块的前端代码

- [x] Task 8: 补充练习/测验会话 API 路由
  - [x] SubTask 8.1: 创建 `api/routes/study/practiceSessions.ts` 路由文件，实现 POST（创建）、POST /:id/complete（完成）端点
  - [x] SubTask 8.2: 创建 `api/routes/study/quizSessions.ts` 路由文件，实现 POST（创建）、POST /:id/complete（完成）端点
  - [x] SubTask 8.3: 在路由注册入口添加新路由
  - [x] SubTask 8.4: 创建前端 API 客户端 `src/services/api/practiceSession.ts` 和 `quizSession.ts`

- [x] Task 9: 补充 FSRS 统计 API
  - [x] SubTask 9.1: 在 `studyService.ts` 中添加 `getStudyStats` 方法，基于 `study_cards` 计算到期卡片数、各 FSRS 状态分布、平均记忆保持率等
  - [x] SubTask 9.2: 在 `api/routes/study.ts` 中添加 `GET /study/stats` 端点
  - [x] SubTask 9.3: 在前端 API 客户端和 React Query hooks 中添加对应的查询方法

- [x] Task 10: SM2 遗留代码清理
  - [x] SubTask 10.1: 强化 `sm2Service.ts` 中所有导出的 `@deprecated` 标注，添加替代方案说明
  - [x] SubTask 10.2: 简化 `spacedRepetitionBridge.ts`，移除 SM2 队列合并逻辑，仅保留 FSRS 路径
  - [x] SubTask 10.3: 清理 `shared/types/scheduler.ts` 中已废弃的 SM2 相关类型（ReviewTask、PendingReviewTask 等），添加更明确的废弃注释
  - [x] SubTask 10.4: 清理前端 `ReviewTaskCard.tsx` 中 SM2/FSRS 双模式显示逻辑，统一为 FSRS 模式

# Task Dependencies

- [Task 3] depends on [Task 1] — reviewTaskService 统一 FSRS 路径需要 fsrs_state 类型先修正
- [Task 4] depends on [Task 1] — 练习/测验反馈 FSRS 需要 fsrs_state 类型一致
- [Task 4] depends on [Task 2] — 掌握度量纲统一后才能正确计算 FSRS quality
- [Task 8] depends on [Task 4] — 会话 API 路由需要答题反馈 FSRS 逻辑先就绪
- [Task 9] depends on [Task 3] — FSRS 统计 API 需要 reviewTaskService 先统一到 FSRS
- [Task 10] depends on [Task 3] — SM2 清理需要 reviewTaskService 先完成 FSRS 迁移
- [Task 1] 和 [Task 2] 和 [Task 5] 和 [Task 6] 和 [Task 7] 可并行执行
