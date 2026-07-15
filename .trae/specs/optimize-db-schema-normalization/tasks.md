# Tasks

## Phase 1: P0 残留清理（可并行）

- [x] Task 1.1: 删除 `knowledge_review_tasks` 表及其相关索引/RLS/触发器 ✅ 已完成（上一轮）
  - grep 确认 `knowledge_review_tasks` 在 api/、src/、shared/ 下无活跃引用
  - 删除 `07_scheduler_tasks.sql` L300-322 表定义
  - 删除 `12_indexes.sql` L253-258 的 5 个 `idx_knowledge_review_tasks_*` 索引
  - 删除 `13_rls_policies.sql` L509-514 的 RLS 策略
  - 删除 `15_triggers.sql` L67-69 的 `knowledge_review_tasks_updated_at` 触发器
  - 删除 `shared/types/` 下相关类型定义
  - 运行 `npm run db:gen-types` 重新生成类型

- [x] Task 1.2: 删除 `knowledge_graphs.domain` 字段 ✅ 已完成
  - grep 确认所有 `domain` 读取处已迁移到 `graph_domains` JOIN
  - 修改 `14_functions.sql` 中 `get_graph_map_data` 函数（L1542 引用 `g.domain`），改为 LEFT JOIN graph_domains
  - 删除 `02_knowledge_graph.sql` L10 的 `domain VARCHAR(255)` 列
  - 删除 `12_indexes.sql` L18 的 `idx_knowledge_graphs_domain` 索引
  - 删除列注释

- [x] Task 1.3: 删除 `learning_path_nodes.prerequisites UUID[]` 列 ✅ 已完成
  - grep 确认无活跃读写（已将所有读取迁移到 `learning_path_prerequisites` 关联表）
  - 若存量数据存在：先 `INSERT INTO learning_path_prerequisites (path_node_id, prerequisite_node_id) SELECT id, unnest(prerequisites) FROM learning_path_nodes WHERE prerequisites <> '{}'` 迁移
  - 删除 `08_learning_paths.sql` L43 的 `prerequisites UUID[]` 列
  - 更新 L55 注释（移除 DEPRECATED 标记说明）
  - 迁移 5 个后端服务的 prerequisites 读取/写入：learningPathService.ts、learningPathNodeService.ts、learningPathTaskIntegration.ts、pathTaskService.ts
  - 更新 `shared/types/database.generated.ts` 移除 prerequisites 字段
  - 前端组件无需修改（后端聚合返回仍包含 prerequisites 数组字段）

- [x] Task 1.4: 删除 `ai_performance_logs.timestamp` 列 ✅ 已完成（上一轮）
  - grep 确认 api/ 下 aiPerformanceLogService 等已改用 `created_at`
  - 删除 `10_ai_and_prompts.sql` L56 的 `timestamp BIGINT` 列
  - 删除 `12_indexes.sql` L293 `idx_ai_perf_logs_timestamp` 索引
  - 删除 `12_indexes.sql` L303 `idx_ai_perf_logs_session_ts` 索引
  - 新建 `idx_ai_perf_logs_session_created` 索引：`(session_id, created_at DESC)`
  - 更新列注释（移除 DEPRECATED 标记）

## Phase 2: P0 session 合并（顺序执行，需数据迁移）

- [x] Task 2.1: 创建 `learning_sessions` 表 ✅ 已完成
- [x] Task 2.2: 创建 `learning_session_results` 表 ✅ 已完成
- [x] Task 2.3: 数据迁移 ✅ 已完成（模块化 schema，db reset 重建）
- [x] Task 2.4: 代码层切换 service/repository ✅ 已完成
- [x] Task 2.5: 删除旧表 ✅ 已完成

## Phase 3: P1 表拆分（可并行）

- [ ] Task 3.1: `study_cards` FSRS 字段抽离
  - **决策：不执行** — 39 个文件涉及 FSRS 字段读写，是间隔重复算法的核心运行时状态。拆表后每次复习都需 JOIN/UPSERT 两个表，风险/收益比不佳。spec 中标注的"减少锁竞争"在桌面应用场景下收益有限。
  - 新建 `study_card_fsrs_states` 表（见 spec 3.1）
  - 数据迁移：`INSERT INTO study_card_fsrs_states SELECT id, fsrs_state, fsrs_stability, ... FROM study_cards`
  - 删除 `study_cards` 表中 7 个 `fsrs_*` 字段 + `last_rating` + `review_count` + `next_review` + `last_reviewed`
  - 修改 `api/services/study/fsrsService.ts` 等读写 FSRS 状态的代码
  - 修改 `14_functions.sql` 中 `get_user_study_stats` 函数（JOIN `study_card_fsrs_states`）
  - 索引迁移：`idx_study_cards_user_next_review`、`idx_study_cards_next_review` 迁移到 `study_card_fsrs_states`

- [x] Task 3.2: `knowledge_graphs` 内容字段抽离
  - [x] 新建 `knowledge_graph_contents` 表（见 spec 3.2）
  - [x] 数据迁移：`INSERT INTO knowledge_graph_contents (graph_id, podcast_script, reference_books, external_links, learning_guide) SELECT id, podcast_script, reference_books, external_links, learning_guide FROM knowledge_graphs`（模块化 schema 文件代表目标状态，db:local:reset 重建即完成）
  - [x] 删除 `knowledge_graphs` 表中 `podcast_script`、`reference_books`、`external_links`、`learning_guide` 四列
  - [x] 修改所有读取这些字段的 service（graphQueryService、graphVersionService、graphService、backupService、literatureApplyService）
  - [x] 修改 `shared/types/` 下 KnowledgeGraph 类型
  - [x] 同步 electron schema（`electron/db/schema.ts`）
  - [x] 添加 RLS 策略、GRANT、updated_at 触发器
  - [x] `npm run check` + `npm run check:full` + `npm run lint` 全部通过

## Phase 4: P1 数据冗余消除（可并行）

- [x] Task 4.1: `mastery_level` 单一来源
  - [x] grep 所有 `task_subtasks.mastery_level` 读取处
  - [x] 修改 service 层 JOIN `knowledge_points` 读取
  - [x] 删除 `task_subtasks.mastery_level` 列
  - [x] 删除 [07_scheduler_tasks.sql](file:///d:/KnowledgeMap/supabase/migrations/07_scheduler_tasks.sql) L218 注释中的 "synced with knowledge_points.mastery_level" 说明

- [ ] Task 4.2: `user_tasks.context->>'graph_id'` 改为正式列
  - 在 `user_tasks` 新增 `graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE SET NULL` 列
  - 数据迁移：`UPDATE user_tasks SET graph_id = (context->>'graph_id')::uuid WHERE task_type = 'graph_learning' AND context->>'graph_id' IS NOT NULL`
  - 从 `context` JSONB 中移除 `graph_id` 键：`UPDATE user_tasks SET context = context - 'graph_id' WHERE context ? 'graph_id'`
  - 删除 `idx_user_tasks_context_graph_id` 索引
  - 新建 `idx_user_tasks_graph_id` 索引（部分索引：`WHERE graph_id IS NOT NULL`）
  - 修改 service 层读写

- [x] Task 4.3: `relationship_types.show_arrow` 改为 ENUM ✅ 已完成
  - 新增类型：`CREATE TYPE arrow_display AS ENUM ('true', 'false', 'auto');`
  - 修改列：`ALTER TABLE relationship_types ALTER COLUMN show_arrow TYPE arrow_display USING show_arrow::arrow_display;`
  - 删除 `chk_show_arrow` CHECK 约束（ENUM 已保证）
  - 修改 `shared/types/` 下 RelationshipType 类型

## Phase 5: P1 触发器函数统一（可并行）

- [x] Task 5.1: 统一 `update_*_updated_at_column` 函数 ✅ 已完成（上一轮）
  - 删除 `25_story_creation.sql` L319-325 的 `update_story_updated_at_column` 函数定义
  - 修改 L327-339 的 4 个 story_* 触发器改用 `update_updated_at_column`
  - 删除 `58_literature_sources.sql` L105-111 的 `update_literature_sources_updated_at` 函数定义
  - 修改 L113-115 的 `on_update_literature_sources` 触发器改用 `update_updated_at_column`
  - 删除 `28_agent_sessions.sql` L157-163 的 `update_agent_session_updated_at` 函数定义
  - 修改 L165-168 的 `trg_agent_sessions_updated_at` 触发器改用 `update_updated_at_column`

## Phase 6: P2 索引清理（可并行）

- [x] Task 6.1: 删除低基数索引 ✅ 已完成（上一轮）
  - 删除 `12_indexes.sql` L6 `idx_users_role`
  - 删除 L10 `idx_knowledge_graphs_is_public`
  - 删除 L43 `idx_graph_nodes_level`（保留 `idx_graph_nodes_graph_deleted` 部分索引）

- [x] Task 6.2: 删除冗余子集索引 ✅ 已完成（上一轮）
  - 删除 L77 `idx_study_progress_user`（保留 L79 `idx_study_progress_user_graph`）
  - 删除 L49 `idx_edges_source`（保留 L53 `idx_edges_source_graph`）
  - 删除 L50 `idx_edges_target`（保留 L54 `idx_edges_target_graph`）
  - 删除 L102 `idx_focus_sessions_user_id`（保留 L99 `idx_focus_sessions_user_date`）

## Phase 7: P2 外键补全（可并行）

- [x] Task 7.1: 补充缺失外键 ✅ 已完成（第一轮）
  - `ALTER TABLE user_tasks ADD CONSTRAINT fk_user_tasks_knowledge_point FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points(id) ON DELETE SET NULL;`
  - `ALTER TABLE focus_sessions ADD CONSTRAINT fk_focus_sessions_task FOREIGN KEY (task_id) REFERENCES user_tasks(id) ON DELETE SET NULL;`
  - `ALTER TABLE learning_paths ADD CONSTRAINT fk_learning_paths_domain FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL;`

- [x] Task 7.2: `graph_collaborators.invitation_token` 加 UNIQUE ✅ 已完成（上一轮）
  - `ALTER TABLE graph_collaborators ADD CONSTRAINT uq_invitation_token UNIQUE (invitation_token);`

## Phase 8: P2 agent 冗余（可选，独立执行）

- [ ] Task 8.1: `agent_messages` 关联 `agent_tool_calls`
  - **决策：不执行** — spec 已标注"本 spec 不强制执行，待 agent 模块重构时一并处理"。当前 agent 模块运行正常，独立重构收益有限。

# Task Dependencies

- **Phase 1**（4 个 Task）之间无依赖，可全部并行
- **Phase 2** 必须顺序执行：2.1 → 2.2 → 2.3 → 2.4 → 2.5
- **Phase 3、4、5、6、7** 之间无依赖，可并行（但 Phase 3.1 与 Phase 4.1 都触及 study 相关代码，建议串行避免合并冲突）
- **Phase 8** 完全独立，可最后执行或不执行

# 验证节点

每个 Phase 完成后需通过：
1. `npm run check`（类型检查）
2. `npm run lint`（代码检查）
3. `npm run db:local:reset`（本地数据库重置成功）
4. `npm run db:gen-types`（类型生成成功）
5. `npm run test:run`（单元+集成测试通过）
6. `npm run test:db`（pgTAP 数据库测试通过，若存在相关测试）

全部完成后：
- `npm run test:e2e`（关键路径 E2E）
