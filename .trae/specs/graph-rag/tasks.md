# Tasks

- [x] Task 1: 新增 PostgreSQL 函数 `graph_traverse_neighbors`
  - [x] SubTask 1.1: 在 `supabase/migrations/14_functions.sql` 中添加 `graph_traverse_neighbors` 函数，接受参数 `p_graph_id uuid, p_source_ids uuid[], p_max_hops int DEFAULT 2, p_relationship_types text[] DEFAULT NULL`，返回表包含 `knowledge_point_id uuid, title varchar, content text, hop_distance int, relationship_path text, relationship_type text`
  - [x] SubTask 1.2: 在 `supabase/migrations/16_grants.sql` 中添加函数执行权限授予
  - [x] SubTask 1.3: 验证函数在本地数据库中可正常执行

- [x] Task 2: 新增 `GraphTraversalService` 服务
  - [x] SubTask 2.1: 创建 `api/services/graph/graphTraversalService.ts`，实现 `getNeighbors(supabase, graphId, sourceKpIds, maxHops, relationshipTypes?)` 方法，调用 `graph_traverse_neighbors` RPC 函数
  - [x] SubTask 2.2: 实现 `buildRelationshipPath(edges, sourceId, targetId)` 辅助方法，根据边数据构建人类可读的关系路径字符串
  - [x] SubTask 2.3: 添加结果去重逻辑（同一节点可能通过不同路径到达，保留最短路径）

- [x] Task 3: 扩展 RAG 服务 — 图增强搜索
  - [x] SubTask 3.1: 在 `ragService.ts` 中新增 `GraphRAGSearchResult` 接口，扩展 `RAGSearchResult` 添加 `hopDistance: number`、`relationshipPath: string`、`relationshipType: string` 字段
  - [x] SubTask 3.2: 在 `ragService.ts` 中新增 `graphAugmentedSearch(query, userId, options)` 方法，先调用 `semanticSearch` 获取种子节点，再调用 `graphTraversalService.getNeighbors` 获取扩展节点，合并结果
  - [x] SubTask 3.3: 实现种子节点与扩展节点的合并排序逻辑：种子节点按相似度排序在前，扩展节点按跳数+关系权重排序在后

- [x] Task 4: 修改 RAG 上下文构建 — 支持图增强
  - [x] SubTask 4.1: 修改 `contextWindowManager.buildContext` 方法，新增 `graphSources` 参数，支持图扩展节点的上下文注入
  - [x] SubTask 4.2: 实现上下文预算分配：种子节点占 70%，图扩展节点占 30%，在各自预算内按优先级填充
  - [x] SubTask 4.3: 图扩展节点的上下文格式包含关系路径信息（如"[2跳] A → 依赖 → B → 包含 → C"）

- [x] Task 5: 修改 RAG 聊天 — 集成图增强
  - [x] SubTask 5.1: 修改 `ragService.chat` 方法，新增 `useGraphContext` 和 `graphHops` 选项，当启用时使用 `graphAugmentedSearch` 替代 `semanticSearch`
  - [x] SubTask 5.2: 修改 `ragService.streamChat` 方法，同上
  - [x] SubTask 5.3: 修改系统 Prompt，当图增强启用时添加关系推理指引："以下知识节点之间存在图谱关系，请利用这些关系进行推理和解释"
  - [x] SubTask 5.4: 修改 `ragService.buildContext` 方法，支持 `useGraphContext` 选项

- [x] Task 6: 修改 RAG 路由 — 新增请求参数
  - [x] SubTask 6.1: 修改 `api/routes/rag.ts` 中的 `ragChatSchema`，添加 `use_graph_context: z.boolean().optional()` 和 `graph_hops: z.number().min(1).max(3).optional()`
  - [x] SubTask 6.2: 修改 `ragSearchSchema`，添加相同参数
  - [x] SubTask 6.3: 在 `/rag/chat`、`/rag/chat/stream`、`/rag/search` 路由处理函数中传递新参数到服务层

- [x] Task 7: 修改前端 API 和 UI
  - [x] SubTask 7.1: 修改 `src/services/api/rag.ts`，在 `chat`、`chatStream`、`search` 方法中添加 `use_graph_context` 和 `graph_hops` 参数
  - [x] SubTask 7.2: 修改 `src/components/RAGChat/ChatMessage.tsx`，在 source 展示区域添加关系路径信息（如"通过 A→B→C 关联"）
  - [x] SubTask 7.3: 在 RAG 聊天面板添加图增强开关（Toggle 按钮），默认关闭

# Task Dependencies

- Task 1 是 Task 2 的前置依赖（数据库函数需先就绪）
- Task 2 是 Task 3 的前置依赖（遍历服务需先就绪）
- Task 3 是 Task 4 的前置依赖（图增强搜索需先就绪）
- Task 4 是 Task 5 的前置依赖（上下文构建需先支持图增强）
- Task 5 是 Task 6 的前置依赖（服务层需先完成）
- Task 6 和 Task 7 可并行执行（后端路由和前端 API 互不依赖）
