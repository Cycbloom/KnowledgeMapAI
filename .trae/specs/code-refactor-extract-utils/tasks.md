# Tasks

- [x] Task 1: 扩展节点数据转换工具函数
  - [x] SubTask 1.1: 在 `api/utils/nodeHelpers.ts` 中完善 `buildNodeFromGraphNode` 函数
  - [x] SubTask 1.2: 添加 `buildNodesFromGraphNodes` 批量转换函数
  - [x] SubTask 1.3: 确保所有使用节点转换的地方引用该工具函数

- [x] Task 2: 创建软删除工具函数
  - [x] SubTask 2.1: 创建 `api/utils/softDelete.ts` 文件
  - [x] SubTask 2.2: 实现 `softDelete(supabase, table, id)` 单条软删除
  - [x] SubTask 2.3: 实现 `softDeleteBatch(supabase, table, ids)` 批量软删除
  - [x] SubTask 2.4: 实现 `softDeleteByCondition(supabase, table, condition)` 条件软删除

- [x] Task 3: 扩展缓存失效封装方法
  - [x] SubTask 3.1: 在 `api/services/cache.ts` 添加 `invalidateGraphCache(userId, graphId)` 方法
  - [x] SubTask 3.2: 添加 `invalidateUserGraphsCache(userId)` 方法
  - [x] SubTask 3.3: 添加 `invalidateStudyCache(graphId)` 方法

- [x] Task 4: 统一服务层日志输出
  - [x] SubTask 4.1: 在 `graphService.ts` 中替换 console.log/error 为 logger
  - [x] SubTask 4.2: 在 `graphNodeService.ts` 中替换 console.log/error 为 logger
  - [x] SubTask 4.3: 在 `edgeService.ts` 中替换 console.log/error 为 logger
  - [x] SubTask 4.4: 在 `studyService.ts` 中替换 console.log/error 为 logger
  - [x] SubTask 4.5: 在其他服务文件中统一日志输出

- [x] Task 5: 重构路由层使用工具函数
  - [x] SubTask 5.1: 重构 `api/routes/nodes.ts` 使用 `buildNodeFromGraphNode`
  - [x] SubTask 5.2: 重构 `api/routes/nodes.ts` 使用缓存失效封装方法
  - [x] SubTask 5.3: 重构 `api/routes/graphs.ts` 使用缓存失效封装方法

- [x] Task 6: 重构服务层使用工具函数
  - [x] SubTask 6.1: 重构 `graphNodeService.ts` 使用 `buildNodeFromGraphNode`
  - [x] SubTask 6.2: 重构 `graphService.ts` 使用 `buildNodeFromGraphNode`
  - [x] SubTask 6.3: 重构 `edgeService.ts` 使用软删除工具函数
  - [x] SubTask 6.4: 重构 `graphNodeService.ts` 使用软删除工具函数

- [x] Task 7: 拆分任务服务文件
  - [x] SubTask 7.1: 创建 `api/services/taskProcessors/` 目录
  - [x] SubTask 7.2: 创建 `batchGenerateCardsProcessor.ts` 处理卡片批量生成
  - [x] SubTask 7.3: 创建 `recursiveGraphProcessor.ts` 处理递归图谱生成
  - [x] SubTask 7.4: 创建 `infiniteExpansionProcessor.ts` 处理无限扩展任务
  - [x] SubTask 7.5: 重构 `taskService.ts` 使用处理器模式

- [x] Task 8: 验证与测试
  - [x] SubTask 8.1: 验证节点创建和查询功能正常
  - [x] SubTask 8.2: 验证软删除功能正常
  - [x] SubTask 8.3: 验证缓存失效逻辑正确
  - [x] SubTask 8.4: 验证日志输出正常
  - [x] SubTask 8.5: 运行 TypeScript 类型检查

# Task Dependencies

- [Task 5] depends on [Task 1, Task 3]
- [Task 6] depends on [Task 1, Task 2, Task 3]
- [Task 7] depends on [Task 4]
- [Task 8] depends on [Task 5, Task 6, Task 7]
