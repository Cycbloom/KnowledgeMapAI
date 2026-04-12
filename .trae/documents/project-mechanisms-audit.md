# 项目机制普查报告

## 普查目的

对项目中的各种机制进行全面普查，识别哪些机制已经记录在项目文档中，哪些机制需要补充到文档中，确保项目文档的完整性和可维护性。

## 普查方法

1. 搜索项目中的 Service 文件（共 54 个）
2. 搜索缓存相关文件（共 30 个）
3. 搜索任务队列相关文件（共 57 个）
4. 阅读关键机制文件
5. 对比现有项目文档

## 普查结果

### 已记录在文档中的机制

#### 1. Prompt 管理机制 ✅
**位置**: `api/services/ai/promptService.ts`
**文档位置**: `project_rules.md` - AI 服务开发规范
**关键特性**:
- 三层 Prompt 管理（System、User、Graph）
- 模板变量替换（Handlebars）
- JSON 格式定义（OUTPUT_SCHEMAS）
- 缓存优化
- 优先级：Graph > User > System

#### 2. AI 监控机制 ✅
**位置**: `api/services/ai/performanceMonitor.ts`
**文档位置**: `project_rules.md` - AI 服务开发规范
**关键特性**:
- Token 使用统计（inputTokens、outputTokens）
- 成本估算（pricingService）
- 性能日志（duration、success rate）
- 数据库持久化（ai_performance_logs 表）
- 内存缓存 + 数据库双模式

### 未记录在文档中的机制

#### 3. 缓存机制 ❌
**位置**: `api/services/common/cacheService.ts`
**重要性**: ⭐⭐⭐⭐⭐（核心机制）
**关键特性**:
- **双模式缓存**: Redis（生产）+ NodeCache（开发/降级）
- **缓存键管理**: 统一的 CacheKeys 常量
- **TTL 随机化**: 防止缓存雪崩（stochasticTTL）
- **标签化缓存**: 支持按标签批量失效
- **请求去重**: pendingRequests 防止重复请求
- **缓存预热**: warmup 方法预加载常用数据
- **统计信息**: hits、misses、kps 监控
- **业务缓存失效**: invalidateGraphCache、invalidateUserGraphsCache

**使用示例**:
```typescript
import { cacheService, CacheKeys } from '../services/common/cacheService';

// 基本使用
const data = await cacheService.get(key);
await cacheService.set(key, value, ttl);

// 带标签的缓存
await cacheService.set(key, value, 300, ['graph', 'user-123']);

// 按标签失效
await cacheService.delByTags(['graph']);

// 请求去重
const data = await cacheService.getOrSet(
  key,
  () => fetchDataFromDB(),
  300
);
```

#### 4. 错误处理机制 ❌
**位置**: `api/middleware/errorHandler.ts`
**重要性**: ⭐⭐⭐⭐⭐（核心机制）
**关键特性**:
- **统一错误处理中间件**: errorHandler
- **自定义错误类**: AppError
- **错误代码系统**: ErrorCode、ErrorCodeMessages、ErrorCodeStatus
- **敏感信息过滤**: sanitizeBody 自动过滤密码、token 等
- **请求 ID 追踪**: requestId 贯穿整个请求生命周期
- **数据库错误处理**: 自动识别 PostgreSQL 错误代码（23505、23503）
- **开发/生产环境区分**: 开发环境显示堆栈信息

**使用示例**:
```typescript
import { AppError, ErrorCodes } from '../middleware/errorHandler';

// 抛出业务错误
throw new AppError(ErrorCodes.VALIDATION_REQUIRED_FIELD_MISSING, {
  details: { field: 'title' }
});

// 添加上下文
throw new AppError(ErrorCodes.NOT_FOUND, {
  context: { userId: '123', resource: 'graph' }
});
```

#### 5. 重试机制 ❌
**位置**: `api/utils/retry.ts`
**重要性**: ⭐⭐⭐⭐⭐（核心机制）
**关键特性**:
- **超时控制**: withTimeout
- **指数退避重试**: withRetry
- **组合使用**: withTimeoutAndRetry
- **可配置的重试条件**: isRetryableError
- **自定义重试回调**: onRetry
- **错误类型**: TimeoutError、RetryError

**使用示例**:
```typescript
import { withTimeoutAndRetry, LONG_TIMEOUT } from '../utils/retry';

const result = await withTimeoutAndRetry(
  () => callExternalAPI(),
  {
    timeout: LONG_TIMEOUT, // 3分钟
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    onRetry: (attempt, error) => {
      logger.warn(`Retry ${attempt}: ${error.message}`);
    }
  }
);
```

#### 6. 任务队列机制 ❌
**位置**: `api/services/common/queueService.ts`, `api/jobs/worker.ts`
**重要性**: ⭐⭐⭐⭐（重要机制）
**关键特性**:
- **Redis + BullMQ**: 分布式任务队列
- **任务类型**: expand_graph、generate_questions、embedding_generation
- **并发控制**: concurrency: 5
- **失败重试**: 自动重试机制
- **任务状态追踪**: pending、processing、completed、failed
- **任务优先级**: 支持优先级队列
- **Worker 管理**: 独立的 worker 进程

**使用示例**:
```typescript
import { queueService } from '../services/common/queueService';

// 添加任务
await queueService.addTask({
  type: 'expand_graph',
  userId: 'user-123',
  payload: { nodeId: 'node-456' }
});

// Worker 处理
taskWorker.on('completed', job => {
  logger.info(`Job ${job.id} completed`);
});
```

#### 7. SSE 实时通信机制 ❌
**位置**: `api/services/core/sseService.ts`
**重要性**: ⭐⭐⭐⭐（重要机制）
**关键特性**:
- **用户级连接管理**: Map<userId, Response[]>
- **心跳保活**: 每 25 秒发送 keep-alive
- **自动重连处理**: 客户端断开后自动清理
- **消息广播**: sendToUser 向用户所有连接发送消息
- **连接统计**: 实时统计用户连接数

**使用示例**:
```typescript
import { sseService } from '../services/core/sseService';

// 客户端连接
app.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  sseService.addClient(userId, res);
});

// 发送消息
sseService.sendToUser(userId, {
  type: 'notification',
  message: 'Task completed'
});
```

#### 8. 任务调度机制 ❌
**位置**: `api/services/scheduler/`
**重要性**: ⭐⭐⭐⭐（重要机制）
**关键特性**:
- **智能调度**: smartSchedulerService
- **SM2 算法**: sm2Service（间隔重复学习）
- **效率分析**: efficiencyService
- **任务推荐**: taskRecommendationService
- **进度同步**: progressSyncService
- **专注模式**: focusService
- **任务执行**: executionService

**使用示例**:
```typescript
import { smartSchedulerService } from '../services/scheduler/smartSchedulerService';

// 获取智能推荐
const recommendations = await smartSchedulerService.getSmartRecommendations(
  client,
  userId,
  { date: new Date() }
);
```

#### 9. 自动备份机制 ❌
**位置**: `api/jobs/autoBackupScheduler.ts`
**重要性**: ⭐⭐⭐（辅助机制）
**关键特性**:
- **定时备份**: 定期自动备份数据
- **数据导出**: 导出用户数据
- **备份清理**: 自动清理旧备份

## 机制分类

### 核心机制（必须记录）

1. **缓存机制** - 影响性能和开发效率
2. **错误处理机制** - 影响代码质量和调试
3. **重试机制** - 影响 AI 服务稳定性
4. **任务队列机制** - 影响后台任务处理
5. **SSE 实时通信机制** - 影响实时功能

### 重要机制（建议记录）

6. **任务调度机制** - 影响学习计划和复习
7. **自动备份机制** - 影响数据安全

### 辅助机制（可选记录）

8. **效率分析服务** - 辅助功能
9. **任务推荐服务** - 辅助功能

## 补充计划

### Phase 1: 补充核心机制文档

#### Task 1: 添加缓存机制文档
在 `project_rules.md` 中添加缓存机制章节：
- 缓存架构说明
- 缓存键管理规范
- 使用方式和最佳实践
- 缓存失效策略

#### Task 2: 添加错误处理机制文档
在 `project_rules.md` 中添加错误处理机制章节：
- 统一错误处理中间件
- 自定义错误类使用
- 错误代码定义
- 敏感信息过滤

#### Task 3: 添加重试机制文档
在 `project_rules.md` 中添加重试机制章节：
- 超时和重试策略
- 指数退避算法
- 错误类型识别
- 使用示例

#### Task 4: 添加任务队列机制文档
在 `project_rules.md` 中添加任务队列机制章节：
- 任务队列架构
- 任务类型定义
- Worker 管理
- 任务状态追踪

#### Task 5: 添加 SSE 实时通信机制文档
在 `project_rules.md` 中添加 SSE 机制章节：
- 连接管理
- 消息广播
- 心跳保活
- 使用示例

### Phase 2: 补充重要机制文档

#### Task 6: 添加任务调度机制文档
在 `project_rules.md` 中添加任务调度机制章节：
- 智能调度算法
- SM2 间隔重复算法
- 效率分析
- 任务推荐

#### Task 7: 添加自动备份机制文档
在 `project_rules.md` 中添加自动备份机制章节：
- 备份策略
- 数据导出
- 备份清理

## 预期结果

1. **文档完整性**: 所有核心机制都有详细的使用文档
2. **开发效率**: 新开发者可以快速了解项目架构
3. **代码质量**: 统一的机制使用规范
4. **可维护性**: 机制变更时文档同步更新

## 依赖关系

- Task 1-5 可以并行执行（核心机制）
- Task 6-7 可以并行执行（重要机制）
- 所有任务完成后需要更新文档目录

## 注意事项

1. 文档应该简洁明了，避免过度详细
2. 提供实际的使用示例
3. 说明机制的使用场景和限制
4. 保持与代码实现的一致性
