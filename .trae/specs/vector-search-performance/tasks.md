# Tasks

- [x] Task 1: 添加 Embedding 生成缓存
  - [x] 1.1 在 `cacheService.ts` 的 CacheKeys 中新增 `EMBEDDING: (textHash: string) => embedding_gen_${textHash}`
  - [x] 1.2 在 `embeddingOps.ts` 的 `generateEmbedding` 方法中，先计算文本 hash，使用 `cacheService.getOrSet` 包装，TTL 300s（CacheTTL.SEARCH），标签 `['embedding']`
  - [x] 1.3 在 `knowledgePointService.update` 中，更新知识点后失效对应标题的 embedding 缓存

- [x] Task 2: 节点创建时保存 Embedding 到 KnowledgePoint
  - [x] 2.1 在 `nodesService.createNode` 中，异步生成 embedding 后回填到 knowledge_point
  - [x] 2.2 确认 `knowledgePointService.create` 已支持 `embedding` 字段（当前代码第 106-108 行已支持 `data.embedding`）

- [x] Task 3: 节点创建时异步 Embedding 生成
  - [x] 3.1 重构 `nodesService.createNode`：将 embedding 生成和相似度检查逻辑从主流程中分离
  - [x] 3.2 主流程：先创建 knowledge_point（不含 embedding）→ 创建 graph_node → 立即返回
  - [x] 3.3 后台流程：异步生成 embedding → 执行相似度检查（仅日志记录）→ 回填 embedding 到 knowledge_point
  - [x] 3.4 当 `reuse_existing=false` 时跳过相似度检查，但仍异步生成 embedding 并保存
  - [x] 3.5 当指定了 `knowledge_point_id` 时完全跳过 embedding 相关操作

- [x] Task 4: 移除冗余 IVFFlat 索引
  - [x] 4.1 在 `21_pgvector_search.sql` 中移除 IVFFlat 索引创建代码，替换为注释说明 HNSW 已在 12_indexes.sql 中创建

- [x] Task 5: 验证
  - [x] 5.1 类型检查通过（`npm run check` — 无新增错误）
  - [x] 5.2 确认 embedding 缓存命中率：相同文本第二次调用应命中缓存
  - [x] 5.3 确认节点创建响应时间：不再因 embedding 生成而阻塞
  - [x] 5.4 确认数据库中仅有 HNSW 索引，无冗余 IVFFlat 索引

# Task Dependencies
- Task 1 是 Task 2 和 Task 3 的前置依赖（缓存基础设施需先就绪）
- Task 2 和 Task 3 可并行实施（但都修改 nodesService.ts，需注意合并）
- Task 4 独立，可与其他 Task 并行
- Task 5 依赖所有其他 Task 完成
