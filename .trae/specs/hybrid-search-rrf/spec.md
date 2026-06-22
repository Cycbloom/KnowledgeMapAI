# 混合检索 + RRF 融合排序 Spec

## Why

当前 RAG 服务的 `semanticSearch` 仅基于向量相似度进行单路召回，存在两个明显缺陷：(1) 对精确关键词（专有名词、缩写、代码片段）容易漏检，因为向量匹配侧重语义相似而非字面匹配；(2) 项目中已有 `SearchService.search()` 的关键词搜索能力（`ilike` 模糊匹配），但与 RAG 服务完全隔离，无法协同工作。此外，`graphAugmentedSearch` 的种子节点与扩展节点仅做简单拼接排序，没有跨路的融合排序机制。通过引入关键词检索路 + RRF（Reciprocal Rank Fusion）融合排序，可以在不依赖外部 Reranking 服务的情况下，显著提升检索的准确率和召回率。

## What Changes

- 新增 `keywordSearch` 方法到 `RAGService`，基于 PostgreSQL `ilike` 实现关键词精确匹配检索
- 新增 `hybridSearch` 方法到 `RAGService`，并行执行向量检索 + 关键词检索 + 图遍历，三路召回后使用 RRF 融合排序
- 新增 `reciprocalRankFusion` 工具函数，实现 RRF 算法
- 修改 `RAGService.graphAugmentedSearch`，使用 RRF 融合排序替代简单拼接
- 修改 `RAGService.buildContext`，默认使用混合检索模式
- 修改 RAG 路由 Schema，新增 `search_mode` 参数（`semantic`/`keyword`/`hybrid`，默认 `hybrid`）
- 修改前端 `ragApi`，新增 `search_mode` 参数传递
- 修改前端 RAG 聊天面板，新增检索模式选择

## Impact

- Affected specs: RAG 服务、搜索服务
- Affected code:
  - `api/services/ai/ragService.ts` — 新增 keywordSearch、hybridSearch 方法，修改 graphAugmentedSearch
  - `api/utils/rrf.ts` — 新增 RRF 融合排序工具函数
  - `api/routes/rag.ts` — 新增 search_mode 参数
  - `src/services/api/rag.ts` — 新增前端参数
  - `src/components/RAGChat/index.tsx` — 新增检索模式选择

## ADDED Requirements

### Requirement: 关键词检索

系统 SHALL 在 RAG 服务中提供基于 PostgreSQL `ilike` 的关键词精确匹配检索能力，作为向量检索的补充召回通道。

#### Scenario: 关键词匹配检索
- **WHEN** 调用 `keywordSearch(query, userId, options)` 且 query 包含专有名词或精确术语
- **THEN** 系统使用 `ilike` 模式在 `knowledge_points` 表的 `title` 和 `content` 字段中搜索匹配项，返回匹配的知识点列表

#### Scenario: 指定图谱范围
- **WHEN** 调用 `keywordSearch` 时指定 `graphId`
- **THEN** 仅返回属于该图谱的知识点

#### Scenario: 无匹配结果
- **WHEN** 关键词检索无匹配结果
- **THEN** 返回空数组，不抛出错误

---

### Requirement: RRF 融合排序

系统 SHALL 提供 Reciprocal Rank Fusion 算法实现，将多路检索结果融合为统一排序列表。

#### Scenario: 两路融合
- **WHEN** 向量检索返回结果 A（按相似度排序）和关键词检索返回结果 B（按匹配度排序）
- **THEN** 对每个结果，计算 RRF 分数 = Σ(1 / (k + rank_i))，其中 k=60（标准常数），rank_i 为该结果在第 i 路中的排名，按 RRF 分数降序排列

#### Scenario: 三路融合
- **WHEN** 向量检索、关键词检索、图遍历三路均有结果
- **THEN** 三路结果均参与 RRF 分数计算，图遍历路中 hopDistance 更小的节点排名更高

#### Scenario: 结果去重
- **WHEN** 同一知识点在多路检索中同时出现
- **THEN** 合并为一条记录，RRF 分数为各路分数之和，保留最高的 similarity 值

#### Scenario: 空路处理
- **WHEN** 某路检索无结果
- **THEN** 该路不参与 RRF 计算，其余路正常融合

---

### Requirement: 混合检索

系统 SHALL 在 RAG 服务中提供混合检索模式，并行执行向量检索 + 关键词检索 + 图遍历，使用 RRF 融合排序。

#### Scenario: 混合检索默认行为
- **WHEN** 调用 `hybridSearch(query, userId, options)` 且未指定 graphId
- **THEN** 并行执行向量检索和关键词检索，使用 RRF 融合排序返回结果

#### Scenario: 混合检索 + 图增强
- **WHEN** 调用 `hybridSearch` 且指定 graphId
- **THEN** 并行执行向量检索、关键词检索和图遍历，三路结果使用 RRF 融合排序

#### Scenario: 检索模式选择
- **WHEN** 用户在 RAG 请求中指定 `search_mode: "semantic"`
- **THEN** 仅使用向量检索，不执行关键词检索和 RRF 融合
- **WHEN** 用户指定 `search_mode: "keyword"`
- **THEN** 仅使用关键词检索
- **WHEN** 用户指定 `search_mode: "hybrid"`（默认）
- **THEN** 使用混合检索 + RRF 融合排序

---

### Requirement: RAG 聊天默认使用混合检索

系统 SHALL 在 RAG 聊天（chat/streamChat）中默认使用混合检索模式构建上下文。

#### Scenario: 默认混合检索
- **WHEN** 用户在 RAG 聊天中发送消息且未指定 search_mode
- **THEN** 系统使用混合检索模式（`hybrid`）构建上下文

#### Scenario: 向后兼容
- **WHEN** 用户显式指定 `search_mode: "semantic"`
- **THEN** 系统回退到纯向量检索模式，行为与优化前一致

## MODIFIED Requirements

### Requirement: RAG 语义搜索（现有）

现有 `semanticSearch` 方法保持不变，作为混合检索的向量检索路继续使用。新增 `keywordSearch` 和 `hybridSearch` 方法与其并行。

### Requirement: 图增强搜索（现有）

现有 `graphAugmentedSearch` 方法修改排序逻辑：种子节点与扩展节点不再简单拼接，而是使用 RRF 融合排序。种子节点来自向量检索路，扩展节点来自图遍历路，两路结果通过 RRF 融合。

### Requirement: RAG 聊天路由（现有）

现有 `/rag/chat`、`/rag/chat/stream`、`/rag/search` 路由的请求 Schema 新增 `search_mode` 字段（枚举值 `semantic`/`keyword`/`hybrid`，默认 `hybrid`）。

## REMOVED Requirements

无移除项。
