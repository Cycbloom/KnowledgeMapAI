# Tasks

## P0 — 高风险操作（数据丢失/不一致风险）

- [x] Task 1: 图谱版本回滚事务化
  - [x] SubTask 1.1: 修改 `graphVersionService.rollbackToSnapshot()` 使用 transactionExecutor 包裹软删除+恢复操作，降级时记录 warn 日志

- [x] Task 2: 图谱分支创建事务化
  - [x] SubTask 2.1: 修改 `graphVersionService.createBranch()` 使用 transactionExecutor 包裹创建图谱+复制节点+复制边，降级时记录 warn 日志

- [x] Task 3: 图谱分支合并事务化
  - [x] SubTask 3.1: 修改 `graphVersionService.applyMerge()` 使用 transactionExecutor 包裹变更应用+冲突解决
  - [x] SubTask 3.2: 合并成功后自动创建 post_merge 快照

- [x] Task 4: 数据导入事务化修复
  - [x] SubTask 4.1: 修改 `dataService.importData()` 使用 transactionExecutor 包裹整个导入流程，确保 knowledge_points 也被回滚
  - [x] SubTask 4.2: 修改 `dataService.importMarkdown()` 使用 transactionExecutor 包裹整个导入流程
  - [x] SubTask 4.3: 降级路径补充 knowledge_points 回滚清理

- [x] Task 5: 自动建图事务化
  - [x] SubTask 5.1: 修改 `autoGraphService.processAINodes()` 使用 transactionExecutor 包裹三表写入，降级时记录 warn 日志

- [x] Task 6: 测验卡片重新生成事务化
  - [x] SubTask 6.1: 修改 `quizSetsService.regenerateCard()` 使用 transactionExecutor 包裹四步操作，降级时记录 warn 日志

## P1 — 中风险操作（数据不一致但可恢复）

- [x] Task 7: 节点创建使用已有 RPC
  - [x] SubTask 7.1: 修改 `nodesService.createNode()` 使用 `createKnowledgePointWithGraphNode`（内部优先 RPC）
  - [x] SubTask 7.2: 修改 `nodeHelpers.createKnowledgePointWithGraphNode()` 优先使用 RPC，降级保留手动回滚
  - [x] SubTask 7.3: 修改 `writeTools.ts` 中 create_node 工具使用 createKnowledgePointWithGraphNode

- [x] Task 8: 已有 RPC 操作的降级路径事务化
  - [x] SubTask 8.1: 修改 `graphService.deleteGraph()` 的降级路径使用 transactionExecutor
  - [x] SubTask 8.2: 修改 `graphNodeService.removeFromGraph()` 的降级路径使用 transactionExecutor
  - [x] SubTask 8.3: 修改 `graphNodeService.batchDelete()` 的降级路径使用 transactionExecutor

- [x] Task 9: 学习路径操作事务化
  - [x] SubTask 9.1: 修改 `learningPathService.createLearningPath()` 使用 transactionExecutor
  - [x] SubTask 9.2: 修改 `learningPathService.updateNodeStatus()` 使用 transactionExecutor
  - [x] SubTask 9.3: 修改 `learningPathService.autoSchedulePath()` 使用 transactionExecutor

- [x] Task 10: 成就系统事务化
  - [x] SubTask 10.1: 修改 `achievementService.checkAndUnlock()` 使用 transactionExecutor
  - [x] SubTask 10.2: 修改 `achievementEngine.evaluateAchievements()` 使用 transactionExecutor

- [x] Task 11: Agent 子节点生成事务化
  - [x] SubTask 11.1: 修改 `aiActionService` spawn_children 使用 transactionExecutor 包裹整个创建循环

- [x] Task 12: 节点更新事务化
  - [x] SubTask 12.1: 修改 `nodesService.updateNode()` 使用 transactionExecutor 确保 knowledge_point 和 graph_node 原子更新
  - [x] SubTask 12.2: 修改 `nodesService.batchUpdateNodes()` 使用 transactionExecutor 包裹整个批量操作

## P2 — 低风险操作（计数不一致等）

- [x] Task 13: 测验集合操作事务化
  - [x] SubTask 13.1: 修改 `quizSetsService.delete()` 使用 transactionExecutor
  - [x] SubTask 13.2: 修改 `quizSetsService.addCard()` 使用 transactionExecutor
  - [x] SubTask 13.3: 修改 `quizSetsService.removeCard()` 使用 transactionExecutor

# Task Dependencies
- [Task 1-6] 相互独立，可并行
- [Task 7] 依赖已有 `create_knowledge_point_with_node` RPC 函数（已创建）
- [Task 8] 依赖已有 transactionExecutor（已实现）
- [Task 9-13] 相互独立，可并行，均依赖 transactionExecutor
- P0 优先于 P1，P1 优先于 P2
