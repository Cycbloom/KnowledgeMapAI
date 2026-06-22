# Tasks

- [x] Task 1: 扩展 CacheKeys 定义和失效方法
  - [x] 1.1 在 cacheService.ts 的 CacheKeys 中新增：GRAPH_NODE_STATUS、GRAPH_MAP、GRAPH_TAGS、GRAPH_DOMAINS、GRAPH_LITERATURE、SEARCH_SIMILAR
  - [x] 1.2 新增 `invalidateStatusCache(userId, graphId)` 方法 — 仅失效 GRAPH_NODE_STATUS
  - [x] 1.3 新增 `invalidateStructureCache(userId, graphId)` 方法 — 失效结构相关缓存（GRAPH_NODES + GRAPH_NODE_STATUS + GRAPH_MAP + GRAPH_TAGS + GRAPH_DOMAINS + GRAPH_LITERATURE）
  - [x] 1.4 新增 embedding hash 计算工具函数（用于 searchSimilar 缓存键）

- [x] Task 2: 为 getGraphNodeStatus 添加缓存（最高优先级）
  - [x] 2.1 在 graphService.ts 的 getGraphNodeStatus 中使用 cacheService.getOrSet 包装，TTL 60s，标签 `graph:${graphId}`, `status`
  - [x] 2.2 在 cacheInvalidationSubscriber.ts 中为学习相关事件添加 GRAPH_NODE_STATUS 失效
  - [x] 2.3 在 cacheInvalidationSubscriber.ts 中为节点/边变更事件添加 invalidateStructureCache 调用（替代仅删 GRAPH_NODES）

- [x] Task 3: 为 getGraphMap 添加缓存
  - [x] 3.1 在 graphCrudService.ts 的 getGraphMap 中使用 cacheService.getOrSet 包装，TTL 300s，标签 `user:${userId}`, `graphMap`

- [x] Task 4: 为 getTags 和 getDomains 添加缓存
  - [x] 4.1 在 graphCrudService.ts 的 getTags 中使用 cacheService.getOrSet 包装，TTL 300s，标签 `user:${userId}`, `tags`
  - [x] 4.2 在 graphCrudService.ts 的 getDomains 中使用 cacheService.getOrSet 包装，TTL 300s，标签 `user:${userId}`, `domains`

- [x] Task 5: 为 getLiterature 添加缓存
  - [x] 5.1 在 graphCrudService.ts 的 getLiterature 中使用 cacheService.getOrSet 包装，TTL 300s，标签 `graph:${graphId}`, `literature`
  - [x] 5.2 注意缓存键需包含 activeModule 参数以区分不同模块的文献

- [x] Task 6: 为 searchSimilar 添加 embedding hash 缓存
  - [x] 6.1 在 knowledgePointService.ts 的 searchSimilar 中，先计算查询文本的 hash，以 hash 为键缓存搜索结果
  - [x] 6.2 在 similaritySearch.ts 的 searchSimilarKnowledgePoints 和 searchSimilarGraphs 中同样添加缓存
  - [x] 6.3 在节点/图谱创建和删除时失效 search 标签缓存

- [x] Task 7: 优化前端 staleTime 配置
  - [x] 7.1 在 useGraphQueries.ts 中将 useGraphNodeStatus 的 staleTime 从 0 调整为 30000（30s）

- [x] Task 8: 验证缓存效果
  - [x] 8.1 类型检查通过（API 层和前端层均无新增错误）
  - [x] 8.2 代码审查确认所有缓存包装、失效策略、import 均正确

# Task Dependencies
- Task 1 是所有后续 Task 的前置依赖
- Task 2 依赖 Task 1（需要 CacheKeys 和失效方法）
- Task 3-6 依赖 Task 1（需要 CacheKeys）
- Task 7 独立，可与 Task 2-6 并行
- Task 8 依赖所有其他 Task 完成
