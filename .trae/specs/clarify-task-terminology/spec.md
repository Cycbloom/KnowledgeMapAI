# 任务术语澄清与重命名 Spec

## Why

当前项目中存在两种性质完全不同的"任务"，但命名上存在歧义：

1. **`scheduled_tasks`**（用户任务）：用户手动创建或系统推荐的学习任务，参与队列调度（Q0/Q1/Q2）、SM2 间隔重复、专注会话等。但"scheduled"这个词容易与"定时执行"混淆，且系统任务也有 `scheduled_at` 字段。
2. **`system_tasks`**（系统任务）：后台自动执行的任务，如 AI 内容生成、图谱扩展、知识同步等，用户不可见，不参与调度。

核心问题：
- `ScheduledTask` 类型名不能清晰表达"用户参与调度的任务"含义
- 代码中频繁使用 `task` 一词，无法区分是 `UserTask` 还是 `SystemTask`
- `scheduled_tasks` 表名与 `system_tasks.scheduled_at` 字段语义冲突
- 新开发者难以快速理解两种任务的本质区别

## What Changes

- **重命名数据库表** `scheduled_tasks` → `user_tasks` **BREAKING**
- **重命名 TypeScript 类型** `ScheduledTask` → `UserTask` **BREAKING**
- **重命名相关类型** `CreateScheduledTaskData` → `CreateUserTaskData`、`UpdateScheduledTaskData` → `UpdateUserTaskData` 等
- **更新所有服务、API、前端组件** 中的引用
- **更新数据库迁移文件** 中的表名和注释
- **建立术语规范** 确保未来开发中两种任务的命名一致

## Impact

- Affected specs: 任务调度系统、图谱自动扩展、AI 任务处理、专注模式
- Affected code:
  - `supabase/migrations/07_scheduler_tasks.sql` - 数据库表定义
  - `supabase/migrations/19_system_tasks.sql` - 系统任务表
  - `shared/types/scheduler.ts` - 类型定义
  - `api/services/scheduler/*` - 所有调度服务
  - `api/routes/scheduler/*` - 所有调度 API
  - `src/services/api/modules/scheduler/*` - 前端 API 模块
  - `src/hooks/scheduler/*` - React Hooks
  - `src/components/Scheduler/*` - 前端组件
  - `src/pages/*` - 页面组件

---

## 术语定义

### 用户任务（User Task）

| 属性 | 说明 |
|------|------|
| 数据库表 | `user_tasks`（原 `scheduled_tasks`） |
| TypeScript 类型 | `UserTask`（原 `ScheduledTask`） |
| 核心特征 | 用户可见、参与调度、有队列层级 |
| 生命周期 | 用户创建 → 排队 → 执行 → 完成/取消 |
| 典型场景 | 学习任务、复习任务、日常任务、长期任务 |
| 调度参与 | ✅ 参与队列调度（Q0/Q1/Q2）、SM2 间隔重复 |
| 用户可见 | ✅ 在任务列表、看板、时间轴中显示 |
| 来源 | `user`（手动创建）、`system_recommendation`（系统推荐）、`import`、`template` |

### 系统任务（System Task）

| 属性 | 说明 |
|------|------|
| 数据库表 | `system_tasks` |
| TypeScript 类型 | `SystemTask` |
| 核心特征 | 用户不可见、后台执行、有重试机制 |
| 生命周期 | 系统创建 → 排队 → 执行 → 完成/失败/重试 |
| 典型场景 | 图谱扩展、AI 内容生成、知识同步、复习生成 |
| 调度参与 | ❌ 不参与用户队列调度 |
| 用户可见 | ❌ 仅在管理界面可见（可选） |
| 任务类型 | `graph_expansion`、`ai_generation`、`knowledge_sync`、`review_generation` |

### 命名对照表

| 概念 | 旧命名 | 新命名 |
|------|--------|--------|
| 用户任务表 | `scheduled_tasks` | `user_tasks` |
| 用户任务类型 | `ScheduledTask` | `UserTask` |
| 创建用户任务数据 | `CreateScheduledTaskData` | `CreateUserTaskData` |
| 更新用户任务数据 | `UpdateScheduledTaskData` | `UpdateUserTaskData` |
| 用户任务详情 | `TaskDetail`（extends ScheduledTask） | `UserTaskDetail`（extends UserTask） |
| 用户任务统计 | `TaskStats` | `UserTaskStats` |
| 创建用户任务 mutation | `useCreateScheduledTaskMutation` | `useCreateUserTaskMutation` |
| 更新用户任务 mutation | `useUpdateScheduledTaskMutation` | `useUpdateUserTaskMutation` |
| 队列数据 | `QueueData`（含 ScheduledTask[]） | `QueueData`（含 UserTask[]） |
| 系统任务表 | `system_tasks` | `system_tasks`（不变） |
| 系统任务类型 | `SystemTask` | `SystemTask`（不变） |

---

## ADDED Requirements

### Requirement: 术语规范

系统 SHALL 在所有代码、文档、注释中遵循以下术语规范：

1. **UserTask**：指用户参与调度的任务，存储在 `user_tasks` 表
2. **SystemTask**：指系统后台任务，存储在 `system_tasks` 表
3. **禁止使用模糊的 `task` 一词**：在类型名、函数名、变量名中，必须明确使用 `userTask` 或 `systemTask`
4. **例外**：通用工具函数（如 `taskId` 参数）可使用 `task`，但需在上下文中明确类型

#### Scenario: 新开发者阅读代码

- **WHEN** 新开发者阅读代码中涉及任务的代码
- **THEN** 能通过 `UserTask` / `SystemTask` 命名立即区分两种任务
- **AND** 不需要查看表结构或注释来理解任务类型

---

### Requirement: 数据库表重命名

系统 SHALL 将 `scheduled_tasks` 表重命名为 `user_tasks`。

#### 修改内容

1. 表名 `scheduled_tasks` → `user_tasks`
2. 所有外键引用更新（`task_executions`、`task_subtasks`、`task_dependencies` 等表的 `task_id` 仍指向 `user_tasks`）
3. 表注释更新为更清晰的描述

#### Scenario: 数据库查询

- **WHEN** 查询用户参与调度的任务
- **THEN** 使用 `FROM user_tasks` 而非 `FROM scheduled_tasks`
- **AND** 表名清晰表达"用户任务"语义

---

### Requirement: TypeScript 类型重命名

系统 SHALL 将所有 `ScheduledTask` 相关类型重命名为 `UserTask` 系列。

#### 重命名清单

| 旧类型 | 新类型 |
|--------|--------|
| `ScheduledTask` | `UserTask` |
| `CreateScheduledTaskData` | `CreateUserTaskData` |
| `UpdateScheduledTaskData` | `UpdateUserTaskData` |
| `TaskDetail`（extends ScheduledTask） | `UserTaskDetail`（extends UserTask） |
| `TaskStats` | `UserTaskStats` |
| `TaskFilters` | `UserTaskFilters` |
| `TaskStatus` | `UserTaskStatus` |

#### Scenario: TypeScript 开发

- **WHEN** 开发者导入任务类型
- **THEN** 使用 `import type { UserTask } from "@shared/types"` 表示用户任务
- **AND** 使用 `import type { SystemTask } from "@shared/types"` 表示系统任务
- **AND** 两种类型命名对称，一目了然

---

## MODIFIED Requirements

### Requirement: 数据库迁移文件

`07_scheduler_tasks.sql` 中的 `scheduled_tasks` 表定义需更新为 `user_tasks`，并更新所有关联表的外键引用。

### Requirement: API 路由

所有 `/scheduler/tasks` 路由中的 `scheduled_tasks` 表引用更新为 `user_tasks`。

### Requirement: 前端组件

所有使用 `ScheduledTask` 类型的组件更新为 `UserTask`。

---

## REMOVED Requirements

无删除的需求。此变更仅为重命名，不删除任何功能。
