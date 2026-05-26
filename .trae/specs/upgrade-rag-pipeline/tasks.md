# Tasks

## Task 1: 创建 `match_knowledge_points_by_graph` 数据库函数

为 RAG 搜索提供按图谱范围过滤的 pgvector 向量搜索函数。

- [x] SubTask 1.1: 在 `supabase/migrations/14_functions.sql` 中新增 `match_knowledge_points_by_graph` 函数，接受 `query_embedding`、`match_threshold`、`match_count`、`p_user_id`、`p_graph_id` 参数，通过 JOIN `graph_nodes` 表限定搜索范围
- [x] SubTask 1.2: 在 `supabase/migrations/16_grants.sql` 中为 `match_knowledge_points_by_graph` 函数授权 `authenticated` 角色
- [x] SubTask 1.3: 验证函数可通过 `supabase.rpc()` 调用

## Task 2: 将 RAG 语义搜索迁移到 pgvector

替换 `ragService.ts` 中的应用层余弦相似度计算为 pgvector RPC 调用。

- [x] SubTask 2.1: 重写 `RAGService.semanticSearch()` 方法：当指定 `graphId` 时调用 `match_knowledge_points_by_graph`，未指定时调用 `match_knowledge_points`
- [x] SubTask 2.2: 删除 `RAGService.cosineSimilarity()` 私有方法
- [x] SubTask 2.3: 调整 `semanticSearch` 返回值结构，确保 `RAGSearchResult` 接口兼容（包含 `graphId` 字段填充）
- [x] SubTask 2.4: 更新 `buildContext` 方法，适配新的搜索结果格式

## Task 3: 创建 `document_chunks` 表和分块服务

支持长文档分块存储和检索。

- [x] SubTask 3.1: 在 `supabase/migrations/` 中新增 `document_chunks` 表定义（字段：id, knowledge_point_id, chunk_index, content, embedding, created_at），并添加 HNSW 向量索引
- [x] SubTask 3.2: 创建 `api/services/ai/chunkingService.ts`，实现文本分块逻辑（按段落分块，每块 200-500 字符，保留上下文重叠）
- [x] SubTask 3.3: 在 `14_functions.sql` 中新增 `match_document_chunks` 数据库函数，支持按图谱范围搜索分块
- [x] SubTask 3.4: 修改 `embeddingGenerationProcessor.ts`，当知识点内容超过分块阈值时，自动分块并为每块生成 embedding
- [x] SubTask 3.5: 修改 `embeddingService.ts`，支持为 `document_chunks` 表批量生成 embedding

## Task 4: 实现 RerankingService

对 pgvector 初步检索结果进行 Cross-Encoder 重排序。

- [x] SubTask 4.1: 创建 `api/services/ai/rerankingService.ts`，封装 Reranking API 调用（支持 Jina/Cohere 等 Reranking API，通过 `app_settings` 配置 provider 和 API Key）
- [x] SubTask 4.2: 实现降级逻辑：当 Reranking 服务不可用时，直接返回 pgvector 原始排序结果
- [x] SubTask 4.3: 在 `ragService.ts` 的 `semanticSearch` 方法中集成 reranking 步骤：pgvector 返回 Top 20 → rerank → 返回 Top N

## Task 5: 实现智能上下文窗口管理

替代字符数截断，基于相关性分数和 token 预算智能填充上下文。

- [x] SubTask 5.1: 创建 `api/services/ai/contextWindowManager.ts`，实现基于 token 预算的上下文填充算法：按相关性分数降序排列知识点，逐个加入上下文直到接近 token 限制
- [x] SubTask 5.2: 实现 token 估算工具函数（基于字符数近似估算，中文约 1.5 字符/token，英文约 4 字符/token）
- [x] SubTask 5.3: 修改 `ragService.ts` 的 `buildContext` 方法，使用 `ContextWindowManager` 替代 `context.substring(0, maxContextLength)` 截断逻辑
- [x] SubTask 5.4: 支持分块级别的上下文引用：当知识点有分块时，优先使用最相关的分块内容而非整个知识点内容

## Task 6: 集成测试和验证

验证 RAG 流水线端到端工作正常。

- [x] SubTask 6.1: 验证 `match_knowledge_points_by_graph` 函数在本地数据库中正确执行
- [x] SubTask 6.2: 验证 `semanticSearch` 迁移后搜索结果与迁移前基本一致（允许排序差异）
- [x] SubTask 6.3: 验证分块服务对长文档正确分块并生成 embedding
- [x] SubTask 6.4: 验证 Reranking 降级逻辑正常工作
- [x] SubTask 6.5: 验证上下文窗口管理在内容超限时智能裁剪
- [x] SubTask 6.6: 运行 `npm run check` 和 `npm run lint` 确保无类型错误和代码规范问题

# Task Dependencies

- Task 1 是 Task 2 的前置依赖（需要数据库函数才能迁移搜索）
- Task 3 独立，可与 Task 1/2 并行
- Task 4 依赖 Task 2（reranking 集成到已迁移的 semanticSearch 中）
- Task 5 依赖 Task 2 和 Task 3（上下文管理需要新的搜索结果格式和分块数据）
- Task 6 依赖所有前置任务完成
