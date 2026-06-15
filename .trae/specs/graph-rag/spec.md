# GraphRAG（图增强检索）Spec

## Why

当前 RAG 服务的 `semanticSearch` 仅基于向量相似度进行单次检索，无法利用知识图谱中已建立的边关系进行多跳推理。例如，当用户询问"A 和 C 的关系"时，即使 A→B→C 的路径在图谱中已存在，纯向量搜索也无法沿着关系链扩展上下文，导致回答缺乏结构化的关联信息。通过将图谱关系与向量检索结合（GraphRAG），可以显著提升检索精准度和多跳推理能力。

## What Changes

- 新增 `GraphTraversalService` 服务，提供基于图谱边的多跳遍历能力
- 新增 `graphAugmentedSearch` 方法到 `RAGService`，在向量检索结果基础上沿图谱边扩展相关节点
- 新增 PostgreSQL 函数 `graph_traverse_neighbors`，在数据库层实现高效的邻居节点查询
- 修改 `RAGService.buildContext` 方法，支持图增强上下文构建
- 修改 `RAGService.chat` 和 `RAGService.streamChat`，新增 `useGraphContext` 选项
- 修改 RAG 路由，新增 `use_graph_context` 请求参数
- 修改前端 `ragApi`，新增 `use_graph_context` 参数传递
- 修改 `ContextWindowManager.buildContext`，支持图增强上下文的优先级排序
- 新增 `RAGSearchResult` 类型扩展，包含 `hopDistance` 和 `relationshipPath` 字段

## Impact

- Affected specs: RAG 服务、图谱服务
- Affected code:
  - `api/services/ai/ragService.ts` — 新增图增强搜索方法，修改 buildContext
  - `api/services/graph/graphTraversalService.ts` — 新增图谱遍历服务
  - `api/routes/rag.ts` — 新增请求参数
  - `api/services/ai/contextWindowManager.ts` — 支持图增强上下文排序
  - `supabase/migrations/14_functions.sql` — 新增数据库函数
  - `src/services/api/rag.ts` — 新增前端参数
  - `src/components/RAGChat/ChatMessage.tsx` — 展示关系路径信息

## ADDED Requirements

### Requirement: 图增强语义搜索

系统 SHALL 在 RAG 向量检索结果基础上，沿知识图谱的边关系进行多跳遍历，将关联节点纳入检索上下文。

#### Scenario: 单跳扩展
- **WHEN** 用户在 RAG 搜索中启用图增强模式（`use_graph_context: true`）
- **THEN** 系统在向量检索返回的种子节点基础上，沿图谱边查询其直接邻居节点（1 跳），将邻居节点内容补充到上下文中

#### Scenario: 多跳遍历
- **WHEN** 用户配置 `graph_hops: 2`
- **THEN** 系统从种子节点出发，沿图谱边遍历 2 跳范围内的所有节点，按跳数距离和关系权重排序后纳入上下文

#### Scenario: 关系路径展示
- **WHEN** 图增强搜索返回结果
- **THEN** 每个扩展节点包含 `relationshipPath` 字段，描述从种子节点到该节点的路径（如"A → 依赖 → B → 包含 → C"）

#### Scenario: 上下文窗口预算分配
- **WHEN** 图增强上下文与向量检索上下文共存
- **THEN** 系统为种子节点分配 70% 的上下文预算，为图扩展节点分配 30%，确保核心检索结果不被稀释

---

### Requirement: 图谱遍历服务

系统 SHALL 提供 `GraphTraversalService` 服务，支持基于图谱边的高效邻居节点查询。

#### Scenario: 获取邻居节点
- **WHEN** 调用 `getNeighbors(graphId, knowledgePointIds, maxHops)`
- **THEN** 返回指定跳数范围内的所有邻居节点，包含跳数距离、关系类型和关系路径

#### Scenario: 按关系类型过滤
- **WHEN** 调用 `getNeighbors` 时指定 `relationshipTypes` 过滤条件
- **THEN** 仅沿指定关系类型的边进行遍历

#### Scenario: 大图性能保障
- **WHEN** 图谱节点数超过 1000
- **THEN** 遍历结果通过数据库函数执行，避免全量加载到应用层

---

### Requirement: 数据库层邻居查询函数

系统 SHALL 提供 PostgreSQL 函数 `graph_traverse_neighbors`，在数据库层实现高效的邻居节点查询。

#### Scenario: 邻居查询
- **WHEN** 调用 `graph_traverse_neighbors(p_graph_id, p_source_ids, p_max_hops, p_relationship_types)`
- **THEN** 返回所有可达节点及其跳数距离、关系路径，按跳数升序排列

---

### Requirement: 图增强 RAG 聊天

系统 SHALL 在 RAG 聊天中支持图增强模式，使 AI 回答能够引用图谱关系信息。

#### Scenario: 图增强聊天
- **WHEN** 用户在 RAG 聊天中发送消息且 `use_graph_context: true`
- **THEN** 系统在构建上下文时，不仅包含向量检索的种子节点，还包含沿图谱边扩展的关联节点，并在系统提示中说明节点间的关系

#### Scenario: 关系推理提示
- **WHEN** 图增强上下文中包含多跳路径
- **THEN** 系统 Prompt 中包含"以下知识节点之间存在图谱关系，请利用这些关系进行推理"的指引

#### Scenario: 流式聊天支持
- **WHEN** 用户使用流式聊天（`/rag/chat/stream`）且启用图增强
- **THEN** 图增强上下文同样应用于流式响应

## MODIFIED Requirements

### Requirement: RAG 语义搜索（现有）

现有 `semanticSearch` 方法新增可选参数 `useGraphContext`（默认 `false`）和 `graphHops`（默认 `1`），当启用时在向量检索后追加图扩展结果。

### Requirement: RAG 上下文构建（现有）

现有 `buildContext` 方法新增图增强上下文构建逻辑，种子节点和扩展节点分别排序后合并，种子节点优先占用上下文预算。

### Requirement: RAG 聊天路由（现有）

现有 `/rag/chat` 和 `/rag/chat/stream` 路由的请求 Schema 新增 `use_graph_context`（boolean，默认 false）和 `graph_hops`（integer，默认 1，最大 3）字段。

## REMOVED Requirements

无移除项。
