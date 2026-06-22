# 向量搜索性能优化 Spec

## Why

当前向量搜索流程存在三个性能瓶颈：(1) embedding 向量生成结果未缓存，同一文本在不同功能中重复调用 AI API 生成 embedding（每次 100-500ms），例如节点创建时生成 embedding 用于相似度检查但未保存，后续 `getRelatedNodes` 再次为同一标题生成；(2) 节点创建时同步等待 embedding 生成，阻塞整个创建流程；(3) `21_pgvector_search.sql` 中的 IVFFlat 索引与 `12_indexes.sql` 中已有的 HNSW 索引冗余，浪费存储且可能干扰查询计划。

## 验证发现

### 已完成项（无需修改）
- HNSW 索引已在 `12_indexes.sql` 中配置（`knowledge_graphs` 和 `knowledge_points` 两张表）
- 搜索结果已通过 `complete-cache-coverage` spec 添加了 embedding hash 缓存

### 待优化项
1. **Embedding 生成缓存缺失**：`aiService.generateEmbedding(text)` 无缓存，以下调用路径各自独立生成：
   - `nodesService.ts:108` — 节点创建时相似度检查
   - `graphService.ts:381` — 图谱创建时主题重复检查
   - `ragService.ts:113` — RAG 语义搜索
   - `searchService.ts:121` — 搜索服务
   - `knowledgePoints.ts:205` — 知识点搜索路由
   - `conceptAggregationService.ts:350,987` — 概念聚合
   - `nodesService.ts:809` — 获取相关节点（回填 embedding）

2. **节点创建时 embedding 双重生成**：`nodesService.createNode` 在第 108 行生成 embedding 用于相似度检查，但创建的 knowledge_point（第 134-145 行）不包含 embedding。后续 `getRelatedNodes`（第 808-817 行）发现 embedding 为空时再次生成并回填。同一标题的 embedding 被生成了两次。

3. **冗余 IVFFlat 索引**：`21_pgvector_search.sql` 创建了 `idx_knowledge_points_embedding_ivfflat`，与 `12_indexes.sql` 中的 `idx_knowledge_points_embedding`（HNSW）冗余。

## What Changes
- 在 `embeddingOps.ts` 的 `generateEmbedding` 方法中添加短期缓存（TTL 5min），避免同一文本重复调用 AI API
- 在 `nodesService.createNode` 中，将生成的 embedding 保存到新创建的 knowledge_point，避免后续重复生成
- 在 `nodesService.createNode` 中，将 embedding 生成和相似度检查改为非阻塞：先创建节点，异步生成 embedding 并回填
- 移除 `21_pgvector_search.sql` 中的冗余 IVFFlat 索引创建代码
- 为 `generateEmbedding` 缓存添加配套的失效策略

## Impact
- Affected specs: `complete-cache-coverage`（已有搜索结果缓存，本次新增 embedding 生成缓存）
- Affected code:
  - `api/services/ai/embeddingOps.ts` — 添加 embedding 生成缓存
  - `api/services/common/cacheService.ts` — 新增 CacheKeys.EMBEDDING 定义
  - `api/services/graph/nodesService.ts` — 保存 embedding 到新 KP + 异步化
  - `supabase/migrations/21_pgvector_search.sql` — 移除冗余 IVFFlat 索引

## ADDED Requirements

### Requirement: Embedding 生成缓存

系统 SHALL 对 `generateEmbedding` 的结果进行短期缓存，避免同一文本在短时间内重复调用 AI API。

#### Scenario: 相同文本的 embedding 缓存命中
- **WHEN** 在 5 分钟内对同一文本再次调用 `generateEmbedding`
- **THEN** 直接返回缓存的 embedding 向量，不调用 AI API

#### Scenario: 不同文本的 embedding 缓存未命中
- **WHEN** 对新文本调用 `generateEmbedding`
- **THEN** 调用 AI API 生成 embedding，并缓存结果

#### Scenario: embedding 缓存失效
- **WHEN** 知识点内容被更新
- **THEN** 该知识点标题对应的 embedding 缓存被失效

---

### Requirement: 节点创建时保存 Embedding

系统 SHALL 在节点创建流程中，将生成的 embedding 向量保存到新创建的 knowledge_point，避免后续重复生成。

#### Scenario: 创建新知识点时保存 embedding
- **WHEN** 用户创建新节点且 `reuse_existing=false` 或未找到相似知识点
- **AND** 成功生成了标题的 embedding
- **THEN** 创建 knowledge_point 时将 embedding 一并写入数据库
- **AND** 后续 `getRelatedNodes` 可直接使用已有 embedding，无需再次生成

#### Scenario: embedding 生成失败
- **WHEN** 创建节点时 embedding 生成失败
- **THEN** 仍正常创建 knowledge_point（embedding 为 null）
- **AND** 不阻塞节点创建流程

---

### Requirement: 节点创建时异步 Embedding 生成

系统 SHALL 将节点创建流程中的 embedding 生成和相似度检查改为非阻塞模式，先完成节点创建，再异步处理 embedding 相关操作。

#### Scenario: 创建节点时异步生成 embedding
- **WHEN** 用户创建新节点且 `reuse_existing=true`
- **THEN** 先创建 knowledge_point（不含 embedding）和 graph_node，立即返回创建结果
- **AND** 在后台异步生成 embedding、执行相似度检查、回填 embedding 到 knowledge_point

#### Scenario: 异步相似度检查发现重复
- **WHEN** 后台异步相似度检查发现已有相似知识点
- **THEN** 记录日志但不影响已创建的节点（因为节点已返回给用户）

#### Scenario: 创建节点时指定了 knowledge_point_id
- **WHEN** 用户创建节点时指定了已有的 knowledge_point_id
- **THEN** 跳过 embedding 生成和相似度检查，直接创建 graph_node

---

### Requirement: 移除冗余 IVFFlat 索引

系统 SHALL 移除 `21_pgvector_search.sql` 中与 `12_indexes.sql` HNSW 索引冗余的 IVFFlat 索引创建代码。

#### Scenario: 数据库迁移执行
- **WHEN** 执行 `supabase db reset` 或迁移
- **THEN** 仅保留 `12_indexes.sql` 中的 HNSW 索引，不再创建冗余的 IVFFlat 索引

## MODIFIED Requirements

无

## REMOVED Requirements

无
