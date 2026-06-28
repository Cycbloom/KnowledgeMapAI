# Tasks

- [x] Task 1: P1-10 keywordSearch 改用 trgm 索引
  - [x] SubTask 1.1: `ragService.ts:275` 将 `.ilike."${safePattern}"` 改为 `.like."${safePattern}"`
  - [x] SubTask 1.2: 确认 `12_indexes.sql:26-27` 中 trgm GIN 索引已存在
  - [x] SubTask 1.3: 确认 `escapePostgrestValue` 对 `%` 通配符处理正确（like/ilike 通配符语义相同）
  - [x] SubTask 1.4: 同步更新注释（ilike → like）
  - [x] SubTask 1.5: 运行 `npm run check && npm run lint` 验证无误

- [x] Task 2: P1-05 添加复合索引
  - [x] SubTask 2.1: `12_indexes.sql` 末尾追加 `idx_agent_messages_session_ts ON agent_messages(session_id, timestamp ASC)`
  - [x] SubTask 2.2: 追加 `idx_agent_tool_calls_session_ts ON agent_tool_calls(session_id, timestamp ASC)`
  - [x] SubTask 2.3: 追加 `idx_ai_perf_logs_session_ts ON ai_performance_logs(session_id, timestamp DESC)`
  - [x] SubTask 2.4: 确认索引方向与查询 `.order('timestamp', { ascending })` 匹配（ASC/ASC/DESC）
  - [x] SubTask 2.5: 运行 `npm run check` 验证无误

- [x] Task 3: P1-06 requireAdmin 去重
  - [x] SubTask 3.1: 删除 `ownership.ts` 第 32-44 行的 `requireAdmin` 函数
  - [x] SubTask 3.2: 移除 ownership.ts 中不再使用的 `import { authService }`
  - [x] SubTask 3.3: `knowledgePoints.ts:14` 改从 `auth.ts` 导入 `requireAdmin`
  - [x] SubTask 3.4: `auth.ts` 的 `requireAdmin` 加 cacheService 缓存（key: `user_role:${userId}`，TTL 300s）
  - [x] SubTask 3.5: 缓存写入采用 fire-and-forget（避免破坏现有测试的微任务顺序）
  - [x] SubTask 3.6: `auth.test.ts` 添加 cacheService mock 防止跨测试缓存污染
  - [x] SubTask 3.7: 运行 `npm run check && npm run lint && npx vitest run api/__tests__/middleware/auth.test.ts` 验证无误（19/19 通过）

- [x] Task 4: P1-07 推广 getOrSet
  - [x] SubTask 4.1: `promptService.ts` getTemplate 改用 getOrSet（TTL 60s）
  - [x] SubTask 4.2: `knowledgeExpansionService.ts` expandKnowledge 改用 getOrSet（TTL 24h）
  - [x] SubTask 4.3: `SessionManager.ts` 跳过（使用实例字段 Map，非 cacheService）
  - [x] SubTask 4.4: `IndexMappingService.ts` 跳过（使用 4 个实例字段 Map + 手动 TTL，非 cacheService）
  - [x] SubTask 4.5: `factory.ts` 跳过（provider 缓存已用 Map 单例，无需 TTL/去重）
  - [x] SubTask 4.6: 保留原 TTL 与错误处理逻辑
  - [x] SubTask 4.7: 运行 `npm run check && npm run lint` 验证无误

- [x] Task 5: P1-08 LRU O(1) 优化
  - [x] SubTask 5.1: 安装 `lru-cache@11.5.1` 依赖
  - [x] SubTask 5.2: `cacheService.ts` 引入 `LRUCache` from `lru-cache`
  - [x] SubTask 5.3: 用 `LRUCache<string, string>` 替代 `accessOrder: Map<string, number>`（value 存储 key 自身以便 pop() 返回）
  - [x] SubTask 5.4: `set` 方法用 `lruTracker.pop()` O(1) 淘汰，替代 O(N) for 循环
  - [x] SubTask 5.5: `get` 方法用 `lruTracker.get(key)` 更新访问顺序
  - [x] SubTask 5.6: `del`/`flush` 方法同步清理 lruTracker
  - [x] SubTask 5.7: 保留 `tagIndex`/`keyTags`/`pendingRequests`/`stochasticTTL` 机制不变
  - [x] SubTask 5.8: 运行 `npm run check && npm run lint` 验证无误

- [x] Task 6: P1-09 createGraph 事务一致性
  - [x] SubTask 6.1: `graphService.createGraph` 的 `options` 新增 `domains` 参数
  - [x] SubTask 6.2: 事务路径用 `executeInTransaction` 包装 graph insert + domain insert（raw SQL via PoolClient）
  - [x] SubTask 6.3: domain 归一化逻辑镜像 `updateGraphDomains`（任一 is_primary=true 则保持，否则首个为 primary）
  - [x] SubTask 6.4: 降级路径保留当前行为 + logger.warn
  - [x] SubTask 6.5: 修正 `schemas/index.ts` 中 `createGraphSchema.domains` 类型（string[] → 对象数组）
  - [x] SubTask 6.6: `graphs/crud.ts` 将 domains 传入 createGraph options，移除 updateGraphDomains 调用
  - [x] SubTask 6.7: 保留 backbone modules / task creation / cache invalidation 等尾部逻辑
  - [x] SubTask 6.8: 运行 `npm run check && npm run lint` 验证无误

# Task Dependencies

- 所有 Task 之间无强依赖，已并行执行
- Task 4 中 3 个文件跳过（使用实例字段 Map 非 cacheService），仅 2 个文件实际转换
