# Round 8 Task 1-2: Cache 与 Rate Limiter 抽象 Spec

## Why

第 8 轮前两项聚焦于为多实例 Web 部署做准备：
- `cacheService` 当前直接基于 `NodeCache` + `LRUCache` 实现，无接口抽象，多实例部署时各实例缓存不一致
- `rateLimiter` 当前用模块级 `Map` 存储计数，多实例部署时各实例独立计数，限流可被绕过

通过抽象 `CacheInterface` 与 `RateLimitStore` 接口，将现有内存实现封装为实现类，未来可无缝切换为 Redis/Upstash 实现，当前 Electron 单实例行为完全不变。

## What Changes

- **P3-05**：新建 `api/services/common/cacheStore.ts`，定义 `CacheInterface` 抽象接口；将现有 `NodeCache` + `LRUCache` + tag 索引逻辑封装为 `MemoryCacheStore implements CacheInterface`；`cacheService.ts` 改为通过注入的 `cacheStore` 调用，默认 `MemoryCacheStore`
- **P3-06**：新建 `api/middleware/rateLimitStore.ts`，定义 `RateLimitStore` 抽象接口；将现有 `Map` 存储封装为 `MemoryRateLimitStore implements RateLimitStore`；`rateLimiter.ts` 改为通过注入的 store 调用，默认 `MemoryRateLimitStore`
- 不引入 Redis 依赖（ioredis 等），仅预留接口和工厂切换点
- 通过 `CACHE_BACKEND=memory|redis` 和 `RATE_LIMIT_STORE=memory|redis` 环境变量切换（当前仅 memory 实现，redis 值时抛出未实现错误）

## Impact

- **Affected specs**：Round 6 P3-05/P3-06 暂缓项（本spec 完成抽象层），Round 2 P1-07/P1-08（cacheService 性能优化已基于现有实现，抽象后行为不变）
- **Affected code**：
  - `api/services/common/cacheService.ts`（重构为使用注入的 store）
  - `api/services/common/cacheStore.ts`（新建，含接口 + MemoryCacheStore）
  - `api/middleware/rateLimiter.ts`（重构为使用注入的 store）
  - `api/middleware/rateLimitStore.ts`（新建，含接口 + MemoryRateLimitStore）
  - `api/__tests__/services/common/memoryCacheStore.test.ts`（新建）
  - `api/__tests__/middleware/memoryRateLimitStore.test.ts`（新建）
  - `.env.example`（新增 `CACHE_BACKEND` 和 `RATE_LIMIT_STORE` 变量）

## ADDED Requirements

### Requirement: CacheInterface 抽象

#### Scenario: 接口定义
- **WHEN** 系统启动
- **THEN** `api/services/common/cacheStore.ts` 导出 `CacheInterface` 接口，包含方法：`get<T>(key)`, `set<T>(key, value, ttl?, tags?)`, `del(key)`, `delByTags(tags)`, `has(key)`, `clear()`, `keys()`, `getOrSet<T>(key, fetchFn, ttl?, tags?)`
- **AND** 导出 `MemoryCacheStore implements CacheInterface`（封装现有 NodeCache + LRU + tag 索引逻辑）
- **AND** 导出 `createCacheStore(): CacheInterface` 工厂函数，根据 `CACHE_BACKEND` 环境变量返回实例

#### Scenario: 环境变量切换
- **WHEN** `CACHE_BACKEND=memory`（默认）
- **THEN** 返回 `new MemoryCacheStore()`
- **WHEN** `CACHE_BACKEND=redis`
- **THEN** 抛出 `Error('Redis cache backend not yet implemented. Set CACHE_BACKEND=memory')`

### Requirement: RateLimitStore 抽象

#### Scenario: 接口定义
- **WHEN** 系统启动
- **THEN** `api/middleware/rateLimitStore.ts` 导出 `RateLimitStore` 接口，包含方法：`increment(key, windowMs): Promise<{count, resetTime}>`, `decrement(key): Promise<void>`, `cleanup(): Promise<void>`, `destroy(): void`
- **AND** 导出 `MemoryRateLimitStore implements RateLimitStore`（封装现有 Map 逻辑）
- **AND** 导出 `createRateLimitStore(): RateLimitStore` 工厂函数

#### Scenario: 环境变量切换
- **WHEN** `RATE_LIMIT_STORE=memory`（默认）
- **THEN** 返回 `new MemoryRateLimitStore()`
- **WHEN** `RATE_LIMIT_STORE=redis`
- **THEN** 抛出 `Error('Redis rate limit store not yet implemented. Set RATE_LIMIT_STORE=memory')`

## MODIFIED Requirements

### Requirement: cacheService 使用注入的 store

`cacheService` 不再直接操作 `localCache` / `lruTracker` / `tagIndex` / `keyTags`，改为：
- 模块顶部 `const cacheStore = createCacheStore()`
- 所有 `get`/`set`/`del`/`delByTags`/`getOrSet` 方法委托给 `cacheStore`
- `CacheKeys` / `CacheTTL` 常量保持不变
- 公开 API（`cacheService.get`、`cacheService.set` 等）签名与行为完全不变（向后兼容）

### Requirement: rateLimiter 使用注入的 store

`rateLimiter` 不再直接操作 `localStore` Map，改为：
- 模块顶部 `const rateLimitStore = createRateLimitStore()`
- `createRateLimiter` 内的计数逻辑委托给 `rateLimitStore.increment(key, windowMs)`
- `skipFailedRequests` 的回退逻辑委托给 `rateLimitStore.decrement(key)`
- `destroyRateLimiter` 委托给 `rateLimitStore.destroy()`
- `rateLimiters` 常量保持不变

## REMOVED Requirements

### Requirement: 模块级 NodeCache 直接访问

**Reason**: 无法切换后端，多实例部署不一致
**Migration**: 封装到 `MemoryCacheStore` 类中，通过工厂创建

### Requirement: 模块级 Map 直接访问（rateLimiter）

**Reason**: 无法切换后端，多实例可绕过限流
**Migration**: 封装到 `MemoryRateLimitStore` 类中，通过工厂创建
