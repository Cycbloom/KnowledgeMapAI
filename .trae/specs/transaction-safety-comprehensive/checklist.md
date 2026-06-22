# 事务保障完善 Checklist

## P0 — 高风险操作

- [x] `graphVersionService.rollbackToSnapshot()` 使用 transactionExecutor 包裹软删除+恢复操作
- [x] `graphVersionService.createBranch()` 使用 transactionExecutor 包裹创建图谱+复制节点+复制边
- [x] `graphVersionService.applyMerge()` 使用 transactionExecutor 包裹变更应用+冲突解决
- [x] 合并成功后自动创建 post_merge 快照
- [x] `dataService.importData()` 使用 transactionExecutor，降级路径补充 knowledge_points 回滚
- [x] `dataService.importMarkdown()` 使用 transactionExecutor，降级路径补充 knowledge_points 回滚
- [x] 导入失败时 knowledge_points 也被正确回滚
- [x] `autoGraphService.processAINodes()` 使用 transactionExecutor 包裹三表写入
- [x] `quizSetsService.regenerateCard()` 使用 transactionExecutor 包裹四步操作

## P1 — 中风险操作

- [x] `nodeHelpers.createKnowledgePointWithGraphNode()` 优先使用 RPC 替代手动回滚
- [x] `nodesService.createNode()` 使用 createKnowledgePointWithGraphNode（内部优先 RPC）
- [x] Agent `create_node` 工具使用 createKnowledgePointWithGraphNode，失败时不产生孤立数据
- [x] `graphService.deleteGraph()` 降级路径使用 transactionExecutor
- [x] `graphNodeService.removeFromGraph()` 降级路径使用 transactionExecutor
- [x] `graphNodeService.batchDelete()` 降级路径使用 transactionExecutor
- [x] `learningPathService.createLearningPath()` 使用 transactionExecutor
- [x] `learningPathService.updateNodeStatus()` 使用 transactionExecutor
- [x] `learningPathService.autoSchedulePath()` 使用 transactionExecutor
- [x] `achievementService.checkAndUnlock()` 使用 transactionExecutor
- [x] `achievementEngine.evaluateAchievements()` 使用 transactionExecutor
- [x] `aiActionService` spawn_children 使用 transactionExecutor
- [x] `nodesService.updateNode()` 使用 transactionExecutor
- [x] `nodesService.batchUpdateNodes()` 使用 transactionExecutor

## P2 — 低风险操作

- [x] `quizSetsService.delete()` 使用 transactionExecutor
- [x] `quizSetsService.addCard()` 使用 transactionExecutor
- [x] `quizSetsService.removeCard()` 使用 transactionExecutor

## 通用验证

- [x] 所有新增事务操作通过 `transactionExecutor.executeInTransaction` 实现
- [x] 所有 RPC 调用有降级路径（transactionExecutor 或原有逻辑 + warn 日志）
- [x] 降级路径均记录 `logger.warn` 日志
- [x] 无新增 `any` 类型（nodeHelpers.ts 中修复了原有 `any` 为 `SupabaseClient`）
- [x] `npm run check` 通过（3 个预先存在的错误与本次修改无关）
