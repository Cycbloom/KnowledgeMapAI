# Tasks

- [x] Task 1: 创建 taskKnowledgePointService（从 scheduler/knowledgePoints.ts 提取）
  - [x] SubTask 1.1: 创建 `api/services/scheduler/taskKnowledgePointService.ts`，提取任务-知识点关联 CRUD + is_primary 互斥逻辑
  - [x] SubTask 1.2: 在 `api/services/scheduler/index.ts` 中添加导出

- [x] Task 2: 创建 notificationService（从 notifications.ts 提取）
  - [x] SubTask 2.1: 创建 `api/services/common/notificationService.ts`，提取通知 CRUD + 设置管理逻辑
  - [x] SubTask 2.2: 在 `api/services/common/index.ts` 中添加导出

- [x] Task 3: 创建 taskDependencyService（从 scheduler/dependencies.ts 提取）
  - [x] SubTask 3.1: 创建 `api/services/scheduler/taskDependencyService.ts`，提取依赖 CRUD + 循环依赖检测
  - [x] SubTask 3.2: 在 `api/services/scheduler/index.ts` 中添加导出

- [x] Task 4: 创建 taskLinkService（从 scheduler/links.ts 提取）
  - [x] SubTask 4.1: 创建 `api/services/scheduler/taskLinkService.ts`，提取链接 CRUD + position 自动计算
  - [x] SubTask 4.2: 在 `api/services/scheduler/index.ts` 中添加导出

- [x] Task 5: 创建 timeSlotService（从 scheduler/timeSlots.ts 提取）
  - [x] SubTask 5.1: 创建 `api/services/scheduler/timeSlotService.ts`，提取时间段 CRUD + 冲突检测
  - [x] SubTask 5.2: 在 `api/services/scheduler/index.ts` 中添加导出

- [x] Task 6: 创建 regionService（从 regions.ts 提取）
  - [x] SubTask 6.1: 创建 `api/services/graph/regionService.ts`，提取区域 CRUD（基于 settings JSON）
  - [x] SubTask 6.2: 在 `api/services/graph/index.ts` 中添加导出

- [x] Task 7: 扩展 taskService（补充 scheduler/tasks.ts 剩余 DB 操作）
  - [x] SubTask 7.1: 在 `api/services/scheduler/taskService.ts` 中添加 createTaskFull 和 getTaskStatus 方法

- [x] Task 8: 精简 scheduler/knowledgePoints.ts 路由
  - [x] SubTask 8.1: 所有路由改为调用 taskKnowledgePointService 对应方法

- [x] Task 9: 精简 notifications.ts 路由
  - [x] SubTask 9.1: 所有路由改为调用 notificationService 对应方法

- [x] Task 10: 精简 scheduler/dependencies.ts 路由
  - [x] SubTask 10.1: 所有路由改为调用 taskDependencyService 对应方法

- [x] Task 11: 精简 scheduler/links.ts 路由
  - [x] SubTask 11.1: 所有路由改为调用 taskLinkService 对应方法

- [x] Task 12: 精简 scheduler/timeSlots.ts 路由
  - [x] SubTask 12.1: 所有路由改为调用 timeSlotService 对应方法

- [x] Task 13: 精简 regions.ts 路由
  - [x] SubTask 13.1: 所有路由改为调用 regionService 对应方法

- [x] Task 14: 精简 scheduler/tasks.ts 剩余路由
  - [x] SubTask 14.1: 剩余直接 DB 调用的路由改为调用 taskService 对应方法

- [x] Task 15: 更新服务导出
  - [x] SubTask 15.1: 确认所有新服务的 index.ts 导出已更新

- [x] Task 16: 验证构建和类型检查
  - [x] SubTask 16.1: 执行 `npm run check` 确认无类型错误
  - [x] SubTask 16.2: 执行 `npm run lint` 确认无 lint 错误

# Task Dependencies
- [Task 8] depends on [Task 1]
- [Task 9] depends on [Task 2]
- [Task 10] depends on [Task 3]
- [Task 11] depends on [Task 4]
- [Task 12] depends on [Task 5]
- [Task 13] depends on [Task 6]
- [Task 14] depends on [Task 7]
- [Task 15] depends on [Task 1-7]
- [Task 16] depends on [Task 8-14]
- [Task 1-7] 可并行
- [Task 8-14] 可并行（各自依赖对应的 service 创建完成）
