# Tasks

- [x] Task 1: 创建 graphExpansionService（从 graphs/expansion.ts 提取）
  - [x] SubTask 1.1: 创建 `api/services/graph/graphExpansionService.ts`，提取批量初始化、单个初始化、骨干验证、骨干修复逻辑
  - [x] SubTask 1.2: 在 `api/services/graph/index.ts` 中添加导出

- [x] Task 2: 创建 characterService（从 story/characters.ts 提取）
  - [x] SubTask 2.1: 创建 `api/services/story/characterService.ts`，提取角色 CRUD + 关系/出场统计
  - [x] SubTask 2.2: 在 `api/services/story/index.ts` 中添加导出

- [x] Task 3: 创建 calendarService（从 calendar.ts 提取）
  - [x] SubTask 3.1: 创建 `api/services/scheduler/calendarService.ts`，提取日历导出/订阅/事件查询 + ICS 生成
  - [x] SubTask 3.2: 在 `api/services/scheduler/index.ts` 中添加导出

- [x] Task 4: 创建 learningPathRouteService（从 learningPath.ts 提取）
  - [x] SubTask 4.1: 创建 `api/services/study/learningPathRouteService.ts`，提取路径生成/进度/问题生成逻辑
  - [x] SubTask 4.2: 在 `api/services/study/index.ts` 中添加导出

- [x] Task 5: 精简 graphs/expansion.ts 路由
  - [x] SubTask 5.1: 直接 DB 调用的路由改为调用 graphExpansionService 对应方法

- [x] Task 6: 精简 story/characters.ts 路由
  - [x] SubTask 6.1: 所有路由改为调用 characterService 对应方法

- [x] Task 7: 精简 calendar.ts 路由
  - [x] SubTask 7.1: 所有路由改为调用 calendarService 对应方法

- [x] Task 8: 精简 learningPath.ts 路由
  - [x] SubTask 8.1: 所有路由改为调用 learningPathRouteService 对应方法

- [x] Task 9: 更新服务导出
  - [x] SubTask 9.1: 确认所有新服务的 index.ts 导出已更新

- [x] Task 10: 验证构建和类型检查
  - [x] SubTask 10.1: 执行 `npm run check` 确认无类型错误
  - [x] SubTask 10.2: 执行 `npm run lint` 确认无 lint 错误

# Task Dependencies
- [Task 5] depends on [Task 1]
- [Task 6] depends on [Task 2]
- [Task 7] depends on [Task 3]
- [Task 8] depends on [Task 4]
- [Task 9] depends on [Task 1-4]
- [Task 10] depends on [Task 5-8]
- [Task 1-4] 可并行
- [Task 5-8] 可并行（各自依赖对应的 service 创建完成）
