# Tasks

- [x] Task 1: 为 includeEmbedding 路径添加缓存支持
  - [x] SubTask 1.1: 在 `getGraphNodes` 的 includeEmbedding 分支中，使用独立缓存键 `graph_nodes_emb_{userId}_{graphId}` 和较短 TTL（120s/CacheTTL.SHORT）包裹查询
  - [x] SubTask 1.2: 确保缓存失效逻辑（invalidateStructureCache 等）同时清除 embedding 缓存键（通过 `graph:{graphId}` 标签自动清除）

- [x] Task 2: 添加节点数量监控日志
  - [x] SubTask 2.1: 在 `getGraphNodes` 两个分支返回结果前，当节点数 > 500 时记录 warn 日志

- [x] Task 3: 验证
  - [x] SubTask 3.1: TypeScript 类型检查通过
  - [x] SubTask 3.2: 确认 includeEmbedding 路径二次调用走缓存（通过标签索引自动失效）

# Task Dependencies
- Task 2 依赖 Task 1（修改同一函数）
- Task 3 依赖 Task 1 和 Task 2
