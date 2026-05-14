# Tasks

- [x] Task 1: 增强 `normalizeTitle` 标题规范化函数
  - [x] 在 `conceptAggregationService.ts` 中增强 `normalizeTitle` 函数，增加以下处理：
    - 移除首尾标点符号（中英文句号、逗号、冒号等）
    - Unicode NFC 规范化（`String.prototype.normalize("NFC")`）
    - 全角字符转半角（英文字母、数字、基本符号）
  - [x] 所有调用处自动使用增强后的规范化（函数签名未变）

- [x] Task 2: 修改 `graphNodeService.addToGraph()` 增加重复插入防护
  - [x] 在 `addToGraph()` 方法开头增加查询：检查同一 `(graph_id, knowledge_point_id)` 且 `deleted_at IS NULL` 的已有记录
  - [x] 若存在已有记录，记录 warning 日志并直接返回已有节点（通过 `buildNodeFromGraphNode`）
  - [x] 保留原有的唯一约束错误处理作为兜底

- [x] Task 3: 在 `autoGraphService.processAINodes()` 中增加去重逻辑
  - [x] 在 `processAINodes()` 中增加私有方法 `deduplicateNodes()`：
    - 查询当前图谱中所有已有节点（graph_nodes + knowledge_points）
    - 对每个待创建的节点执行：
      a. 标题精确匹配（使用增强后的 normalizeTitle）
      b. 若标题不匹配但有 embedding，使用 pgvector `match_knowledge_points` RPC 查找相似节点
      c. 若有相似度 >= 阈值的已有节点，复用已有 knowledge_point_id
    - 在批量内部（待创建节点之间）也执行标题去重和向量去重
  - [x] 返回 dedup 结果：`{ nodesToCreate, reusedKpIds, mergedCount }`
  - [x] 确保去重后的节点继续走原有的创建流程

- [x] Task 4: 修改 `/auto-graph/save-nodes` 路由
  - [x] 调用 `autoGraphService.processAINodes()` 时自动获得去重能力（去重已下沉到 processAINodes）
  - [x] 路由无需额外修改

- [x] Task 5: 优化 `/literature/apply` 路由
  - [x] 确保现有的去重逻辑（标题匹配、batch 去重、fuzzy 标题、pgvector、fallback）正常工作
  - [x] 移除路由层中冗余的批量内部去重（batch embedding dedup），避免重复计算
  - [x] 保留路由层独有的去重逻辑（fuzzy title match、batch title dedup）
  - [x] 移除不再使用的 `BATCH_MERGE_THRESHOLD` 常量和 `batchMergedIndices` 引用

- [x] Task 6: 环境变量配置相似度阈值
  - [x] `conceptAggregationService.ts` 中 `SIMILARITY_THRESHOLD` 已从环境变量读取
  - [x] `autoGraphService.ts` 中 `MERGE_THRESHOLD` 已从环境变量读取
  - [x] `.env.example` 中记录 `CONCEPT_MERGE_THRESHOLD`、`CONCEPT_BATCH_MERGE_THRESHOLD`、`CONCEPT_FUZZY_TITLE_THRESHOLD` 配置项

# Task Dependencies
- Task 2, Task 3, Task 4 均依赖 Task 1（需要增强的 normalizeTitle）
- Task 4 依赖 Task 3（去重逻辑下沉到 processAINodes）
- Task 5 依赖 Task 3（processAINodes 已提供去重后，路由层可简化）
- Task 6 可与 Task 1-5 并行