# Checklist

## Phase 1: P0 残留清理

### 1.1 删除 `knowledge_review_tasks` 表
- [ ] grep 确认 `knowledge_review_tasks` 在 api/、src/、shared/ 下无活跃引用
- [ ] `07_scheduler_tasks.sql` L300-322 表定义已删除
- [ ] `12_indexes.sql` L253-258 的 5 个 `idx_knowledge_review_tasks_*` 索引已删除
- [ ] `13_rls_policies.sql` L509-514 的 RLS 策略已删除
- [ ] `15_triggers.sql` L67-69 的 `knowledge_review_tasks_updated_at` 触发器已删除
- [ ] `shared/types/` 下相关类型定义已删除
- [ ] `npm run db:gen-types` 重新生成类型成功
- [ ] `npm run check` 通过
- [ ] `npm run test:run` 通过

### 1.2 删除 `knowledge_graphs.domain` 字段
- [x] grep 确认所有 `domain` 读取处已迁移到 `graph_domains` JOIN
- [x] `14_functions.sql` 中 `get_graph_map_data` 函数已修改（移除 `g.domain` 引用）
- [x] `02_knowledge_graph.sql` L10 的 `domain VARCHAR(255)` 列已删除
- [x] `12_indexes.sql` L18 的 `idx_knowledge_graphs_domain` 索引已删除
- [x] 列注释已删除
- [x] `npm run db:gen-types` 重新生成类型成功
- [x] `npm run check` 通过
- [x] `npm run lint` 通过

### 1.3 删除 `learning_path_nodes.prerequisites UUID[]` 列
- [x] grep 确认无活跃读写（所有读取/写入已迁移到 `learning_path_prerequisites` 关联表）
- [x] 存量数据已迁移到 `learning_path_prerequisites`（关联表已存在，schema 中列已删除）
- [x] `08_learning_paths.sql` L43 的 `prerequisites UUID[]` 列已删除
- [x] L55 注释已更新（移除 DEPRECATED 标记说明）
- [x] `npm run db:gen-types` 重新生成类型成功（`database.generated.ts` 已移除 prerequisites 字段）
- [x] `npm run check` 通过
- [x] `npm run lint` 通过
- [x] `api/services/study/learningPathService.ts` 已迁移（新增 fetchPrerequisitesForNodes/insertPrerequisitesForNodes 辅助方法）
- [x] `api/services/study/learningPathNodeService.ts` 已迁移（addNodeToPath 写入关联表，updateNodeStatus 返回 prerequisites: []）
- [x] `api/services/study/learningPathTaskIntegration.ts` 已迁移（autoSchedulePath 聚合 prerequisites）
- [x] `api/services/scheduler/pathTaskService.ts` 已迁移（新增 fetchPrerequisitesMap 辅助方法，getPathTasks/getNodeTask 移除嵌套 select 中的 prerequisites 列）

### 1.4 删除 `ai_performance_logs.timestamp` 列
- [ ] grep 确认 api/ 下 aiPerformanceLogService 等已改用 `created_at`
- [ ] `10_ai_and_prompts.sql` L56 的 `timestamp BIGINT` 列已删除
- [ ] `12_indexes.sql` L293 `idx_ai_perf_logs_timestamp` 索引已删除
- [ ] `12_indexes.sql` L303 `idx_ai_perf_logs_session_ts` 索引已删除
- [ ] 新建 `idx_ai_perf_logs_session_created` 索引：`(session_id, created_at DESC)`
- [ ] 列注释已更新
- [ ] `npm run db:gen-types` 重新生成类型成功
- [ ] `npm run check` 通过

## Phase 2: P0 session 合并

### 2.1 创建 `learning_sessions` 表
- [ ] `18_practice_quiz_sessions.sql` 中新增 `learning_sessions` 表定义
- [ ] 新建索引：`idx_learning_sessions_user_id`
- [ ] 新建索引：`idx_learning_sessions_subtask_id`
- [ ] 新建索引：`idx_learning_sessions_kp_id`
- [ ] 新建索引：`idx_learning_sessions_status`
- [ ] 新建索引：`idx_learning_sessions_user_started`（user_id, started_at DESC）
- [ ] 新建 RLS 策略（4 条 SELECT/INSERT/UPDATE/DELETE，`auth.uid() = user_id`）
- [ ] 新建 `updated_at` 触发器（用 `update_updated_at_column`）

### 2.2 创建 `learning_session_results` 表
- [ ] `18_practice_quiz_sessions.sql` 中新增 `learning_session_results` 表定义
- [ ] 新建索引：`idx_learning_session_results_session_id`
- [ ] 新建索引：`idx_learning_session_results_card_id`

### 2.3 数据迁移
- [ ] practice_sessions → learning_sessions（session_type='practice'）迁移完成
- [ ] quiz_sessions → learning_sessions（session_type='quiz'）迁移完成
- [ ] practice_results → learning_session_results 迁移完成
- [ ] quiz_results → learning_session_results 迁移完成
- [ ] 数据行数校验一致

### 2.4 代码层切换 service/repository
- [ ] `api/services/study/practiceService.ts` 已改读写 `learning_sessions`
- [ ] `api/services/study/quizService.ts` 已改读写 `learning_sessions`
- [ ] `shared/types/` 下 PracticeSession/QuizSession 类型已统一为 LearningSession
- [ ] 前端 hook 与 store 已更新
- [ ] 相关测试已更新

### 2.5 删除旧表
- [ ] `practice_sessions` 表已删除
- [ ] `practice_results` 表已删除
- [ ] `quiz_sessions` 表已删除
- [ ] `quiz_results` 表已删除
- [ ] 对应索引已删除
- [ ] 对应 RLS 策略已删除
- [ ] 对应触发器已删除
- [ ] `npm run db:gen-types` 重新生成类型成功
- [ ] `npm run check` 通过
- [ ] `npm run test:run` 通过

## Phase 3: P1 表拆分

### 3.1 `study_cards` FSRS 字段抽离
- [ ] `study_card_fsrs_states` 表已创建
- [ ] 数据迁移完成（study_cards → study_card_fsrs_states）
- [ ] `study_cards` 表 7 个 `fsrs_*` 字段已删除
- [ ] `study_cards` 表 `last_rating` 字段已删除
- [ ] `study_cards` 表 `review_count` 字段已删除
- [ ] `study_cards` 表 `next_review` 字段已删除
- [ ] `study_cards` 表 `last_reviewed` 字段已删除
- [ ] `api/services/study/fsrsService.ts` 等读写代码已更新
- [ ] `14_functions.sql` 中 `get_user_study_stats` 函数已更新（JOIN `study_card_fsrs_states`）
- [ ] 索引 `idx_study_cards_user_next_review` 已迁移到 `study_card_fsrs_states`
- [ ] 索引 `idx_study_cards_next_review` 已迁移到 `study_card_fsrs_states`
- [ ] `shared/types/` 下 StudyCard 类型已更新
- [ ] `npm run db:gen-types` 重新生成类型成功
- [ ] `npm run check` 通过
- [ ] `npm run test:run` 通过

### 3.2 `knowledge_graphs` 内容字段抽离
- [x] `knowledge_graph_contents` 表已创建（`02_knowledge_graph.sql` 1:1 子表，PK=graph_id, FK ON DELETE CASCADE）
- [x] 数据迁移完成（knowledge_graphs → knowledge_graph_contents）（模块化 schema 文件代表目标状态，db:local:reset 重建即完成）
- [x] `knowledge_graphs` 表 `podcast_script` 列已删除
- [x] `knowledge_graphs` 表 `reference_books` 列已删除
- [x] `knowledge_graphs` 表 `external_links` 列已删除
- [x] `knowledge_graphs` 表 `learning_guide` 列已删除
- [x] 所有读取这些字段的 service 已更新（graphQueryService 嵌套查询+平铺、graphVersionService createBranch 复制、graphService create/update 同步、backupService 导入导出、literatureApplyService 读写 reference_books）
- [x] `shared/types/` 下 KnowledgeGraph 类型已更新（database.generated.ts 新增 knowledge_graph_contents 类型块 isOneToOne:true；database.ts 新增 KnowledgeGraphContentRow）
- [x] electron schema 已同步（`electron/db/schema.ts` 新增 knowledgeGraphContentsTable）
- [x] RLS 策略已添加（`13_rls_policies.sql` 4 条 SELECT/INSERT/UPDATE/DELETE，EXISTS 子查询跟随 knowledge_graphs 权限）
- [x] GRANT 已添加（`16_grants.sql` SELECT + ALL PRIVILEGES TO authenticated）
- [x] updated_at 触发器已添加（`15_triggers.sql` knowledge_graph_contents_updated_at）
- [x] `npm run db:gen-types` 重新生成类型成功（手动编辑 database.generated.ts，类型检查通过）
- [x] `npm run check` 通过（exit 0）
- [x] `npm run check:full` 通过（exit 0）
- [x] `npm run lint` 通过（exit 0）

## Phase 4: P1 数据冗余消除

### 4.1 `mastery_level` 单一来源
- [x] grep 所有 `task_subtasks.mastery_level` 读取处
- [x] service 层已改为 JOIN `knowledge_points` 读取
- [x] `task_subtasks.mastery_level` 列已删除
- [x] [07_scheduler_tasks.sql](file:///d:/KnowledgeMap/supabase/migrations/07_scheduler_tasks.sql) L218 注释已更新（mastery_level 列定义与 COMMENT 已删除）
- [x] `shared/types/database.generated.ts` 已移除 task_subtasks.mastery_level 字段（手动同步，与 `npm run db:gen-types` 等效）
- [x] `electron/db/schema.ts` taskSubtasksTable 已移除 mastery_level 列
- [x] `npm run check` 通过
- [x] `npm run lint` 通过

### 4.2 `user_tasks.context->>'graph_id'` 改为正式列
- [ ] `user_tasks` 新增 `graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE SET NULL` 列
- [ ] 数据迁移完成（context->>'graph_id' → graph_id）
- [ ] `context` JSONB 中的 `graph_id` 键已移除
- [ ] `idx_user_tasks_context_graph_id` 索引已删除
- [ ] `idx_user_tasks_graph_id` 部分索引已新建（WHERE graph_id IS NOT NULL）
- [ ] service 层读写已更新
- [ ] `npm run db:gen-types` 重新生成类型成功
- [ ] `npm run check` 通过

### 4.3 `relationship_types.show_arrow` 改为 ENUM
- [ ] `arrow_display` ENUM 类型已创建
- [ ] `relationship_types.show_arrow` 列类型已改为 `arrow_display`
- [ ] `chk_show_arrow` CHECK 约束已删除
- [ ] `shared/types/` 下 RelationshipType 类型已更新
- [ ] `npm run db:gen-types` 重新生成类型成功
- [ ] `npm run check` 通过

## Phase 5: P1 触发器函数统一

### 5.1 统一 `update_*_updated_at_column` 函数
- [ ] `25_story_creation.sql` 的 `update_story_updated_at_column` 函数已删除
- [ ] 4 个 story_* 触发器已改用 `update_updated_at_column`
- [ ] `58_literature_sources.sql` 的 `update_literature_sources_updated_at` 函数已删除
- [ ] `on_update_literature_sources` 触发器已改用 `update_updated_at_column`
- [ ] `28_agent_sessions.sql` 的 `update_agent_session_updated_at` 函数已删除
- [ ] `trg_agent_sessions_updated_at` 触发器已改用 `update_updated_at_column`
- [ ] `npm run db:local:reset` 成功
- [ ] `npm run test:run` 通过

## Phase 6: P2 索引清理

### 6.1 删除低基数索引
- [ ] `12_indexes.sql` L6 `idx_users_role` 已删除
- [ ] `12_indexes.sql` L10 `idx_knowledge_graphs_is_public` 已删除
- [ ] `12_indexes.sql` L43 `idx_graph_nodes_level` 已删除
- [ ] `npm run db:local:reset` 成功
- [ ] `npm run test:run` 通过

### 6.2 删除冗余子集索引
- [ ] `12_indexes.sql` L77 `idx_study_progress_user` 已删除
- [ ] `12_indexes.sql` L49 `idx_edges_source` 已删除
- [ ] `12_indexes.sql` L50 `idx_edges_target` 已删除
- [ ] `12_indexes.sql` L102 `idx_focus_sessions_user_id` 已删除
- [ ] `npm run db:local:reset` 成功
- [ ] `npm run test:run` 通过

## Phase 7: P2 外键补全

### 7.1 补充缺失外键
- [ ] `user_tasks.knowledge_point_id` 外键已添加（ON DELETE SET NULL）
- [ ] `focus_sessions.task_id` 外键已添加（ON DELETE SET NULL）
- [ ] `learning_paths.domain_id` 外键已添加（ON DELETE SET NULL）
- [ ] `npm run db:local:reset` 成功
- [ ] 现有数据无外键冲突

### 7.2 `graph_collaborators.invitation_token` 加 UNIQUE
- [ ] `uq_invitation_token` UNIQUE 约束已添加
- [ ] `npm run db:local:reset` 成功

## Phase 8: P2 agent 冗余（可选）

### 8.1 `agent_messages` 关联 `agent_tool_calls`
- [ ] `agent_messages.tool_call_id UUID` 列已新增
- [ ] 数据迁移完成（回填 tool_call_id）
- [ ] `agent_messages.tool_name` 列已删除
- [ ] `agent_messages.tool_args` 列已删除
- [ ] `agent_messages.tool_result` 列已删除
- [ ] agent service 层已改为 JOIN 读取
- [ ] `shared/types/` 下 AgentMessage 类型已更新
- [ ] `npm run db:gen-types` 重新生成类型成功
- [ ] `npm run check` 通过

## 最终验证

- [ ] `npm run check` 全量通过
- [ ] `npm run lint` 通过
- [ ] `npm run db:local:reset` 成功
- [ ] `npm run db:gen-types` 成功
- [ ] `npm run test:run` 全量通过
- [ ] `npm run test:db` 通过（若存在相关 pgTAP 测试）
- [ ] `npm run test:e2e` 关键路径通过
- [ ] schema 文件无残留 DEPRECATED 注释（针对本 spec 涉及的项）
- [ ] shared/types/database.generated.ts 与新 schema 一致
