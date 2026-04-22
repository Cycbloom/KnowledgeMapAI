# Tasks

## Phase 1: 数据库结构修改

- [x] Task 1: 创建 system_tasks 表
  - [x] SubTask 1.1: 在 `supabase/migrations/` 中创建新迁移文件 `19_system_tasks.sql`
  - [x] SubTask 1.2: 定义 `system_tasks` 表结构
  - [x] SubTask 1.3: 添加必要的索引
  - [x] SubTask 1.4: 添加 RLS 策略

- [x] Task 2: 修改 scheduled_tasks 表
  - [x] SubTask 2.1: 添加 `source` 字段（user | import | template | system_recommendation）
  - [x] SubTask 2.2: 更新表注释

## Phase 2: 类型定义

- [x] Task 3: 更新类型定义
  - [x] SubTask 3.1: 在 `shared/types/scheduler.ts` 中添加 `SystemTask` 类型
  - [x] SubTask 3.2: 添加 `SystemTaskType` 枚举
  - [x] SubTask 3.3: 添加 `SystemTaskStatus` 类型
  - [x] SubTask 3.4: 更新 `ScheduledTask` 类型，添加 `source` 字段

## Phase 3: 后端服务实现

- [x] Task 4: 创建系统任务服务
  - [x] SubTask 4.1: 创建 `api/services/scheduler/systemTaskService.ts`
  - [x] SubTask 4.2: 实现 `createTask` 方法
  - [x] SubTask 4.3: 实现 `getPendingTasks` 方法
  - [x] SubTask 4.4: 实现 `startTask`、`completeTask`、`failTask` 方法
  - [x] SubTask 4.5: 实现重试逻辑

- [x] Task 5: 修改自动任务生成器
  - [x] SubTask 5.1: 修改 `autoTaskGenerator.ts`
  - [x] SubTask 5.2: 学习/复习任务使用 `scheduled_tasks` 表，标记 `source = 'system_recommendation'`
  - [x] SubTask 5.3: 后台处理任务使用 `system_tasks` 表

- [x] Task 6: 修改智能任务链接器
  - [x] SubTask 6.1: 修改 `smartTaskLinker.ts`
  - [x] SubTask 6.2: 图谱学习任务使用 `scheduled_tasks` 表
  - [x] SubTask 6.3: 后台同步任务使用 `system_tasks` 表

## Phase 4: API 层更新

- [x] Task 7: 创建系统任务 API
  - [x] SubTask 7.1: 创建 `api/routes/scheduler/systemTasks.ts`
  - [x] SubTask 7.2: 实现 GET `/system-tasks` 获取系统任务列表
  - [x] SubTask 7.3: 实现 POST `/system-tasks` 创建系统任务
  - [x] SubTask 7.4: 实现 POST `/system-tasks/:id/retry` 重试任务

- [x] Task 8: 更新前端 API 服务
  - [x] SubTask 8.1: 创建 `src/services/api/modules/scheduler/systemTasks.ts`
  - [x] SubTask 8.2: 导出系统任务 API

## Phase 5: 前端组件更新

- [x] Task 9: 确保任务列表仅显示用户任务
  - [x] SubTask 9.1: 检查并确认队列视图过滤正确
  - [x] SubTask 9.2: 检查并确认看板视图过滤正确
  - [x] SubTask 9.3: 检查并确认时间轴视图过滤正确
  - [x] SubTask 9.4: 检查并确认列表视图过滤正确

- [ ] Task 10: 创建系统任务管理界面（可选）
  - [ ] SubTask 10.1: 创建 `SystemTaskList` 组件
  - [ ] SubTask 10.2: 显示系统任务状态和进度

---

# Task Dependencies

- Task 2 依赖 Task 1（数据库结构先行）
- Task 3 依赖 Task 1, 2（类型定义依赖数据库结构）
- Task 4, 5, 6 可并行执行，依赖 Task 3
- Task 7 依赖 Task 3, 4
- Task 8 依赖 Task 7
- Task 9 依赖 Task 5, 6（确保服务正确使用新表）
- Task 10 可选，依赖 Task 8
