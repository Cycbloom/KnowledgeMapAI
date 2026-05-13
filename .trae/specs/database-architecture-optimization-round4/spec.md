# 数据库架构优化（第四轮） Spec

## Why

三轮优化后 schema 已高度规范化（21 项修复），第四轮做最终收尾：标记 SM2 废弃字段、清理迁移遗留的冗余 ALTER、统一 seed 文件的 TIMESTAMPTZ 写法。这些项不涉及运行时行为变更，纯文档和一致性优化。

## What Changes

- **`knowledge_review_tasks` SM2 字段废弃标记**：为 `ease_factor`、`interval_days`、`repetitions` 列添加 `[DEPRECATED]` COMMENT，引导使用 `study_cards`（FSRS）
- **`user_tasks` 遗留的 DROP COLUMN 清理**：4 条 `ALTER TABLE user_tasks DROP COLUMN IF EXISTS` 语句从旧 schema 迁移遗留，在 `db reset` 时无意义但无害。添加分组注释说明其用途，不删除（避免影响已有数据库迁移）
- **Seed 文件 TIMESTAMPTZ 统一**：`50_seed_app_settings.sql` 等 8 个 seed 文件中的 `TIMESTAMP WITH TIME ZONE` 替换为 `TIMESTAMPTZ`

## Impact

- Affected specs: 无
- Affected code: `07_scheduler_tasks.sql`、seed 文件（50-57, 99）
- **BREAKING**: 无

## ADDED Requirements

### Requirement: SM2 字段废弃标记
系统 SHALL 为 `knowledge_review_tasks` 表的 SM2 算法字段添加废弃注释，推荐使用 `study_cards` 表的 FSRS 算法。

#### Scenario: 开发者选择间隔重复字段
- **WHEN** 开发者查看 `knowledge_review_tasks` 表结构
- **THEN** `ease_factor`、`interval_days`、`repetitions` 列注释包含 `[DEPRECATED]` 引导使用 FSRS

### Requirement: user_tasks DROP COLUMN 遗留分组注释
系统 SHALL 在 4 条 `ALTER TABLE user_tasks DROP COLUMN IF EXISTS` 语句上方添加注释说明其用途（兼容旧 schema 版本的列类型迁移）。

#### Scenario: 迁移文件可读性
- **WHEN** 维护者阅读迁移文件
- **THEN** 理解这些 DROP 语句的历史用途，不会误删

### Requirement: Seed 文件 TIMESTAMPTZ 统一
系统 SHALL 将 seed 文件中所有 `TIMESTAMP WITH TIME ZONE` 替换为 `TIMESTAMPTZ`。

#### Scenario: 全局一致性
- **WHEN** 搜索 `TIMESTAMP WITH TIME ZONE`
- **THEN** 整个 migrations/ 目录（含 seed 文件）结果为 0

## MODIFIED Requirements

无

## REMOVED Requirements

无