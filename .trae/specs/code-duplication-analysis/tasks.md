# Tasks

- [x] Task 1: 创建 AI 配置注入工具函数
  - [x] SubTask 1.1: 在 `src/services/api/client.ts` 中添加 `injectAIConfig` 函数
  - [x] SubTask 1.2: 重构 `src/services/api/ai.ts` 使用新工具函数
  - [x] SubTask 1.3: 移除重复的配置注入代码

- [x] Task 2: 创建统一错误处理封装
  - [x] SubTask 2.1: 在 `src/utils/` 创建 `asyncHandler.ts` 文件
  - [x] SubTask 2.2: 实现 `withErrorHandling` 高阶函数
  - [x] SubTask 2.3: 实现 `useAsyncOperation` React Hook
  - [x] SubTask 2.4: 重构 `useGraphNodeOperations.ts` 使用新封装
  - [x] SubTask 2.5: 重构 `useGraphAIOperations.ts` 使用新封装
  - [x] SubTask 2.6: 重构 `useKnowledgePointOperations.ts` 使用新封装

- [x] Task 3: 提取相似知识点搜索工具
  - [x] SubTask 3.1: 在 `api/utils/` 创建 `similaritySearch.ts` 文件
  - [x] SubTask 3.2: 实现 `searchSimilarKnowledgePoints` 函数
  - [x] SubTask 3.3: 实现 `checkAndReuseKnowledgePoint` 函数
  - [x] SubTask 3.4: 重构 `autoGraphService.ts` 使用新工具
  - [x] SubTask 3.5: 重构 `knowledgePointService.ts` 使用新工具

- [x] Task 4: 统一层级计算函数
  - [x] SubTask 4.1: 在 `src/lib/graphUtils.ts` 中完善层级计算函数
  - [x] SubTask 4.2: 在 `api/utils/` 创建共享层级工具文件或导出
  - [x] SubTask 4.3: 重构 `api/services/taskProcessors/utils.ts` 使用共享函数
  - [x] SubTask 4.4: 确保前后端层级定义一致

- [x] Task 5: 创建分页查询工具函数
  - [x] SubTask 5.1: 在 `api/utils/` 创建 `pagination.ts` 文件
  - [x] SubTask 5.2: 实现 `buildPaginationQuery` 函数
  - [x] SubTask 5.3: 实现 `getPaginationParams` 函数
  - [x] SubTask 5.4: 重构相关 service 文件使用新工具

- [x] Task 6: 创建 RPC 回退模式封装
  - [x] SubTask 6.1: 在 `api/utils/` 创建 `rpcFallback.ts` 文件
  - [x] SubTask 6.2: 实现 `withRpcFallback` 高阶函数
  - [x] SubTask 6.3: 重构 `graphService.ts` 使用新封装

- [x] Task 7: 创建上下文构建工具
  - [x] SubTask 7.1: 在 `api/services/ai/utils.ts` 中完善 `buildTutorContext` 函数
  - [x] SubTask 7.2: 添加 `buildNodeContext` 函数
  - [x] SubTask 7.3: 重构 `ragService.ts` 使用新工具
  - [x] SubTask 7.4: 在前端创建对应的上下文构建工具

- [x] Task 8: 验证与测试
  - [x] SubTask 8.1: 运行 TypeScript 类型检查
  - [x] SubTask 8.2: 验证 AI 功能正常工作
  - [x] SubTask 8.3: 验证错误处理和消息提示正常
  - [x] SubTask 8.4: 验证相似知识点搜索功能正常
  - [x] SubTask 8.5: 验证分页功能正常

# Task Dependencies

- [Task 2] depends on [Task 1] (错误处理封装可能需要 AI 配置工具)
- [Task 3] depends on [Task 1] (相似搜索依赖 AI 配置)
- [Task 7] depends on [Task 4] (上下文构建可能需要层级信息)
- [Task 8] depends on [Task 1, Task 2, Task 3, Task 4, Task 5, Task 6, Task 7]
