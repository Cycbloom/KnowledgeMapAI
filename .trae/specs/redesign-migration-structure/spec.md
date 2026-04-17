# 数据库 Migration 结构重构 Spec

## Why

当前 `supabase/migrations/` 目录下的数据库经过多轮迭代后变得冗杂：初始 schema 文件（000）已达 129KB/2868 行，包含 55+ 张表、200+ 索引、100+ RLS 策略、15+ 函数和 15+ 触发器全部堆积在单一文件中。seed 文件（001）同样庞大。此外存在多个增量迁移文件与主文件内容重复、表间职责重叠、索引冗余等问题，导致管理困难、开发效率低下、新人上手成本高。

## What Changes

- **将单一巨型 schema 文件拆分为模块化文件**：按业务域（core、knowledge、study、scheduler、gamification、ai、notification）拆分 `00000000000000_initial_schema.sql`
- **将单一巨型 seed 文件拆分为模块化文件**：按业务域拆分 `00000000000001_initial_seed.sql`
- **合并冗余迁移文件**：将 `20250316000000_add_domain_column.sql`、`20260319000000_add_performance_indexes.sql`、`remote_migration_template_refactor.sql`、`scheduler_deep_integration_cloud.sql` 的内容合并回主文件后删除
- **消除冗余表**：移除或合并职责重叠的表（如 `tasks` 与 `scheduled_tasks`、`daily_tasks` 与 `periodic_tasks`）
- **精简冗余索引**：移除重复或低效索引，保留核心查询路径所需索引
- **统一触发器函数**：将多个相同的 `update_*_updated_at()` 函数合并为单一通用函数
- **统一外键引用**：统一使用 `auth.users(id)` 或 `users(id)`，消除不一致
- **精简学习路径模块**：合并过度拆分的学习路径相关表

## Impact

- Affected specs: 数据库 schema 定义、seed 数据、所有引用数据库表的 API 和前端代码
- Affected code:
  - `supabase/migrations/` 下所有 SQL 文件
  - `api/` 下所有数据库查询代码
  - `src/` 下所有数据库类型定义和查询代码
  - `.trae/rules/project_rules.md` 中数据库规范部分

## 现有数据库问题分析

### 问题 1：单文件巨型 Schema（严重）

`00000000000000_initial_schema.sql` 包含 2868 行、129KB，涵盖：
- 55+ 张表的 CREATE TABLE
- 200+ 个索引的 CREATE INDEX
- 100+ 条 RLS 策略
- 15+ 个函数
- 15+ 个触发器
- GRANT 语句

**影响**：无法快速定位特定表定义，代码审查困难，合并冲突频发。

### 问题 2：冗余/重叠表（严重）

| 重叠表 | 问题描述 |
|--------|----------|
| `tasks` vs `scheduled_tasks` | `tasks` 是后台异步任务表（name/type/payload/result），`scheduled_tasks` 是用户计划任务表，命名混淆 |
| `daily_tasks` vs `periodic_tasks` | `daily_tasks` 是每日任务（gamification），`periodic_tasks` 是周期任务（含 weekly/monthly/quarterly），概念重叠 |
| `study_progress` vs `learning_path_progress` | 两者都跟踪学习进度，但粒度不同 |
| `learning_plans` vs `learning_path_progress` | 学习计划与进度跟踪有重叠 |

### 问题 3：过度拆分的表（中等）

学习路径模块有 5 张表：
- `learning_paths` - 学习路径
- `learning_path_nodes` - 路径节点
- `learning_path_progress` - 路径进度
- `learning_plans` - 每日计划
- `path_node_tasks` - 节点任务关联

其中 `learning_plans` 和 `learning_path_progress` 可以合并。

### 问题 4：冗余索引（中等）

部分表索引过多且存在重复：
- `study_cards`：13 个索引，其中多个功能重叠
- `focus_sessions`：8 个索引
- `knowledge_points`：8 个索引（含 2 个 `owner_id` 索引）
- `edges`：9 个索引（含 2 个 `graph_id` 索引）

### 问题 5：重复触发器函数（轻微）

存在多个功能完全相同的触发器函数：
- `update_scheduled_tasks_updated_at()`
- `update_queues_updated_at()`
- `update_updated_at_column()`
- `update_focus_stats_updated_at()`
- `update_task_templates_updated_at()`
- `update_task_reviews_updated_at()`
- `update_periodic_tasks_updated_at()`

这些都可以统一为 `update_updated_at_column()`。

### 问题 6：外键引用不一致（轻微）

部分表引用 `auth.users(id)`，部分引用 `users(id)`：
- `users` 表自身使用 `gen_random_uuid()` 作为主键
- `quiz_sets`、`scheduled_tasks` 等引用 `auth.users(id)`
- `knowledge_points`、`study_cards` 等引用 `users(id)`

### 问题 7：增量迁移文件与主文件重复（严重）

4 个增量迁移文件的内容已包含在主 schema 文件中：
- `20250316000000_add_domain_column.sql` - domain 列已在主文件中
- `20260319000000_add_performance_indexes.sql` - 索引已在主文件中
- `remote_migration_template_refactor.sql` - 模板重构已在主文件中
- `scheduler_deep_integration_cloud.sql` - 调度器整合已在主文件中

## 重构方案（参考大型项目最佳实践）

### 参考案例

1. **GitLab**：数据库使用 schema 命名空间分离模块（如 `gitlab_main`、`gitlab_ci`），每个模块独立迁移
2. **GitHub**：采用领域驱动设计，按业务域组织迁移文件，每个迁移只做一件事
3. **Stripe**：严格的迁移规范，每个迁移文件有明确的 up/down，禁止修改已有迁移
4. **Supabase 官方推荐**：使用 `supabase db diff` 生成迁移，保持迁移文件原子性

### 模块化拆分方案

将单一 schema 文件拆分为以下模块文件结构：

```
supabase/migrations/
├── 00000000000000_01_extensions_and_types.sql      # 扩展和枚举类型
├── 00000000000000_02_core_users.sql                 # 核心用户模块
├── 00000000000000_03_knowledge_graph.sql            # 知识图谱核心
├── 00000000000000_04_knowledge_points.sql           # 知识点与版本
├── 00000000000000_05_graph_structure.sql            # 图谱结构（节点、边、关系类型）
├── 00000000000000_06_domains_and_collaboration.sql  # 领域与协作
├── 00000000000000_07_study_and_cards.sql            # 学习卡片与测验
├── 00000000000000_08_scheduler_tasks.sql            # 任务调度器
├── 00000000000000_09_learning_paths.sql             # 学习路径
├── 00000000000000_10_gamification.sql               # 游戏化（成就、通行证）
├── 00000000000000_11_ai_and_prompts.sql             # AI 与提示词
├── 00000000000000_12_focus_and_notifications.sql    # 专注与通知
├── 00000000000000_13_indexes.sql                    # 全局索引（统一管理）
├── 00000000000000_14_rls_policies.sql               # 全局 RLS 策略
├── 00000000000000_15_functions.sql                  # 全局函数
├── 00000000000000_16_triggers.sql                   # 全局触发器
├── 00000000000000_17_grants.sql                     # 全局权限
├── 00000000000001_01_seed_app_settings.sql          # 应用设置种子
├── 00000000000001_02_seed_achievements.sql          # 成就种子
├── 00000000000001_03_seed_templates.sql             # 模板种子
├── 00000000000001_04_seed_prompt_templates.sql      # 提示词种子
├── 00000000000001_05_seed_relationship_types.sql    # 关系类型种子
├── 00000000000001_06_seed_task_templates.sql        # 任务模板种子
├── 00000000000001_07_seed_pass_rewards.sql          # 通行证奖励种子
├── 00000000000001_08_seed_triggers_and_defaults.sql # 触发器和默认数据
```

### 表合并/精简方案

| 操作 | 涉及表 | 说明 |
|------|--------|------|
| **删除** | `tasks` | 与 `scheduled_tasks` 职责重叠，`tasks` 仅用于后台异步任务（name/type/payload），可合并到 `scheduled_tasks` 或移至应用层 |
| **合并** | `daily_tasks` → `periodic_tasks` | `daily_tasks` 是 `periodic_tasks` 的特例（period_type='daily'），统一为周期任务 |
| **合并** | `learning_plans` → `learning_path_progress` | 学习计划本质是进度的一种形式，合并后增加 `plan_date`/`planned_duration` 字段 |
| **精简** | `study_cards` 索引 | 从 13 个精简到 6-7 个核心索引 |
| **精简** | `focus_sessions` 索引 | 从 8 个精简到 4-5 个 |
| **精简** | `knowledge_points` 索引 | 移除重复的 `owner_id` 索引 |
| **精简** | `edges` 索引 | 移除重复的 `graph_id` 索引 |

### 触发器函数统一方案

将 7 个 `update_*_updated_at()` 函数统一为 1 个 `update_updated_at_column()` 函数，所有表共享。

### 外键引用统一方案

统一使用 `auth.users(id)` 作为外键引用（Supabase 标准做法），移除对 `public.users(id)` 的直接引用。`users` 表仅作为 `auth.users` 的扩展 profile 表。

## ADDED Requirements

### Requirement: 模块化 Schema 文件结构

系统 SHALL 将单一巨型 schema 文件拆分为按业务域组织的模块化文件，每个文件聚焦单一职责。

#### Scenario: Schema 文件按模块组织
- **WHEN** 开发人员查看 `supabase/migrations/` 目录
- **THEN** 应看到按编号和业务域命名的模块化文件，而非单一巨型文件
- **AND** 每个文件不超过 300 行
- **AND** 文件命名遵循 `00000000000000_序号_模块名.sql` 格式

#### Scenario: 模块文件执行顺序
- **WHEN** 执行 `npx supabase db reset`
- **THEN** 所有模块文件按文件名排序依次执行
- **AND** 表定义文件先于索引/RLS/函数文件执行
- **AND** 依赖关系通过文件编号保证

### Requirement: 模块化 Seed 文件结构

系统 SHALL 将单一巨型 seed 文件拆分为按数据类型组织的模块化文件。

#### Scenario: Seed 文件按数据类型组织
- **WHEN** 开发人员查看 seed 文件
- **THEN** 应看到按数据类型分离的 seed 文件（成就、模板、提示词等）
- **AND** 每个 seed 文件可独立执行

### Requirement: 消除冗余迁移文件

系统 SHALL 将增量迁移文件的内容合并回主 schema 文件，并删除冗余的增量迁移文件。

#### Scenario: 删除冗余迁移文件
- **WHEN** 重构完成
- **THEN** 以下文件应被删除：
  - `20250316000000_add_domain_column.sql`
  - `20260319000000_add_performance_indexes.sql`
  - `remote_migration_template_refactor.sql`
  - `scheduler_deep_integration_cloud.sql`
- **AND** 这些文件中的所有变更已包含在主 schema 文件中

### Requirement: 合并重叠表

系统 SHALL 合并职责重叠的数据库表，减少表数量和复杂度。

#### Scenario: 删除 tasks 表
- **WHEN** 重构完成
- **THEN** `tasks` 表应被删除
- **AND** 如有需要，后台异步任务功能通过 `scheduled_tasks` 表的 `task_type='async'` 实现

#### Scenario: 合并 daily_tasks 到 periodic_tasks
- **WHEN** 重构完成
- **THEN** `daily_tasks` 表应被删除
- **AND** 每日任务功能通过 `periodic_tasks` 表的 `period_type='daily'` 实现
- **AND** `periodic_tasks.period_type` 的 CHECK 约束增加 `'daily'` 值

#### Scenario: 合并 learning_plans 到 learning_path_progress
- **WHEN** 重构完成
- **THEN** `learning_plans` 表应被删除
- **AND** `learning_path_progress` 表增加 `planned_duration`、`planned_nodes` 字段
- **AND** 原有 `learning_plans` 的数据迁移到 `learning_path_progress`

### Requirement: 精简冗余索引

系统 SHALL 移除重复和低效索引，保留核心查询路径所需索引。

#### Scenario: study_cards 索引精简
- **WHEN** 重构完成
- **THEN** `study_cards` 表索引从 13 个精简到 7 个以内
- **AND** 保留的索引覆盖以下查询路径：用户+下次复习、知识点、测验集合、图谱

#### Scenario: 移除重复索引
- **WHEN** 重构完成
- **THEN** 以下重复索引应被移除：
  - `knowledge_points` 的重复 `owner_id` 索引
  - `edges` 的重复 `graph_id` 索引
  - `tasks` 的重复 `user_id+status` 索引

### Requirement: 统一触发器函数

系统 SHALL 将多个相同的 `update_*_updated_at()` 触发器函数合并为单一通用函数。

#### Scenario: 触发器函数统一
- **WHEN** 重构完成
- **THEN** 仅存在一个 `update_updated_at_column()` 触发器函数
- **AND** 所有需要自动更新 `updated_at` 的表使用此函数
- **AND** 原有的 `update_scheduled_tasks_updated_at()`、`update_queues_updated_at()` 等函数被删除

### Requirement: 统一外键引用

系统 SHALL 统一所有用户相关外键引用为 `auth.users(id)`。

#### Scenario: 外键引用统一
- **WHEN** 重构完成
- **THEN** 所有用户相关外键统一引用 `auth.users(id)`
- **AND** 不再存在引用 `public.users(id)` 的外键
- **AND** `users` 表作为 `auth.users` 的扩展 profile 表，通过触发器同步

## MODIFIED Requirements

### Requirement: 本地数据库 Schema 文件管理

原有行为：所有表定义在单一 `00000000000000_initial_schema.sql` 文件中

修改后行为：
1. Schema 按业务域拆分为多个模块文件
2. 每个模块文件聚焦单一职责
3. 文件命名遵循 `00000000000000_序号_模块名.sql` 格式
4. 不创建新的增量迁移文件，所有变更直接修改对应的模块文件

### Requirement: 本地数据库 Seed 文件管理

原有行为：所有种子数据在单一 `00000000000001_initial_seed.sql` 文件中

修改后行为：
1. Seed 数据按类型拆分为多个模块文件
2. 文件命名遵循 `00000000000001_序号_数据类型.sql` 格式

## REMOVED Requirements

### Requirement: 后台异步任务表（tasks）
**Reason**: 与 `scheduled_tasks` 职责重叠，后台异步任务可通过 `scheduled_tasks.task_type='async'` 或应用层队列实现
**Migration**: 将现有 `tasks` 表数据迁移到 `scheduled_tasks`（如有需要），或直接删除

### Requirement: 每日任务独立表（daily_tasks）
**Reason**: 是 `periodic_tasks` 的特例（period_type='daily'），无需独立表
**Migration**: 将现有 `daily_tasks` 数据迁移到 `periodic_tasks`，period_type 设为 'daily'

### Requirement: 学习计划独立表（learning_plans）
**Reason**: 与 `learning_path_progress` 功能重叠，合并后可减少表数量
**Migration**: 将 `learning_plans` 的 `planned_duration`、`planned_nodes` 字段迁移到 `learning_path_progress`
