# Tasks

- [x] Task 1: 扩展 taskService（从 scheduler/tasks.ts 提取）
  - [x] SubTask 1.1: 在 `api/services/scheduler/taskService.ts` 中添加 `listTasksWithStats` 方法 — 查询任务列表 + 子任务统计聚合
  - [x] SubTask 1.2: 添加 `getTaskDetail` 方法 — 跨 5 表聚合详情
  - [x] SubTask 1.3: 添加 `updateTaskProgress` 方法 — 含先读后写的累加逻辑（已存在，无需新增）
  - [x] SubTask 1.4: 添加 `moveTask` 方法 — 含 position 计算逻辑（已存在 moveTaskToQueue，无需新增）
  - [x] SubTask 1.5: 添加 `listQueuesWithStats` 方法 — 队列视图 + 子任务统计聚合

- [x] Task 2: 创建 progressPlanService（从 scheduler/progress.ts 提取）
  - [x] SubTask 2.1: 创建 `api/services/scheduler/progressPlanService.ts`，提取 5 个进度分配算法函数
  - [x] SubTask 2.2: 添加 `createProgressPlan` 方法 — 验证任务 → 生成分配 → 删除旧计划 → 批量插入 → 更新任务
  - [x] SubTask 2.3: 添加 `updateProgress` 方法 — 验证 → 更新计划 → 重算总进度 → 自动完成判定
  - [x] SubTask 2.4: 添加 `listProgressPlans` 和 `updateProgressPlan` 方法

- [x] Task 3: 创建 scheduleService（从 scheduler/schedules.ts 提取）
  - [x] SubTask 3.1: 创建 `api/services/scheduler/scheduleService.ts`，提取 `calculateNextRunAt` 函数
  - [x] SubTask 3.2: 添加 `createSchedule` 方法 — 创建调度 + 计算 next_run_at
  - [x] SubTask 3.3: 添加 `updateSchedule` 方法 — 更新调度 + 重算 next_run_at
  - [x] SubTask 3.4: 添加 `runSchedule` 方法 — 读调度+模板 → 创建任务 → 更新调度时间
  - [x] SubTask 3.5: 添加 `listSchedules` 和 `deleteSchedule` 方法

- [x] Task 4: 创建 templateService（从 scheduler/templates.ts 提取）
  - [x] SubTask 4.1: 创建 `api/services/scheduler/templateService.ts`，提取模板变量替换逻辑
  - [x] SubTask 4.2: 添加 `applyTemplate` 方法 — 读模板 → 变量替换 → 插入任务 → 更新 usage_count
  - [x] SubTask 4.3: 添加 `duplicateTemplate`、`setDefaultTemplate`、`getTemplateCategories` 方法
  - [x] SubTask 4.4: 添加 `listTemplates`、`createTemplate`、`updateTemplate`、`deleteTemplate` 方法

- [x] Task 5: 创建 structureService（从 story/structures.ts 提取）
  - [x] SubTask 5.1: 创建 `api/services/story/structureService.ts`，提取 `buildTree` 函数
  - [x] SubTask 5.2: 添加 `initializeFromTemplate` 方法 — 读模板 → 解析 beats → 批量插入 → 更新 parent → 构建树
  - [x] SubTask 5.3: 添加 `listStructures`、`createStructure`、`updateStructure`、`deleteStructure` 方法
  - [x] SubTask 5.4: 创建 `api/services/story/index.ts` 导出

- [x] Task 6: 精简 scheduler/tasks.ts 路由
  - [x] SubTask 6.1: 修改列表/队列路由，改为调用 `taskService.listTasksWithStats()` / `listQueuesWithStats()`
  - [x] SubTask 6.2: 修改详情路由，改为调用 `taskService.getTaskDetail()`
  - [x] SubTask 6.3: 修改进度更新路由，改为调用 `taskService.updateTaskProgress()`
  - [x] SubTask 6.4: 修改移动路由，改为调用 `taskService.moveTaskToQueue()`

- [x] Task 7: 精简 scheduler/progress.ts 路由
  - [x] SubTask 7.1: 修改所有路由改为调用 `progressPlanService` 对应方法
  - [x] SubTask 7.2: 移除路由文件中的 5 个分配算法函数

- [x] Task 8: 精简 scheduler/schedules.ts 路由
  - [x] SubTask 8.1: 修改所有路由改为调用 `scheduleService` 对应方法
  - [x] SubTask 8.2: 移除路由文件中的 `calculateNextRunAt` 函数

- [x] Task 9: 精简 scheduler/templates.ts 路由
  - [x] SubTask 9.1: 修改所有路由改为调用 `templateService` 对应方法
  - [x] SubTask 9.2: 移除路由文件中的模板变量替换逻辑

- [x] Task 10: 精简 story/structures.ts 路由
  - [x] SubTask 10.1: 修改所有路由改为调用 `structureService` 对应方法
  - [x] SubTask 10.2: 移除路由文件中的 `buildTree` 函数和模板初始化编排逻辑

- [x] Task 11: 更新服务导出
  - [x] SubTask 11.1: 在 `api/services/scheduler/index.ts` 中添加新服务导出
  - [x] SubTask 11.2: 确认 `api/services/story/index.ts` 导出 structureService

- [x] Task 12: 验证构建和类型检查
  - [x] SubTask 12.1: 执行 `npm run check` 确认无类型错误
  - [x] SubTask 12.2: 执行 `npm run lint` 确认无 lint 错误

# Task Dependencies
- [Task 6] depends on [Task 1] — 路由精简依赖 taskService 可用
- [Task 7] depends on [Task 2] — 路由精简依赖 progressPlanService 可用
- [Task 8] depends on [Task 3] — 路由精简依赖 scheduleService 可用
- [Task 9] depends on [Task 4] — 路由精简依赖 templateService 可用
- [Task 10] depends on [Task 5] — 路由精简依赖 structureService 可用
- [Task 11] depends on [Task 1-5] — 导出依赖服务文件创建
- [Task 12] depends on [Task 6-10] — 验证依赖所有变更完成
- [Task 1], [Task 2], [Task 3], [Task 4], [Task 5] 可并行
- [Task 6], [Task 7], [Task 8], [Task 9], [Task 10] 可并行（各自依赖对应的 service 创建完成）
