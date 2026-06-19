# Tasks

- [x] Task 1: 创建 quizSetsService（从 quizSets.ts 提取）
  - [x] SubTask 1.1: 创建 `api/services/quiz/quizSetsService.ts`，提取测验集合 CRUD + 卡片管理逻辑
  - [x] SubTask 1.2: 提取 AI 卡片生成/重新生成逻辑
  - [x] SubTask 1.3: 创建 `api/services/quiz/index.ts` 导出

- [x] Task 2: 创建 dataService（从 data.ts 提取）
  - [x] SubTask 2.1: 创建 `api/services/graph/dataService.ts`，提取导出逻辑（JSON/Markdown/PDF）
  - [x] SubTask 2.2: 提取 Markdown 导入解析 + 批量创建逻辑

- [x] Task 3: 创建 syncService（从 sync.ts 提取）
  - [x] SubTask 3.1: 创建 `api/services/sync/syncService.ts`，提取多表增量同步逻辑
  - [x] SubTask 3.2: 创建 `api/services/sync/index.ts` 导出

- [x] Task 4: 创建 nodesService（从 nodes.ts 提取）
  - [x] SubTask 4.1: 创建 `api/services/graph/nodesService.ts`，提取节点 CRUD + embedding 生成 + 相似节点复用
  - [x] SubTask 4.2: 提取边创建/删除 + AI 摘要生成逻辑

- [x] Task 5: 创建 subtaskService（从 scheduler/subtasks.ts 提取）
  - [x] SubTask 5.1: 创建 `api/services/scheduler/subtaskService.ts`，提取子任务 CRUD + 知识点同步逻辑
  - [x] SubTask 5.2: 提取状态转换 + 掌握度更新逻辑

- [x] Task 6: 创建 graphRelationsService（从 graphRelations.ts 提取）
  - [x] SubTask 6.1: 创建 `api/services/graph/graphRelationsService.ts`，提取关系 CRUD + 批量创建
  - [x] SubTask 6.2: 提取前置知识图谱创建 + AI 关系发现逻辑

- [x] Task 7: 扩展 graphCrudService（从 graphs/crud.ts 提取剩余逻辑）
  - [x] SubTask 7.1: 在 `api/services/graph/graphCrudService.ts` 中添加剩余路由的 DB 操作方法

- [x] Task 8: 精简 quizSets.ts 路由
  - [x] SubTask 8.1: 所有路由改为调用 quizSetsService 对应方法

- [x] Task 9: 精简 data.ts 路由
  - [x] SubTask 9.1: 所有路由改为调用 dataService 对应方法

- [x] Task 10: 精简 sync.ts 路由
  - [x] SubTask 10.1: 所有路由改为调用 syncService 对应方法

- [x] Task 11: 精简 nodes.ts 路由
  - [x] SubTask 11.1: 所有路由改为调用 nodesService 对应方法

- [x] Task 12: 精简 scheduler/subtasks.ts 路由
  - [x] SubTask 12.1: 所有路由改为调用 subtaskService 对应方法

- [x] Task 13: 精简 graphRelations.ts 路由
  - [x] SubTask 13.1: 所有路由改为调用 graphRelationsService 对应方法

- [x] Task 14: 精简 graphs/crud.ts 剩余路由
  - [x] SubTask 14.1: 剩余直接 DB 调用的路由改为调用 graphCrudService 对应方法

- [x] Task 15: 更新服务导出
  - [x] SubTask 15.1: 在对应 index.ts 中添加新服务导出

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
