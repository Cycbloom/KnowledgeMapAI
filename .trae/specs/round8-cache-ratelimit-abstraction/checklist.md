# Round 8 Task 1-2 Checklist

## Task 1: P3-05 cacheService 抽象 + MemoryCacheStore

- [x] `api/services/common/cacheStore.ts` 已创建，导出 `CacheInterface` 接口
- [x] `CacheInterface` 包含方法：get/set/del/delByTags/has/clear/keys/getOrSet
- [x] `MemoryCacheStore implements CacheInterface` 已实现，封装现有 NodeCache + LRU + tag 索引逻辑
- [x] `createCacheStore(): CacheInterface` 工厂函数已导出，根据 `CACHE_BACKEND` 返回实例
- [x] `CACHE_BACKEND=redis` 时抛出未实现错误
- [x] `cacheService.ts` 不再直接操作 `localCache`/`lruTracker`/`tagIndex`/`keyTags`
- [x] `cacheService` 通过注入的 `cacheStore` 委托调用
- [x] `CacheKeys` / `CacheTTL` 常量保持不变
- [x] 公开 API 签名与行为完全不变（向后兼容）
- [x] `api/__tests__/services/common/memoryCacheStore.test.ts` 覆盖 set/get、TTL、tag 索引、getOrSet、LRU、has/clear/keys
- [x] `.env.example` 新增 `CACHE_BACKEND=memory`
- [x] `npm run check` 通过
- [x] `npm run lint` 通过

## Task 2: P3-06 Rate limiter 抽象 + MemoryRateLimitStore

- [x] `api/middleware/rateLimitStore.ts` 已创建，导出 `RateLimitStore` 接口
- [x] `RateLimitStore` 包含方法：increment/decrement/cleanup/destroy
- [x] `MemoryRateLimitStore implements RateLimitStore` 已实现，封装现有 Map + 定时清理逻辑
- [x] `createRateLimitStore(): RateLimitStore` 工厂函数已导出，根据 `RATE_LIMIT_STORE` 返回实例
- [x] `RATE_LIMIT_STORE=redis` 时抛出未实现错误
- [x] `rateLimiter.ts` 不再直接操作 `localStore`/`cleanupIntervalId`/`cleanupLocalStore`
- [x] `createRateLimiter` 内的计数逻辑委托给 `rateLimitStore.increment`
- [x] `skipFailedRequests` 回退委托给 `rateLimitStore.decrement`
- [x] `destroyRateLimiter` 委托给 `rateLimitStore.destroy()`
- [x] `rateLimiters` 常量保持不变
- [x] `api/__tests__/middleware/memoryRateLimitStore.test.ts` 覆盖 increment、windowMs 过期、decrement、cleanup、destroy
- [x] `.env.example` 新增 `RATE_LIMIT_STORE=memory`
- [x] `npm run check` 通过
- [x] `npm run lint` 通过

## 全局验证

- [x] `npm run check` 通过
- [x] `npm run check:electron` 通过
- [x] `npm run lint` 通过
- [x] `npx vitest run` 通过（3 文件 / 69 测试：memoryCacheStore + memoryRateLimitStore + rateLimiter）
- [x] 无新增 `any` 类型（生产代码）
- [x] 无新增非空断言（`!`）
- [x] 无新增 `console.log`/`console.info`（前端）
- [x] 无新增 `console.*`（后端，使用 logger）

## 已知遗留问题（非本轮引入）

- `api/__tests__/utils/retry.test.ts` 中 2 个测试失败（Round 2 遗留）
- Redis 后端实现：本轮仅抽象接口，未实现 Redis 后端。未来 Web 多实例部署时需新建 `RedisCacheStore implements CacheInterface` 和 `RedisRateLimitStore implements RateLimitStore`，并在工厂中切换。
