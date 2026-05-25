# Tasks

- [x] Task 1: 更新 TypeScript 类型定义
  - [x] 1.1: 更新 `KnowledgeGraphRow` 添加遗漏字段（`reference_books`, `external_links`, `learning_guide`, `parent_graph_id`, `last_used_at`, `task_id`）
  - [x] 1.2: 更新 `BackupGraphItem` 添加遗漏字段（`domain`, `is_favorite`, `reference_books`, `external_links`, `learning_guide`, `parent_graph_id`, `last_used_at`, `task_id`, `podcast_script`）
  - [x] 1.3: 更新 `BackupEdgeItem` 添加样式字段（`custom_label`, `custom_color`, `custom_line_style`, `show_arrow`）
  - [x] 1.4: 更新 `BackupNodeItem` 添加知识点扩展字段（`keywords`, `aliases`, `mastery_level`, `last_study_at`, `total_study_duration`）
  - [x] 1.5: 修复 `StudyProgressRow` 接口匹配实际 `study_progress` 表结构（`id`, `user_id`, `graph_id`, `total_nodes`, `mastered_nodes`, `progress_percentage`, `study_streak`, `updated_at`）
  - [x] 1.6: 新增 `BackupBackboneModuleItem` 接口
  - [x] 1.7: 更新 `BackupData` 接口添加 `backbone_modules` 字段，更新 `version` 为 `'2.0'`
  - [x] 1.8: 更新 `GraphNodeWithKnowledgePoint` 接口添加 `keywords`, `aliases`, `mastery_level`, `last_study_at`, `total_study_duration`

- [x] Task 2: 更新 `createBackup()` 保存逻辑
  - [x] 2.1: 更新 `knowledge_graphs` 映射包含所有新字段
  - [x] 2.2: 更新 `graph_nodes` + `knowledge_points` 查询添加遗漏字段（`keywords`, `aliases`, `mastery_level`, `last_study_at`, `total_study_duration`）
  - [x] 2.3: 更新 nodes 映射包含新字段
  - [x] 2.4: 更新 edges 映射包含样式字段
  - [x] 2.5: 新增 `graph_backbone_modules` 查询和映射
  - [x] 2.6: 更新 `BackupData.version` 为 `'2.0'`

- [x] Task 3: 更新 `restoreBackupData()` 恢复逻辑
  - [x] 3.1: 更新 `restoreBackupData` 参数类型定义，添加所有新字段
  - [x] 3.2: 修复 `knowledge_graphs` 恢复包含所有新字段
  - [x] 3.3: 修复 `nodes` 恢复：直接插入 `knowledge_points` 和 `graph_nodes`，保留 `is_accepted` 原始值和知识点扩展字段
  - [x] 3.4: 修复 `edges` 恢复：直接插入包含样式字段，而非通过 `edgeService.create()`
  - [x] 3.5: 修复 `study_cards` 恢复：直接插入保留 FSRS 状态，而非通过 `studyService.createCard()`
  - [x] 3.6: 新增 `study_progress` 恢复逻辑
  - [x] 3.7: 新增 `focus_sessions` 恢复逻辑
  - [x] 3.8: 新增 `user_achievements` 恢复逻辑
  - [x] 3.9: 新增 `periodic_tasks` 恢复逻辑
  - [x] 3.10: 新增 `graph_backbone_modules` 恢复逻辑
  - [x] 3.11: 更新恢复前清空逻辑，添加新表的清空

- [x] Task 4: 运行类型检查和 lint 验证

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 2, Task 3]
