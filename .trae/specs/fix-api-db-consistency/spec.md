# API-数据库一致性修复 Spec

## Why

数据库重构后删除了 `tasks`、`daily_tasks`、`learning_plans` 三张表，但 API 层仍有 15 个文件引用这些旧表名和旧字段，导致运行时查询报错（如 `Get Tasks Error`）。

## What Changes

- 将所有 `.from("tasks")` 引用改为 `.from("scheduled_tasks")`，并适配字段映射
- 将所有 `.from("daily_tasks")` 引用改为 `.from("periodic_tasks")`，并添加 `period_type='daily'` 过滤条件
- 将所有 `.from("learning_plans")` 引用改为 `.from("learning_path_progress")`，并适配字段映射
- 更新所有相关的 TypeScript 接口定义以匹配新表结构
- 更新验证 Schema 以匹配新字段名
- **BREAKING**: `Task` 接口字段从 `{type, name, payload, result, error}` 变为 `{task_type, title, description, ...}`

## Impact

- Affected specs: redesign-migration-structure（数据库重构）
- Affected code:
  - `api/services/taskService.ts` — Task 接口 + 所有查询
  - `api/jobs/worker.ts` — 任务查询
  - `api/jobs/taskProcessor.ts` — 任务处理逻辑
  - `api/database/adapters/supabase.ts` — 数据库适配器（5 个方法）
  - `api/database/interface.ts` — 接口定义
  - `api/services/achievementService.ts` — daily_tasks 查询
  - `api/services/scheduler/periodicTaskService.ts` — daily_tasks 查询
  - `api/services/common/backupService.ts` — 备份逻辑
  - `api/services/study/learningPathService.ts` — learning_plans 查询
  - `api/routes/data.ts` — 数据清理
  - `api/schemas/index.ts` — 验证 Schema
  - `shared/types/common.ts` — 共享 Task 接口

## ADDED Requirements

### Requirement: API 与数据库表名一致性

所有 API 代码中的 Supabase `.from()` 调用 SHALL 引用当前存在的数据库表名。

#### Scenario: 查询 scheduled_tasks
- **WHEN** API 需要查询异步任务
- **THEN** 使用 `.from("scheduled_tasks")` 而非 `.from("tasks")`

#### Scenario: 查询每日周期任务
- **WHEN** API 需要查询每日任务
- **THEN** 使用 `.from("periodic_tasks")` 并添加 `.eq("period_type", "daily")` 过滤

#### Scenario: 查询学习计划
- **WHEN** API 需要查询学习计划
- **THEN** 使用 `.from("learning_path_progress")` 而非 `.from("learning_plans")`

### Requirement: TypeScript 接口与数据库列名一致性

所有 TypeScript 接口定义 SHALL 与对应数据库表的列名完全匹配。

#### Scenario: Task 接口
- **WHEN** 定义 Task 接口用于 scheduled_tasks 表
- **THEN** 字段名使用 `task_type`（非 `type`）、`title`（非 `name`），且不包含 `payload`/`result`/`error` 等不存在的列

## MODIFIED Requirements

### Requirement: Task 类型定义

`shared/types/common.ts` 中的 `Task` 接口需更新为匹配 `scheduled_tasks` 表结构：

| 旧字段 | 新字段 | 类型 |
|--------|--------|------|
| `type` | `task_type` | `"one_time" \| "long_term" \| "periodic" \| "learning" \| "async"` |
| `name` | `title` | `string` |
| `payload` | _(删除)_ | 无对应列 |
| `result` | _(删除)_ | 无对应列 |
| `error` | _(删除)_ | 无对应列 |
| _(新增)_ | `queue_id` | `string` |
| _(新增)_ | `queue_level` | `number` |
| _(新增)_ | `position` | `number` |
| _(新增)_ | `estimated_duration` | `number` |
| _(新增)_ | `actual_duration` | `number` |
| _(新增)_ | `deadline` | `string` |
| _(新增)_ | `priority` | `number` |
| _(新增)_ | `progress_percentage` | `number` |
| _(新增)_ | `context` | `string` |
| _(新增)_ | `notes` | `string` |
| _(新增)_ | `scheduled_start` | `string` |
| _(新增)_ | `scheduled_end` | `string` |
| _(新增)_ | `completed_at` | `string` |
| _(新增)_ | `deleted_at` | `string` |

### Requirement: DailyTask → PeriodicTask 映射

`daily_tasks` 的所有操作需映射到 `periodic_tasks`：

| 旧字段 | 新字段 | 说明 |
|--------|--------|------|
| `task_date` | `period_start` + `period_end` | 单日 → 日期范围（同一天） |
| `task_type` | `task_type` | 不变 |
| `target` | `target` | 不变 |
| `progress` | `progress` | 不变 |
| `xp_reward` | `xp_reward` | 不变 |
| `status` | `status` | 不变 |
| _(新增)_ | `period_type` | 固定为 `'daily'` |
| _(新增)_ | `pass_points` | 默认 10 |

### Requirement: LearningPlan → LearningPathProgress 映射

`learning_plans` 的所有操作需映射到 `learning_path_progress`：

| 旧字段 | 新字段 | 说明 |
|--------|--------|------|
| `plan_date` | _(无直接对应)_ | 需通过 `started_at` 或其他方式处理 |
| `planned_nodes` | `planned_nodes` | 不变 |
| `planned_duration` | `planned_duration` | 不变 |
| `actual_duration` | `time_spent` | 列名变更 |
| `status` | `status` | 不变 |
| `notes` | `notes` | 不变 |
| `path_id` | `path_id` | 不变 |
| _(新增)_ | `node_id` | 必填，需确认如何处理 |
| _(新增)_ | `progress_percentage` | 0-100 |

## REMOVED Requirements

### Requirement: 旧 TaskPayload/TaskResult 类型
**Reason**: `scheduled_tasks` 表无 `payload`/`result` 列，任务处理器的上下文信息通过 `context`（TEXT）字段传递
**Migration**: 将 `payload` 中的关键信息序列化存入 `context` 字段，或通过关联表获取
