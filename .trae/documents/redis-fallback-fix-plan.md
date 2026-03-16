# Redis 降级功能修复计划

## 问题分析

### 当前现象
当 `REDIS_URL` 环境变量设置了但 Redis 服务未启动时，系统会报错：
```
Redis Client Error: ECONNREFUSED ::1:6379
Queue Redis connection error: ECONNREFUSED
```

### 根本原因

**降级逻辑存在缺陷**：当前代码检查的是 `REDIS_URL` 环境变量是否存在，而不是 Redis 是否真正可用。

#### 1. `api/utils/redis.ts` 问题
```typescript
if (redisUrl) {
  redisClient = new Redis(redisUrl, {...});  // 即使 Redis 服务不可用，客户端对象仍然存在
}
```
- 当 `REDIS_URL` 存在时，`redisClient` 对象会被创建
- 即使 Redis 服务器不可用，`redisClient` 也不是 `null`
- 连接错误只是被记录，但没有设置"Redis 不可用"的标志

#### 2. `api/services/common/cacheService.ts` 问题
```typescript
const useRedis = !!redisClient;  // 这里检查的是客户端对象是否存在，而不是 Redis 是否可用
```
- 当 `redisClient` 对象存在时，`useRedis` 为 `true`
- 但此时 Redis 服务可能根本无法连接
- 所有缓存操作都会失败

#### 3. `api/services/common/queueService.ts` 问题
```typescript
if (redisUrl) {
  const connection = new Redis(redisUrl, {...});
  taskQueue = new Queue('task-queue', { connection });
}
```
- 类似问题：Queue 创建时假设 Redis 可用
- 连接错误被记录但没有降级处理

## 解决方案

### 方案：添加 Redis 可用性检测和优雅降级

#### 修改 1: `api/utils/redis.ts`
- 添加 `isRedisAvailable` 标志
- 在连接成功时设置为 `true`，连接错误时设置为 `false`
- 导出该标志供其他模块使用

#### 修改 2: `api/services/common/cacheService.ts`
- 使用 `isRedisAvailable` 而不是 `!!redisClient` 来判断是否使用 Redis
- 确保 Redis 不可用时自动降级到内存缓存

#### 修改 3: `api/services/common/queueService.ts`
- 使用 `isRedisAvailable` 来判断是否创建 Queue
- 确保 Redis 不可用时 Queue 功能被禁用而不报错

## 实施步骤

### 步骤 1: 修改 `api/utils/redis.ts`
1. 添加 `isRedisAvailable` 导出变量
2. 在 `connect` 事件中设置 `isRedisAvailable = true`
3. 在 `error` 事件中设置 `isRedisAvailable = false`
4. 初始值为 `false`，只有连接成功才为 `true`

### 步骤 2: 修改 `api/services/common/cacheService.ts`
1. 导入 `isRedisAvailable`
2. 将 `useRedis` 改为使用 `isRedisAvailable`
3. 添加动态检查逻辑，在每次操作时检查 Redis 可用性

### 步骤 3: 修改 `api/services/common/queueService.ts`
1. 导入 `isRedisAvailable`
2. 只有当 `isRedisAvailable` 为 `true` 时才创建 Queue
3. 添加连接状态监听，动态启用/禁用 Queue

### 步骤 4: 测试验证
1. 在没有 Redis 服务的情况下启动应用
2. 验证不再出现 ECONNREFUSED 错误
3. 验证缓存功能正常工作（使用内存缓存）
4. 验证应用功能正常

## 预期结果

1. **无 Redis 服务时**：
   - 不再报 ECONNREFUSED 错误
   - 自动使用内存缓存 (NodeCache)
   - Queue 功能被禁用但不影响其他功能

2. **有 Redis 服务时**：
   - 正常连接 Redis
   - 使用 Redis 缓存
   - Queue 功能正常工作

3. **Redis 服务中途断开**：
   - 自动降级到内存缓存
   - 日志记录降级事件
