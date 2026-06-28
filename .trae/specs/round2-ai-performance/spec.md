# Round 2 AI 与性能热点修复 Spec（顺序 1-6）

## Why

`optimization-roadmap.md` 第二轮聚焦 AI 子系统的性能瓶颈与监控缺口。经核实源码：
- **P1-01**：`factory.ts` 的 `getAIProvider` 每次调用都 `new XxxProvider(config)`，构造函数内 `new OpenAI({...})` 重复初始化 HTTP client，单次 RAG chat 调用 3-5 次。
- **P1-02**：`ragService.ts` 的 `chat()`（行 966-980）与 `streamChat()`（行 1154-1168）均未走 `withAIMonitoring`，RAG 是 token 大户但完全无监控。
- **P1-03**：**已实现** —— `embeddingOps.ts` 第 32、45、103、130 行已使用 `withEmbeddingMonitoring`，无需修改。
- **P1-04**：`embeddingService.ts` 行 64-79 与 149-165 用 `for` 循环单条 `.update().eq('id', ...)`，20 条 batch = 20 次 round trip。
- **P1-11**：`promptService.getTemplate` 行 1191 拉所有同 code 模板到内存再 `.filter`，未利用 PostgREST 服务端过滤。
- **P1-12**：`performanceMonitor.enrichMetadata` 行 563-566 每次 AI 调用前 2 次 DB 查询（graphInfo + userInfo），未缓存。

## What Changes

- **P1-01**: `factory.ts` 引入 `Map<AIProviderType, AIProvider>` 单例缓存，config 变更时显式失效
- **P1-02**: `ragService.ts` 的 `chat()` 与 `streamChat()` 用 `withAIMonitoring` 包装；流式版本读 `chunk.usage`（需 `stream_options: { include_usage: true }`）
- **P1-04**: `embeddingService.ts` 用 PostgREST 批量 upsert 替代 N+1 单条 update
- **P1-11**: `promptService.getTemplate` 改用 PostgREST `.or()` 服务端过滤
- **P1-12**: `enrichMetadata` 走 `cacheService.getOrSet`（key 含 graphId/userId，TTL 5min）

## Impact

- **Affected specs**: AI 性能监控覆盖、RAG 成本可观测性、prompt 服务端过滤、embedding 批量性能
- **Affected code**:
  - `api/services/ai/factory.ts`（provider 单例缓存）
  - `api/services/ai/ragService.ts`（chat/streamChat 加监控）
  - `api/services/ai/embeddingService.ts`（批量 upsert）
  - `api/services/ai/promptService.ts`（getTemplate 服务端过滤）
  - `api/services/ai/performanceMonitor.ts`（enrichMetadata 缓存）

## ADDED Requirements

### Requirement: AI Provider 单例缓存

`factory.ts` SHALL 维护 `Map<AIProviderType, AIProvider>` 单例缓存：
- 同一 provider type 多次调用返回同一实例
- `getProviderConfig` 变更时显式失效缓存（暴露 `clearProviderCache(type?)` 函数）

#### Scenario: 连续调用同一 provider
- **WHEN** `getAIProvider('deepseek')` 被连续调用 3 次
- **THEN** 仅第一次构造 `DeepseekProvider`，后续返回缓存实例

#### Scenario: config 变更后失效
- **WHEN** 调用 `clearProviderCache('deepseek')` 后再次 `getAIProvider('deepseek')`
- **THEN** 重新读取 config 并构造新实例

### Requirement: RAG chat/streamChat 性能监控

`ragService.ts` 的 `chat()` 与 `streamChat()` SHALL 用 `withAIMonitoring` 包装 AI 调用：
- `chat()`：非流式，返回 completion
- `streamChat()`：流式，需 `stream_options: { include_usage: true }`，从最后一个 chunk 的 `usage` 读取 token 统计

#### Scenario: RAG chat 上报监控
- **WHEN** 用户发起 RAG chat 请求
- **THEN** `ai_performance_logs` 中出现 `operation: "rag_chat"` 记录，含 inputTokens/outputTokens/duration/cost

#### Scenario: RAG streamChat 上报监控
- **WHEN** 用户发起 RAG 流式 chat 请求
- **THEN** 流结束后 `ai_performance_logs` 中出现 `operation: "rag_stream_chat"` 记录

### Requirement: Embedding 批量 upsert

`embeddingService.ts` SHALL 用 PostgREST 批量 upsert 替代 N+1 单条 update：
- `generateEmbeddingsBatch`：用 `supabase.from('knowledge_points').upsert(batch, { onConflict: 'id' })`
- `generateChunkEmbeddingsBatch`：用 `supabase.from('document_chunks').upsert(batch, { onConflict: 'id' })`

#### Scenario: 批量更新 20 条 embedding
- **WHEN** 一次 batch 处理 20 条 knowledge_points 的 embedding
- **THEN** 仅发起 1 次 upsert 请求（而非 20 次 update）

### Requirement: enrichMetadata 缓存

`performanceMonitor.enrichMetadata` SHALL 走 `cacheService.getOrSet`：
- 缓存 key 含 graphId 与 userId
- TTL 5 分钟（300 秒）
- 标签化便于失效

#### Scenario: 连续调用同一 graphId/userId
- **WHEN** 5 分钟内连续调用 `enrichMetadata` 同一 graphId+userId 组合
- **THEN** 仅第一次发起 DB 查询，后续返回缓存

#### Scenario: TTL 过期后重新查询
- **WHEN** 超过 5 分钟后再次调用
- **THEN** 重新发起 DB 查询并更新缓存

## MODIFIED Requirements

### Requirement: promptService.getTemplate 服务端过滤

`promptService.getTemplate` SHALL 改用 PostgREST `.or()` 服务端过滤，避免拉取所有同 code 模板到内存：
- `.eq('code', code)` + `.or(\`scope.eq.system,scope.eq.user,user_id.eq.${userId},scope.eq.graph,graph_id.eq.${graphId}\`)`
- 保留内存排序逻辑（Graph > User > System 优先级）
- 保留 cacheService 缓存

### Requirement: P1-03 EmbeddingService 监控（已实现）

**Status**: 已实现，无需修改。
`embeddingOps.ts` 第 32、45、103、130 行已使用 `withEmbeddingMonitoring` 包装 embedding 生成调用，监控数据已上报。
