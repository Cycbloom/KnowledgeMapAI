# Round 2 P1 性能与一致性修复 Spec（顺序 7-12）

## Why

`optimization-roadmap.md` 第二轮顺序 7-12 聚焦数据库性能、缓存优化与代码一致性。经核实源码：
- **P1-10**：`ragService.ts:275` 用 `.ilike."${pattern}"`，PostgREST 的 `ilike` 走全表扫描，未利用 `12_indexes.sql:26-27` 中已有的 `idx_knowledge_points_title_trgm`（pg_trgm GIN 索引，仅在 `LIKE`/`~` 下生效）。
- **P1-05**：`agent_messages`、`agent_tool_calls`、`ai_performance_logs` 仅有单列索引，但查询模式为 `.eq('session_id', ...).order('timestamp', { ascending: true })`，缺 `(session_id, timestamp)` 复合索引，大表 sort 需 filesort。
- **P1-06**：`requireAdmin` 在 `auth.ts:124` 与 `ownership.ts:32` 各有一份实现且逻辑不同（auth.ts 查 `users.role` + `ADMIN_EMAILS` 兜底；ownership.ts 调 `authService.getProfile` 无兜底）。`knowledgePoints.ts:14` 从 ownership 导入。
- **P1-07**：5 个文件用 `cacheService.get` + `if (cached) return` + `cacheService.set` 模式，未用现成的 `getOrSet`（含 pending request 去重）。
- **P1-08**：`cacheService.ts:94-106` 在 keys 数 ≥ 1000 时每次 set 都 `for (const [k, t] of accessOrder)` O(N) 全表扫描找最旧 key。
- **P1-09**：`graphs/crud.ts:128-138` 的 `createGraph` + `updateGraphDomains` 不在事务内，domain 创建失败会留下孤立 graph 记录。

## What Changes

- **P1-10**：`ragService.ts:275` 将 `.ilike."${pattern}"` 改为 `.like."${pattern}"`（PostgREST `like` 操作符可走 trgm GIN 索引）
- **P1-05**：`12_indexes.sql` 追加 3 个复合索引：`(session_id, timestamp)` on agent_messages/agent_tool_calls/ai_performance_logs
- **P1-06**：删除 `ownership.ts` 中的 `requireAdmin`；`knowledgePoints.ts:14` 改从 `auth.ts` 导入；`auth.ts` 版本保留（含 `ADMIN_EMAILS` 兜底）+ 加 cacheService 缓存用户角色
- **P1-07**：5 个文件的 `get/set` 模式替换为 `getOrSet`
- **P1-08**：`cacheService.ts` LRU 淘汰改用 `lru-cache` 库（或最小堆）实现 O(1)
- **P1-09**：`graphService.createGraph` 接受 `domains` 参数；用 `transactionExecutor` 包装 graph insert + domain insert

## Impact

- **Affected specs**: RAG 搜索性能、数据库索引、权限中间件、缓存性能、事务一致性
- **Affected code**:
  - `api/services/ai/ragService.ts`（keywordSearch）
  - `supabase/migrations/12_indexes.sql`（追加 3 个复合索引）
  - `api/middleware/ownership.ts`（删除 requireAdmin）
  - `api/middleware/auth.ts`（requireAdmin 加缓存）
  - `api/routes/knowledgePoints.ts`（改导入来源）
  - `api/services/ai/promptService.ts`、`SessionManager.ts`、`knowledgeExpansionService.ts`、`IndexMappingService.ts`（getOrSet 推广）
  - `api/services/common/cacheService.ts`（LRU 优化）
  - `api/services/graph/graphService.ts`（createGraph 加 domains 参数 + 事务）
  - `api/routes/graphs/crud.ts`（移除 updateGraphDomains 调用）

## ADDED Requirements

### Requirement: 复合索引

`12_indexes.sql` SHALL 为以下查询模式添加复合索引：
- `agent_messages(session_id, timestamp ASC)` — 支持 `.eq('session_id', ...).order('timestamp', { ascending: true })`
- `agent_tool_calls(session_id, timestamp ASC)` — 同上
- `ai_performance_logs(session_id, timestamp DESC)` — 支持 `.eq('session_id', ...).order('timestamp', { ascending: false })`

#### Scenario: agent_messages 复合索引生效
- **WHEN** 查询 `SELECT * FROM agent_messages WHERE session_id = ? ORDER BY timestamp ASC`
- **THEN** 使用 `idx_agent_messages_session_ts` 索引，无需 filesort

### Requirement: LRU O(1) 淘汰

`cacheService.ts` 的 LRU 淘汰 SHALL 改用 `lru-cache` 库实现 O(1) 淘汰，替代当前 O(N) 全表扫描。

#### Scenario: 缓存满载时 set 性能
- **WHEN** 缓存 keys 数 ≥ MAX_CACHE_KEYS（1000）时执行 set
- **THEN** LRU 淘汰耗时为 O(1)（非 O(N)）

### Requirement: createGraph 事务一致性

`graphService.createGraph` SHALL 接受 `domains` 参数，当 domains 非空时用 `transactionExecutor` 包装 graph insert + domain insert。

#### Scenario: domain 创建失败时回滚
- **WHEN** graph 创建成功后 domain insert 失败
- **THEN** 整个事务回滚，graph 记录也被撤销

#### Scenario: transactionExecutor 不可用时降级
- **WHEN** `DATABASE_URL` 未配置（transactionExecutor 不可用）
- **THEN** 回退到当前非事务行为（先 create graph，再 update domains，失败时 graph 保留）

## MODIFIED Requirements

### Requirement: keywordSearch 使用 trgm 索引

`ragService.ts` 的 `keywordSearch` SHALL 改用 `.like."${pattern}"` 操作符，使查询能利用 `idx_knowledge_points_title_trgm` 与 `idx_knowledge_points_content_trgm` GIN 索引。

### Requirement: requireAdmin 统一

`requireAdmin` 中间件 SHALL 仅保留 `auth.ts` 一份实现：
- 查询 `users.role` 字段
- 保留 `ADMIN_EMAILS` 环境变量兜底
- 加 cacheService 缓存用户角色（TTL 5 分钟）
- `ownership.ts` 中的 `requireAdmin` 删除
- `knowledgePoints.ts` 改从 `auth.ts` 导入

### Requirement: getOrSet 推广

以下 5 个文件的 `cacheService.get` + `if (cached) return` + `cacheService.set` 模式 SHALL 替换为 `cacheService.getOrSet`：
- `api/services/ai/promptService.ts`（getTemplate 方法）
- `api/services/agent/SessionManager.ts`
- `api/services/ai/knowledgeExpansionService.ts`
- `api/services/indexMapping/IndexMappingService.ts`（4 处）
- `api/services/ai/factory.ts`（provider 缓存已用 Map，可保留或改用 getOrSet）

### Requirement: P1-09 createGraph 接受 domains 参数

`graphService.createGraph` SHALL 接受 `domains` 参数，当提供时在事务内创建 graph + domains：
- `graphs/crud.ts` 移除 `updateGraphDomains` 调用，改为传入 `createGraph` 的 options
- `createGraph` 内部用 `transactionExecutor.executeInTransaction` 包装
- 事务内用 raw SQL（PoolClient）执行 insert，失败时整体回滚
- transactionExecutor 不可用时降级为当前行为
