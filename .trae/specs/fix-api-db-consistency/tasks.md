# Tasks

- [x] Task 1: 更新共享类型定义
  - [x] SubTask 1.1: 更新 `shared/types/common.ts` 中的 `Task` 接口，匹配 `scheduled_tasks` 表结构
  - [x] SubTask 1.2: 删除或标记废弃 `TaskPayload`、`TaskResult` 接口（如无其他引用）
  - [x] SubTask 1.3: 新增 `PeriodicTask` 接口，匹配 `periodic_tasks` 表结构
  - [x] SubTask 1.4: 新增 `LearningPathProgress` 接口（如不存在），匹配 `learning_path_progress` 表结构

- [x] Task 2: 修复 `api/services/taskService.ts`
  - [x] SubTask 2.1: 更新本地 `Task` 接口（已部分完成，需与 shared 类型统一）
  - [x] SubTask 2.2: 修复 `createTask` 方法 — `.from("tasks")` → `.from("scheduled_tasks")`，字段映射 `type` → `task_type`、`name` → `title`、移除 `payload`
  - [x] SubTask 2.3: 修复 `updateTaskStatus` 方法 — `.from("tasks")` → `.from("scheduled_tasks")`，移除 `result`/`error` 字段
  - [x] SubTask 2.4: 确认 `getTasks`/`getTask`/`getPendingTasks`/`retryTask`/`deleteTask` 已修复（之前已部分完成）

- [x] Task 3: 修复 `api/database/adapters/supabase.ts`
  - [x] SubTask 3.1: 修复 `getAsyncTasks` — `.from('tasks')` → `.from('scheduled_tasks')`，字段映射
  - [x] SubTask 3.2: 修复 `getAsyncTask` — 同上
  - [x] SubTask 3.3: 修复 `createAsyncTask` — 同上，移除 `payload`/`result` 字段
  - [x] SubTask 3.4: 修复 `updateAsyncTask` — 同上，移除 `result`/`error` 字段
  - [x] SubTask 3.5: 修复 `deleteAsyncTask` — `.from('tasks')` → `.from('scheduled_tasks')`

- [x] Task 4: 修复 `api/database/interface.ts`
  - [x] SubTask 4.1: 更新 `Task` 类型导入，使用新的接口定义
  - [x] SubTask 4.2: 更新 `getAsyncTasks`/`getAsyncTask`/`createAsyncTask`/`updateAsyncTask` 方法签名

- [x] Task 5: 修复 `api/jobs/worker.ts`
  - [x] SubTask 5.1: 修复任务查询 — `.from('tasks')` → `.from('scheduled_tasks')`
  - [x] SubTask 5.2: 适配字段映射 `type` → `task_type`

- [x] Task 6: 修复 `api/jobs/taskProcessor.ts`
  - [x] SubTask 6.1: 将 `task.type` 引用改为 `task.task_type`
  - [x] SubTask 6.2: 将 `task.payload` 引用改为从 `task.context` 解析或通过其他方式获取
  - [x] SubTask 6.3: 更新事件发布中的字段名

- [x] Task 7: 修复 `api/services/achievementService.ts`
  - [x] SubTask 7.1: 将所有 `.from('daily_tasks')` 改为 `.from('periodic_tasks')`，添加 `.eq('period_type', 'daily')`
  - [x] SubTask 7.2: 适配字段映射 `task_date` → `period_start`/`period_end`
  - [x] SubTask 7.3: 更新 `initDailyTasks` 方法中的 insert 逻辑
  - [x] SubTask 7.4: 更新 `getDailyTasks`/`updateDailyTask`/`updateDailyTaskProgress` 方法

- [x] Task 8: 修复 `api/services/scheduler/periodicTaskService.ts`
  - [x] SubTask 8.1: 修复 `checkDailyTaskStreak` — `.from('daily_tasks')` → `.from('periodic_tasks')`，添加 `.eq('period_type', 'daily')`

- [x] Task 9: 修复 `api/services/common/backupService.ts`
  - [x] SubTask 9.1: 将 `.from('daily_tasks')` 改为 `.from('periodic_tasks')`，添加 `.eq('period_type', 'daily')`
  - [x] SubTask 9.2: 更新接口定义和数据组装逻辑

- [x] Task 10: 修复 `api/services/study/learningPathService.ts`
  - [x] SubTask 10.1: 将所有 `.from("learning_plans")` 改为 `.from("learning_path_progress")`
  - [x] SubTask 10.2: 适配字段映射 `actual_duration` → `time_spent`、`plan_date` → 其他字段
  - [x] SubTask 10.3: 更新 `LearningPlan` 接口为 `LearningPathProgress`
  - [x] SubTask 10.4: 更新 `createDailyPlan`/`getDailyPlan`/`getDailyPlans`/`updatePlanStatus`/`generateDailyPlans` 方法

- [x] Task 11: 修复 `api/routes/data.ts`
  - [x] SubTask 11.1: 将 `tasks` 表名改为 `scheduled_tasks`
  - [x] SubTask 11.2: 将 `daily_tasks` 表名改为 `periodic_tasks`

- [x] Task 12: 修复 `api/schemas/index.ts`
  - [x] SubTask 12.1: 更新 `createTaskSchema` — `type` → `task_type`、`payload` → 移除、新增必要字段

- [x] Task 13: 验证所有修复
  - [x] SubTask 13.1: 运行 `npm run check` 确认类型检查通过
  - [x] SubTask 13.2: 运行 `npm run lint` 确认代码规范通过
  - [x] SubTask 13.3: 启动开发服务器验证无运行时错误

# Task Dependencies

- [Task 1] 是所有后续任务的基础（类型定义先行）
- [Task 2] 依赖 [Task 1]
- [Task 3] 依赖 [Task 1]
- [Task 4] 依赖 [Task 1]
- [Task 5] 依赖 [Task 1]
- [Task 6] 依赖 [Task 1]
- [Task 7-11] 可并行执行（互不依赖）
- [Task 12] 依赖 [Task 1]
- [Task 13] 依赖所有前置任务
