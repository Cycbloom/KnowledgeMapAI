# Tasks

- [x] Task 1: P1-01 AI Provider 单例缓存
  - [x] SubTask 1.1: 在 `api/services/ai/factory.ts` 顶部新增 `const providerCache = new Map<AIProviderType, AIProvider>();`
  - [x] SubTask 1.2: 修改 `getAIProvider`：先查缓存命中则返回；未命中时构造实例并写入缓存
  - [x] SubTask 1.3: 新增 `clearProviderCache(type?: AIProviderType)` 导出函数：type 缺省清空全部，否则仅清除指定 type
  - [x] SubTask 1.4: 在 `api/routes/ai/config.ts` 的 PUT `/providers` 路由保存 config 后调用 `clearProviderCache()`，并加注释
  - [x] SubTask 1.5: 在 `api/services/ai/index.ts` 中 re-export `clearProviderCache`
  - [x] SubTask 1.6: 运行 `npm run check && npm run lint` 验证无误

- [x] Task 2: P1-02 RAG chat/streamChat 加监控
  - [x] SubTask 2.1: `ragService.ts` 已 import `withAIMonitoring`（行 10）
  - [x] SubTask 2.2: `chat()` 用 `withAIMonitoring({ operation: "rag_chat", provider, model, sessionId, metadata }, ...)` 包装 `withTimeoutAndRetry`
  - [x] SubTask 2.3: `streamChat()` 添加 `stream_options: { include_usage: true }`
  - [x] SubTask 2.4: `streamChat()` 用 `withAIMonitoring({ operation: "rag_stream_chat", ... }, ...)` 包装整个流式接收逻辑
  - [x] SubTask 2.5: 流式循环中累积 `chunk.usage`（持续覆盖以保留最后一个 chunk 的 usage）
  - [x] SubTask 2.6: 运行 `npm run check && npm run lint` 验证无误

- [x] Task 3: P1-04 Embedding 批量 upsert
  - [x] SubTask 3.1: `generateEmbeddingsBatch` 用 `upsert(upsertBatch, { onConflict: 'id' })` 替代 N+1 update（knowledge_points 表）
  - [x] SubTask 3.2: `generateChunkEmbeddingsBatch` 用 `upsert(upsertBatch, { onConflict: 'id' })` 替代 N+1 update（document_chunks 表）
  - [x] SubTask 3.3: 保留失败计数逻辑：upsert 失败时 `failed += upsertBatch.length`，成功时 `processed += upsertBatch.length`
  - [x] SubTask 3.4: 保留单条 embedding 缺失时 `failed++` 逻辑（embeddings[j] 为 null 时不加入 upsertBatch）
  - [x] SubTask 3.5: 运行 `npm run check && npm run lint` 验证无误

- [x] Task 4: P1-11 promptService.getTemplate 服务端过滤
  - [x] SubTask 4.1: 采用方案 A（PostgREST `.or()` + 嵌套 `and(...)` 服务端过滤）
  - [x] SubTask 4.2: 构造 `.or()` 字符串：`scope.eq.system` + `and(scope.eq.user,user_id.eq.${userId})` + `and(scope.eq.graph,graph_id.eq.${graphId})`
  - [x] SubTask 4.3: 移除内存过滤逻辑（relevant = templates.filter(...)），因过滤已下沉到 DB 层
  - [x] SubTask 4.4: 保留 `getWeight` 排序函数（Graph=3 > User=2 > System=1）
  - [x] SubTask 4.5: 保留 cacheService 60 秒 TTL 缓存
  - [x] SubTask 4.6: 运行 `npm run check && npm run lint` 验证无误

- [x] Task 5: P1-12 enrichMetadata 缓存
  - [x] SubTask 5.1: `performanceMonitor.ts` import `cacheService`, `CacheTTL` from `../common/cacheService`
  - [x] SubTask 5.2: `enrichMetadata` 用 `cacheService.getOrSet` 包装 `getGraphInfo`/`getUserInfo`
  - [x] SubTask 5.3: 缓存 key：`enrich:graph:${graphId}` 与 `enrich:user:${userId}`
  - [x] SubTask 5.4: TTL 使用 `CacheTTL.DYNAMIC`（300 秒）
  - [x] SubTask 5.5: 标签化便于批量失效（`["enrich", "graph:${graphId}"]` / `["enrich", "user:${userId}"]`）
  - [x] SubTask 5.6: 运行 `npm run check && npm run lint` 验证无误

- [x] Task 6: P1-03 验证已实现（仅核查，不修改）
  - [x] SubTask 6.1: `embeddingOps.ts` 第 32、45、103、130 行已使用 `withEmbeddingMonitoring`
  - [x] SubTask 6.2: `aiService.ts` 的 `generateEmbedding`/`generateEmbeddingsBatch` 委托给 `embeddingOps`
  - [x] SubTask 6.3: spec.md 与 checklist.md 标注 P1-03 已实现

# Task Dependencies

- 所有 Task 之间无强依赖，已并行执行
- Task 6 是验证任务，已确认 P1-03 无需修改
