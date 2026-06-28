# Round 2 P1 性能与一致性修复 Checklist（顺序 7-12）

## Task 1: keywordSearch 改用 trgm 索引
- [x] `ragService.ts:275` 将 `.ilike."${safePattern}"` 改为 `.like."${safePattern}"`
- [x] `12_indexes.sql:26-27` 中 trgm GIN 索引已存在（`idx_knowledge_points_title_trgm`、`idx_knowledge_points_content_trgm`）
- [x] `escapePostgrestValue` 对 `%` 通配符处理正确（like/ilike 通配符语义相同）
- [x] 同步更新注释（ilike → like）
- [x] `npm run check && npm run lint` 通过

## Task 2: 添加复合索引
- [x] `12_indexes.sql` 追加 `idx_agent_messages_session_ts ON agent_messages(session_id, timestamp ASC)`
- [x] `12_indexes.sql` 追加 `idx_agent_tool_calls_session_ts ON agent_tool_calls(session_id, timestamp ASC)`
- [x] `12_indexes.sql` 追加 `idx_ai_perf_logs_session_ts ON ai_performance_logs(session_id, timestamp DESC)`
- [x] 索引方向与查询 `.order('timestamp', { ascending })` 匹配（ASC/ASC/DESC）
- [x] `npm run check` 通过

## Task 3: requireAdmin 去重
- [x] `ownership.ts` 删除 `requireAdmin` 函数
- [x] `ownership.ts` 移除不再使用的 `import { authService }`
- [x] `knowledgePoints.ts` 改从 `auth.ts` 导入 `requireAdmin`
- [x] `auth.ts` 的 `requireAdmin` 加 cacheService 缓存（key: `user_role:${userId}`，TTL 300s）
- [x] 缓存写入 fire-and-forget（避免破坏测试微任务顺序）
- [x] `auth.test.ts` 添加 cacheService mock
- [x] `npx vitest run api/__tests__/middleware/auth.test.ts` 19/19 通过
- [x] `npm run check && npm run lint` 通过

## Task 4: 推广 getOrSet
- [x] `promptService.ts` getTemplate 改用 getOrSet（TTL 60s）
- [x] `knowledgeExpansionService.ts` expandKnowledge 改用 getOrSet（TTL 24h）
- [x] `SessionManager.ts` 跳过（使用实例字段 Map，非 cacheService）
- [x] `IndexMappingService.ts` 跳过（使用实例字段 Map + 手动 TTL，非 cacheService）
- [x] `factory.ts` 跳过（provider 缓存已用 Map 单例）
- [x] 保留原 TTL 与错误处理逻辑
- [x] `npm run check && npm run lint` 通过

## Task 5: LRU O(1) 优化
- [x] 安装 `lru-cache@11.5.1` 依赖
- [x] `cacheService.ts` 引入 `LRUCache` from `lru-cache`
- [x] 用 `LRUCache<string, string>` 替代 `accessOrder: Map<string, number>`
- [x] `set` 方法用 `lruTracker.pop()` O(1) 淘汰，替代 O(N) for 循环
- [x] `get` 方法用 `lruTracker.get(key)` 更新访问顺序
- [x] `del`/`flush` 方法同步清理 lruTracker
- [x] 保留 `tagIndex`/`keyTags`/`pendingRequests`/`stochasticTTL` 机制
- [x] `npm run check && npm run lint` 通过

## Task 6: createGraph 事务一致性
- [x] `createGraph` 的 `options` 新增 `domains` 参数
- [x] 事务路径用 `executeInTransaction` 包装 graph insert + domain insert
- [x] domain 归一化逻辑镜像 `updateGraphDomains`
- [x] transactionExecutor 不可用时降级为当前行为 + logger.warn
- [x] 修正 `schemas/index.ts` 中 `createGraphSchema.domains` 类型（string[] → 对象数组）
- [x] `graphs/crud.ts` 将 domains 传入 createGraph options，移除 updateGraphDomains 调用
- [x] 保留 backbone modules / task creation / cache invalidation 尾部逻辑
- [x] `npm run check && npm run lint` 通过

## 整体验证
- [x] `npm run check` 通过（exit 0）
- [x] `npm run lint` 通过（exit 0）
- [x] 未引入新的 `any` 类型
- [x] 未引入新的非空断言 `!`（除已有的 `req.supabase!` 约定）
- [x] spec 文档保留在 `.trae/specs/round2-db-cache-consistency/`
