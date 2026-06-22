# Tasks

- [x] Task 1: 新增 RRF 融合排序工具函数
  - [x] SubTask 1.1: 创建 `api/utils/rrf.ts`，实现 `reciprocalRankFusion` 函数，接受多路排序结果（每路为 `{ id: string, score: number, data: T }[]`），返回融合排序后的结果，RRF 公式：`score = Σ(1 / (k + rank_i))`，k=60
  - [x] SubTask 1.2: 实现结果去重逻辑：同一 id 在多路出现时，RRF 分数为各路分数之和，保留最高 score 和完整 data
  - [x] SubTask 1.3: 为 RRF 函数编写单元测试，覆盖两路融合、三路融合、空路处理、去重等场景

- [x] Task 2: 新增 RAGService 关键词检索方法
  - [x] SubTask 2.1: 在 `ragService.ts` 中新增 `keywordSearch(query, userId, options)` 方法，使用 Supabase `ilike` 在 `knowledge_points` 表的 `title` 和 `content` 字段搜索，支持 `graphId` 过滤
  - [x] SubTask 2.2: 关键词检索结果格式与 `RAGSearchResult` 一致，`similarity` 字段使用基于匹配位置的评分（title 匹配权重高于 content 匹配）
  - [x] SubTask 2.3: 当 `graphId` 指定时，通过 `graph_nodes` 表关联过滤

- [x] Task 3: 新增 RAGService 混合检索方法
  - [x] SubTask 3.1: 在 `ragService.ts` 中新增 `hybridSearch(query, userId, options)` 方法，并行执行 `semanticSearch` 和 `keywordSearch`
  - [x] SubTask 3.2: 当 `graphId` 指定时，额外并行执行图遍历，三路结果使用 `reciprocalRankFusion` 融合排序
  - [x] SubTask 3.3: 融合排序后的结果保留 `GraphRAGSearchResult` 格式，包含 `hopDistance`、`relationshipPath`、`relationshipType` 字段

- [x] Task 4: 修改 graphAugmentedSearch 使用 RRF 融合排序
  - [x] SubTask 4.1: 修改 `graphAugmentedSearch` 方法，种子节点和扩展节点不再简单拼接，改为使用 RRF 融合排序
  - [x] SubTask 4.2: 种子节点作为向量检索路参与 RRF，扩展节点作为图遍历路参与 RRF，图遍历路中按 hopDistance 升序排名

- [x] Task 5: 修改 RAG 路由和 Schema
  - [x] SubTask 5.1: 修改 `api/routes/rag.ts` 中的 `ragChatSchema` 和 `ragSearchSchema`，添加 `search_mode: z.enum(["semantic", "keyword", "hybrid"]).optional()`
  - [x] SubTask 5.2: 修改 `/rag/chat`、`/rag/chat/stream`、`/rag/search` 路由处理函数，根据 `search_mode` 选择检索策略：`semantic` → `semanticSearch`，`keyword` → `keywordSearch`，`hybrid` → `hybridSearch`
  - [x] SubTask 5.3: 修改 `ragService.buildContext` 方法，根据 `searchMode` 参数选择检索方式，默认 `hybrid`
  - [x] SubTask 5.4: 修改 `ragService.chat` 和 `streamChat`，传递 `searchMode` 参数

- [x] Task 6: 修改前端 API 和 UI
  - [x] SubTask 6.1: 修改 `src/services/api/rag.ts`，在 `chat`、`chatStream`、`search` 方法中添加 `search_mode` 参数
  - [x] SubTask 6.2: 修改 `src/components/RAGChat/index.tsx`，在图增强开关旁添加检索模式选择（语义/关键词/混合），默认混合

# Task Dependencies

- Task 1 是 Task 3 的前置依赖（RRF 函数需先就绪）
- Task 2 是 Task 3 的前置依赖（关键词检索需先就绪）
- Task 3 是 Task 4 的前置依赖（混合检索需先就绪，为 graphAugmentedSearch 提供参考实现）
- Task 4 是 Task 5 的前置依赖（服务层需先完成）
- Task 5 和 Task 6 可并行执行（后端路由和前端 API 互不依赖）
