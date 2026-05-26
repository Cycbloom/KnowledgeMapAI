# RAG 流水线架构升级 Spec

## Why

当前 `RAGService.semanticSearch()` 在 Node.js 应用层手动计算余弦相似度（拉取最多 100 条 embedding 到内存遍历），未利用数据库已有的 pgvector HNSW 索引，性能和搜索质量均受限。同时缺少文档分块、重排序和智能上下文管理，导致长文档检索精度差、上下文截断粗暴。需要构建完整的 Streaming RAG Pipeline。

## What Changes

- 将 `ragService.ts` 中的应用层余弦相似度计算替换为 pgvector RPC 函数调用
- 新增 `match_knowledge_points_by_graph` 数据库函数，支持按图谱范围进行向量搜索
- 新增 `document_chunks` 表和 `ChunkingService`，支持长文档分块检索
- 新增 `RerankingService`，对 pgvector 初步检索结果进行 Cross-Encoder 重排序
- 改进 `buildContext` 的上下文窗口管理，基于相关性分数智能裁剪而非字符数截断
- **BREAKING**: `RAGService.semanticSearch` 的内部实现完全变更（接口保持兼容）

## Impact

- Affected specs: RAG 服务、语义搜索、知识提取
- Affected code:
  - `api/services/ai/ragService.ts` — 核心重构：搜索迁移到 pgvector + 重排序 + 上下文管理
  - `api/services/ai/searchService.ts` — 可能需要统一搜索接口
  - `api/services/ai/embeddingService.ts` — 需要支持 document_chunks 的 embedding 生成
  - `api/services/taskProcessors/embeddingGenerationProcessor.ts` — 需要支持分块 embedding
  - `supabase/migrations/` — 新增 `document_chunks` 表和 `match_knowledge_points_by_graph` 函数

## ADDED Requirements

### Requirement: pgvector 数据库层向量搜索

系统 SHALL 将 RAG 语义搜索从 Node.js 应用层余弦相似度计算迁移到 pgvector 数据库函数调用，利用 HNSW 索引加速检索。

#### Scenario: RAG 搜索使用 pgvector
- **WHEN** 用户在 RAG 聊天中发送消息触发 `semanticSearch`
- **THEN** 系统调用 `supabase.rpc('match_knowledge_points_by_graph', ...)` 在数据库层执行向量搜索，而非在 Node.js 中遍历计算余弦相似度

#### Scenario: 图谱范围向量搜索
- **WHEN** RAG 搜索指定了 `graphId`
- **THEN** 系统使用 `match_knowledge_points_by_graph` 函数，仅在该图谱关联的知识点范围内搜索，利用 pgvector 索引

#### Scenario: 全局向量搜索
- **WHEN** RAG 搜索未指定 `graphId`
- **THEN** 系统使用 `match_knowledge_points` 函数，在用户所有可见知识点范围内搜索

---

### Requirement: 文档分块服务

系统 SHALL 提供文档分块能力，将长文档自动切分为语义块，每块独立生成嵌入向量，支持细粒度检索。

#### Scenario: 长文档自动分块
- **WHEN** 知识点的 content 超过 500 字符
- **THEN** 系统自动将内容按语义段落分块，每块存入 `document_chunks` 表并生成独立 embedding

#### Scenario: 分块检索提升精度
- **WHEN** RAG 搜索命中了某个知识点
- **THEN** 系统优先返回该知识点中与查询最相关的分块内容，而非整个知识点内容

#### Scenario: 分块 embedding 生成
- **WHEN** 知识点创建或更新时内容超过分块阈值
- **THEN** `EmbeddingGenerationProcessor` 为每个分块独立生成 embedding 向量

---

### Requirement: 检索结果重排序

系统 SHALL 对 pgvector 初步检索结果进行 Cross-Encoder 重排序，提升检索相关性。

#### Scenario: RAG 搜索结果重排序
- **WHEN** pgvector 返回候选知识点（Top 20）
- **THEN** 系统使用 Reranking API 对"查询-候选"对进行二次打分，按重排序分数返回 Top N 结果

#### Scenario: Reranking 不可用时降级
- **WHEN** Reranking 服务不可用（API Key 未配置或服务异常）
- **THEN** 系统降级使用 pgvector 原始相似度排序，不中断 RAG 流程

---

### Requirement: 智能上下文窗口管理

系统 SHALL 基于相关性分数和 token 预算智能管理 RAG 上下文窗口，替代当前的字符数截断策略。

#### Scenario: 上下文智能裁剪
- **WHEN** RAG 检索到的知识点总内容超过 token 预算
- **THEN** 系统按相关性分数从高到低填充上下文，低相关性内容被优先裁剪，而非简单截断

#### Scenario: 流式上下文不中断
- **WHEN** RAG 流式对话过程中上下文接近 token 限制
- **THEN** 系统动态调整上下文窗口，确保流式响应不因上下文溢出而中断

## MODIFIED Requirements

### Requirement: RAG 语义搜索（现有）

`RAGService.semanticSearch()` 方法从应用层余弦相似度计算修改为调用 pgvector 数据库 RPC 函数。方法签名保持兼容，内部实现完全变更：
- 删除 `cosineSimilarity` 私有方法
- 搜索逻辑从"拉取 embedding 到内存 → 遍历计算"改为"调用 supabase.rpc → 返回排序结果"
- 新增可选的 reranking 步骤

### Requirement: RAG 上下文构建（现有）

`RAGService.buildContext()` 方法从字符数截断修改为基于相关性分数的智能裁剪：
- 删除 `context.substring(0, maxContextLength)` 截断逻辑
- 新增按相关性分数排序、token 预算控制的填充逻辑
- 支持分块级别的上下文引用

## REMOVED Requirements

### Requirement: 应用层余弦相似度计算
**Reason**: pgvector 数据库层已提供等价且更高效的向量搜索能力，应用层计算不再需要
**Migration**: 删除 `RAGService.cosineSimilarity()` 方法，所有向量搜索统一走 pgvector RPC
