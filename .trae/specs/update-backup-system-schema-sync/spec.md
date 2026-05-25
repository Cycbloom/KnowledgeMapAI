# 快照备份系统与数据库 Schema 同步更新 Spec

## Why

快照备份系统是早期开发的功能，经过多轮迭代后，数据库 schema 已新增大量字段和表，但备份的保存和恢复逻辑未同步更新。用户从快照恢复后发现图谱类型（`template_type`）等关键数据丢失，说明备份系统已严重落后于当前数据库架构。

## What Changes

- 补全 `BackupGraphItem` 中遗漏的 `knowledge_graphs` 表字段（`domain`, `is_favorite`, `reference_books`, `external_links`, `learning_guide`, `parent_graph_id`, `last_used_at`, `task_id`）
- 补全 `BackupEdgeItem` 中遗漏的 `edges` 表样式字段（`custom_label`, `custom_color`, `custom_line_style`, `show_arrow`）
- 补全 `BackupNodeItem` 中遗漏的 `knowledge_points` 表字段（`keywords`, `aliases`, `mastery_level`, `last_study_at`, `total_study_duration`）
- 修复 `StudyProgressRow` 接口与实际 `study_progress` 表 schema 不匹配的问题
- 补全 `restoreBackupData()` 中遗漏的恢复逻辑：`study_progress`、`focus_sessions`、`user_achievements`、`periodic_tasks`
- 修复 `restoreBackupData()` 中 `study_cards` 恢复时 FSRS 学习状态丢失的问题
- 修复 `restoreBackupData()` 中 `edges` 恢复时样式信息丢失的问题
- 修复 `restoreBackupData()` 中 `nodes` 恢复时 `is_accepted` 状态被硬编码为 `true` 的问题
- 更新 `KnowledgeGraphRow` 类型补全遗漏字段
- 更新 `BackupData.version` 版本号以区分新旧备份格式
- 新增 `graph_backbone_modules` 表数据的备份和恢复

## Impact

- Affected specs: 备份/恢复功能、数据导出/导入功能
- Affected code:
  - `api/services/common/backupService.ts` — 备份数据结构、保存逻辑
  - `api/routes/backup.ts` — 恢复逻辑
  - `shared/types/database.ts` — `KnowledgeGraphRow` 类型

## ADDED Requirements

### Requirement: 备份数据结构完整同步数据库 Schema

备份系统 SHALL 保存所有用户数据表中与用户相关的字段，确保恢复后数据不丢失。

#### Scenario: knowledge_graphs 表完整备份

- **WHEN** 系统创建备份
- **THEN** `BackupGraphItem` SHALL 包含以下字段：`id`, `title`, `description`, `domain`, `settings`, `is_public`, `is_favorite`, `template_type`, `reference_books`, `external_links`, `learning_guide`, `parent_graph_id`, `last_used_at`, `task_id`, `podcast_script`, `created_at`, `updated_at`

#### Scenario: edges 表完整备份

- **WHEN** 系统创建备份
- **THEN** `BackupEdgeItem` SHALL 包含以下字段：`id`, `graph_id`, `source_knowledge_point_id`, `target_knowledge_point_id`, `relationship_type`, `weight`, `custom_label`, `custom_color`, `custom_line_style`, `show_arrow`

#### Scenario: knowledge_points 表完整备份

- **WHEN** 系统创建备份
- **THEN** `BackupNodeItem` SHALL 包含以下字段：`id`, `graph_id`, `title`, `content`, `learning_material`, `keywords`, `aliases`, `properties`, `mastery_level`, `last_study_at`, `total_study_duration`, `x_position`, `y_position`, `level`, `is_accepted`, `created_at`, `updated_at`

#### Scenario: study_progress 表正确备份

- **WHEN** 系统创建备份
- **THEN** `StudyProgressRow` 接口 SHALL 匹配实际 `study_progress` 表结构：`id`, `user_id`, `graph_id`, `total_nodes`, `mastered_nodes`, `progress_percentage`, `study_streak`, `updated_at`

### Requirement: 恢复逻辑完整还原所有备份数据

恢复系统 SHALL 将备份数据完整还原到数据库，不丢弃任何已保存的字段。

#### Scenario: study_cards 恢复保留 FSRS 学习状态

- **WHEN** 用户从备份恢复 study_cards
- **THEN** FSRS 相关字段（`fsrs_state`, `fsrs_stability`, `fsrs_difficulty`, `fsrs_elapsed_days`, `fsrs_scheduled_days`, `fsrs_retrievability`, `fsrs_last_review`）SHALL 被正确还原，而非重置为默认值

#### Scenario: edges 恢复保留样式信息

- **WHEN** 用户从备份恢复 edges
- **THEN** 边的样式字段（`custom_label`, `custom_color`, `custom_line_style`, `show_arrow`）SHALL 被正确还原

#### Scenario: nodes 恢复保留 is_accepted 状态

- **WHEN** 用户从备份恢复 nodes
- **THEN** `is_accepted` 字段 SHALL 使用备份中的原始值，而非硬编码为 `true`

#### Scenario: study_progress 恢复

- **WHEN** 用户从备份恢复数据
- **THEN** `study_progress` 数据 SHALL 被正确恢复到数据库

#### Scenario: focus_sessions 恢复

- **WHEN** 用户从备份恢复数据
- **THEN** `focus_sessions` 数据 SHALL 被正确恢复到数据库

#### Scenario: user_achievements 恢复

- **WHEN** 用户从备份恢复数据
- **THEN** `user_achievements` 数据 SHALL 被正确恢复到数据库

#### Scenario: periodic_tasks 恢复

- **WHEN** 用户从备份恢复数据
- **THEN** `periodic_tasks` 数据 SHALL 被正确恢复到数据库

### Requirement: graph_backbone_modules 备份与恢复

- **WHEN** 系统创建备份且图谱包含骨干模块数据
- **THEN** `graph_backbone_modules` 数据 SHALL 被保存到备份中

- **WHEN** 用户从备份恢复数据
- **THEN** `graph_backbone_modules` 数据 SHALL 被正确恢复，关联到新的图谱 ID

### Requirement: 备份版本号管理

- **WHEN** 系统创建新格式备份
- **THEN** `BackupData.version` SHALL 更新为 `'2.0'`

- **WHEN** 系统恢复旧版本（`1.0`）备份
- **THEN** 系统 SHALL 兼容处理缺失字段，使用合理的默认值

## MODIFIED Requirements

### Requirement: KnowledgeGraphRow 类型完整

`KnowledgeGraphRow` 接口 SHALL 包含 `knowledge_graphs` 表的所有用户相关字段，包括 `template_type`, `reference_books`, `external_links`, `learning_guide`, `parent_graph_id`, `last_used_at`, `task_id`。

### Requirement: createBackup 查询和映射完整

`createBackup()` 函数 SHALL：
1. 从数据库查询所有必要字段
2. 映射时包含所有字段到备份数据结构
3. 查询 `graph_backbone_modules` 表数据并包含在备份中
4. 查询 `knowledge_points` 时包含 `keywords`, `aliases`, `mastery_level`, `last_study_at`, `total_study_duration` 字段

### Requirement: restoreBackupData 恢复完整

`restoreBackupData()` 函数 SHALL：
1. 恢复 `knowledge_graphs` 时包含所有已备份字段
2. 恢复 `nodes` 时保留 `is_accepted` 原始值和 `knowledge_points` 的扩展字段
3. 恢复 `edges` 时包含样式字段，直接插入而非通过 service 创建
4. 恢复 `study_cards` 时直接插入保留 FSRS 状态
5. 恢复 `study_progress`、`focus_sessions`、`user_achievements`、`periodic_tasks`
6. 恢复 `graph_backbone_modules`
