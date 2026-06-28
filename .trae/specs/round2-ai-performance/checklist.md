# Round 2 AI 与性能热点修复 Checklist（顺序 1-6）

## Task 1: AI Provider 单例缓存
- [x] `factory.ts` 顶部新增 `providerCache: Map<AIProviderType, AIProvider>`
- [x] `getAIProvider` 先查缓存，未命中构造并写入
- [x] 新增 `clearProviderCache(type?: AIProviderType)` 导出函数
- [x] `api/routes/ai/config.ts` PUT `/providers` 保存 config 后调用 `clearProviderCache()` + 注释
- [x] `api/services/ai/index.ts` re-export `clearProviderCache`
- [x] `npm run check && npm run lint` 通过

## Task 2: RAG chat/streamChat 加监控
- [x] `ragService.ts` 已 import `withAIMonitoring`
- [x] `chat()` 用 `withAIMonitoring({ operation: "rag_chat" }, ...)` 包装
- [x] `streamChat()` 添加 `stream_options: { include_usage: true }`
- [x] `streamChat()` 用 `withAIMonitoring({ operation: "rag_stream_chat" }, ...)` 包装
- [x] 流式循环中累积 `chunk.usage` 并传给 withAIMonitoring
- [x] 监控上下文含 sessionId/metadata（graphId/userId/currentNodeId/searchMode）
- [x] usage 为 null 时默认 0（provider 不返回 usage 的兼容处理）
- [x] `npm run check && npm run lint` 通过

## Task 3: Embedding 批量 upsert
- [x] `generateEmbeddingsBatch` 用 `upsert(upsertBatch, { onConflict: 'id' })` 替代 N+1 update
- [x] `generateChunkEmbeddingsBatch` 用 `upsert(upsertBatch, { onConflict: 'id' })` 替代 N+1 update
- [x] 保留失败计数逻辑（upsert 失败 `failed += upsertBatch.length`）
- [x] 保留单条 embedding 缺失时 failed++ 逻辑
- [x] 保留 BATCH_SIZE/EMBEDDING_DELAY_MS/stopRequested/isRunning/sleep 控制逻辑
- [x] 20 条 batch 从 20 次 round trip 降至 1 次
- [x] `npm run check && npm run lint` 通过

## Task 4: promptService.getTemplate 服务端过滤
- [x] 采用方案 A（PostgREST `.or()` + 嵌套 `and(...)` 服务端过滤）
- [x] 构造 `.or()` 字符串：`scope.eq.system` + `and(scope.eq.user,user_id.eq.${userId})` + `and(scope.eq.graph,graph_id.eq.${graphId})`
- [x] 移除内存过滤逻辑（relevant = templates.filter(...)）
- [x] 保留 `getWeight` 排序逻辑（Graph=3 > User=2 > System=1）
- [x] 保留 cacheService 60 秒 TTL 缓存
- [x] 参考项目内 `domainService.ts:140` 已有相同嵌套语法的生产实现
- [x] userId/graphId 为 UUID 格式，可安全内插到 `.or()` 字符串
- [x] `npm run check && npm run lint` 通过

## Task 5: enrichMetadata 缓存
- [x] `performanceMonitor.ts` import `cacheService`, `CacheTTL`
- [x] `enrichMetadata` 用 `cacheService.getOrSet` 包装 getGraphInfo/getUserInfo
- [x] 缓存 key：`enrich:graph:${graphId}` 与 `enrich:user:${userId}`
- [x] TTL 使用 `CacheTTL.DYNAMIC`（300 秒）
- [x] 标签化便于批量失效（`["enrich", "graph:${graphId}"]`）
- [x] 避免非空断言：用 `const graphId = baseMetadata.graphId` 类型收窄
- [x] 函数签名与返回值结构不变
- [x] `npm run check && npm run lint` 通过

## Task 6: P1-03 验证已实现
- [x] `embeddingOps.ts` 第 32、45、103、130 行已使用 `withEmbeddingMonitoring`
- [x] `aiService.ts` 的 generateEmbedding/generateEmbeddingsBatch 委托给 embeddingOps
- [x] spec.md 标注 P1-03 已实现，无需修改

## 整体验证
- [x] `npm run check` 通过（exit 0）
- [x] `npm run lint` 通过（exit 0）
- [x] 未引入新的 `any` 类型
- [x] 未引入新的非空断言 `!`
- [x] spec 文档保留在 `.trae/specs/round2-ai-performance/`
