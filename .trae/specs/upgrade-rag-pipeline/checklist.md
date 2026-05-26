# RAG 流水线架构升级 Checklist

## pgvector 数据库层向量搜索

- [x] `match_knowledge_points_by_graph` 数据库函数已创建，支持按图谱范围过滤向量搜索
- [x] `match_knowledge_points_by_graph` 函数已授权 `authenticated` 角色
- [x] `RAGService.semanticSearch()` 已从应用层余弦相似度计算迁移到 pgvector RPC 调用
- [x] `RAGService.cosineSimilarity()` 私有方法已删除
- [x] 指定 `graphId` 时调用 `match_knowledge_points_by_graph`，未指定时调用 `match_knowledge_points`
- [x] `RAGSearchResult` 接口保持兼容，`graphId` 字段正确填充

## 文档分块服务

- [x] `document_chunks` 数据库表已创建，包含 id, knowledge_point_id, chunk_index, content, embedding, created_at 字段
- [x] `document_chunks` 表已添加 HNSW 向量索引
- [x] `ChunkingService` 已实现，支持按段落分块（200-500 字符，保留上下文重叠）
- [x] `match_document_chunks` 数据库函数已创建，支持按图谱范围搜索分块
- [x] `EmbeddingGenerationProcessor` 已支持为分块生成 embedding
- [x] `EmbeddingService` 已支持为 `document_chunks` 表批量生成 embedding

## 检索结果重排序

- [x] `RerankingService` 已创建，封装 Reranking API 调用（Jina/Cohere）
- [x] Reranking provider 和 API Key 通过 `app_settings` 配置
- [x] Reranking 不可用时降级到 pgvector 原始排序，不中断 RAG 流程
- [x] `semanticSearch` 中已集成 reranking：pgvector Top 20 → rerank → Top N

## 智能上下文窗口管理

- [x] `ContextWindowManager` 已创建，实现基于 token 预算的上下文填充算法
- [x] token 估算工具函数已实现（中英文分别估算）
- [x] `buildContext` 方法已使用 `ContextWindowManager` 替代字符数截断
- [x] 支持分块级别上下文引用：优先使用最相关的分块内容

## 集成验证

- [x] `npm run check` 类型检查通过
- [x] `npm run lint` 代码规范检查通过
- [x] RAG 搜索迁移后结果与迁移前基本一致
- [x] 分块服务对长文档正确分块并生成 embedding
- [x] Reranking 降级逻辑正常工作
- [x] 上下文窗口管理在内容超限时智能裁剪
