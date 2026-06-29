# Tasks

- [x] Task 1: P3-05 cacheService 抽象 + MemoryCacheStore
  - [x] SubTask 1.1: 新建 `d:\KnowledgeMap\api\services\common\cacheStore.ts`，定义 `CacheInterface` 接口，包含方法：`get<T>(key: string): Promise<T | undefined>`, `set<T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<void>`, `del(key: string): Promise<void>`, `delByTags(tags: string[]): Promise<void>`, `has(key: string): Promise<boolean>`, `clear(): Promise<void>`, `keys(): Promise<string[]>`, `getOrSet<T>(key: string, fetchFn: () => Promise<T>, ttl?: number, tags?: string[]): Promise<T>`
  - [x] SubTask 1.2: 在 `cacheStore.ts` 中实现 `MemoryCacheStore implements CacheInterface`，将 `cacheService.ts` 中现有的 `localCache` + `lruTracker` + `tagIndex` + `keyTags` 逻辑完整迁移到此类（保留 LRU O(1) 淘汰、tag 索引、TTL 随机化防雪崩等所有现有行为）
  - [x] SubTask 1.3: 在 `cacheStore.ts` 中导出 `createCacheStore(): CacheInterface` 工厂函数，根据 `process.env.CACHE_BACKEND`（默认 `memory`）返回实例；`redis` 值时抛 `Error('Redis cache backend not yet implemented. Set CACHE_BACKEND=memory')`
  - [x] SubTask 1.4: 修改 `d:\KnowledgeMap\api\services\common\cacheService.ts`：移除 `localCache` / `lruTracker` / `tagIndex` / `keyTags` 模块级变量，改为 `const cacheStore = createCacheStore()`；将 `cacheService` 对象的所有方法委托给 `cacheStore`；保留 `CacheKeys` / `CacheTTL` 常量；公开 API 签名与行为完全不变
  - [x] SubTask 1.5: 新增 `d:\KnowledgeMap\api\__tests__\services\common\memoryCacheStore.test.ts`，覆盖：set/get 基本存取、TTL 过期、tag 索引 delByTags、getOrSet 请求去重、LRU 淘汰、has/clear/keys
  - [x] SubTask 1.6: 在 `d:\KnowledgeMap\.env.example` 新增 `CACHE_BACKEND=memory`（注释说明未来可切 redis）

- [x] Task 2: P3-06 Rate limiter 抽象 + MemoryRateLimitStore
  - [x] SubTask 2.1: 新建 `d:\KnowledgeMap\api\middleware\rateLimitStore.ts`，定义 `RateLimitStore` 接口，包含方法：`increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }>`, `decrement(key: string): Promise<void>`, `cleanup(): Promise<void>`, `destroy(): void`
  - [x] SubTask 2.2: 在 `rateLimitStore.ts` 中实现 `MemoryRateLimitStore implements RateLimitStore`，将 `rateLimiter.ts` 中现有的 `localStore` Map + `cleanupInterval` 逻辑迁移到此类（保留 60s 定时清理、resetTime 过期判断）
  - [x] SubTask 2.3: 在 `rateLimitStore.ts` 中导出 `createRateLimitStore(): RateLimitStore` 工厂函数，根据 `process.env.RATE_LIMIT_STORE`（默认 `memory`）返回实例；`redis` 值时抛 `Error('Redis rate limit store not yet implemented. Set RATE_LIMIT_STORE=memory')`
  - [x] SubTask 2.4: 修改 `d:\KnowledgeMap\api\middleware\rateLimiter.ts`：移除 `localStore` / `cleanupIntervalId` / `cleanupLocalStore` 模块级变量，改为 `const rateLimitStore = createRateLimitStore()`；`createRateLimiter` 内的计数逻辑委托给 `rateLimitStore.increment`；`skipFailedRequests` 回退委托给 `decrement`；`destroyRateLimiter` 委托给 `rateLimitStore.destroy()`；`rateLimiters` 常量保持不变
  - [x] SubTask 2.5: 新增 `d:\KnowledgeMap\api\__tests__\middleware\memoryRateLimitStore.test.ts`，覆盖：increment 计数递增、windowMs 过期后重置、decrement 回退、cleanup 清理过期项、destroy 停止定时器
  - [x] SubTask 2.6: 在 `d:\KnowledgeMap\.env.example` 新增 `RATE_LIMIT_STORE=memory`（注释说明未来可切 redis）

# Task Dependencies

- Task 1 与 Task 2 互相独立，可并行
- 两个 Task 都修改 `.env.example`，注意合并（同一次 Edit 即可，或最后由一个 Task 统一写入）
