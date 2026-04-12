# 项目规则

## 项目概述

**目标平台**：Electron 桌面应用（主要）+ Web 应用（辅助）

## 开发命令

### Electron 开发

```bash
npm run electron:dev          # 开发模式
npm run check:electron        # 类型检查
npm run electron:build        # 构建所有平台
npm run electron:build:win    # 构建 Windows
```

### 数据库操作

```bash
npx supabase db reset         # 重置本地数据库
npm run db:seed               # 插入测试数据
npx supabase db diff          # 查看远程数据库状态
```

### 测试命令

```bash
npm run lint                  # 代码检查
npm run check                 # 类型检查
npx playwright test           # E2E 测试
npx playwright test --grep="功能名称"  # 运行特定测试
```

## 数据库规范

### 本地数据库

- **Schema 文件**：`supabase/migrations/00000000000000_initial_schema.sql`
- **Seed 文件**：`supabase/migrations/00000000000001_initial_seed.sql`
- **测试用户**：`test@example.com` / `test123456`
- **不创建新迁移文件**：所有变更直接修改 000 和 001 文件

### 远程数据库

- **修改流程**：本地修改 → 提取变更 SQL → Supabase Dashboard 执行
- **SQL 模板**：
  ```sql
  ALTER TABLE table_name ADD COLUMN IF NOT EXISTS column_name data_type;
  CREATE INDEX IF NOT EXISTS index_name ON table_name(column_name);
  ```

## 测试规范

### 必须运行测试的场景

1. 提交代码前：`npm run lint` + `npm run check`
2. 功能开发完成后：`npx playwright test`
3. 修改登录/认证代码后：`npx playwright test --grep="登录"`

### 测试原则

- 使用 Page Object Model
- 语义化选择器（`data-testid`、`role`、`label`）
- 避免硬编码等待
- 测试独立性

## 代码规范

### 日志规范

- **前端**：禁止 `console.log/info`，允许 `warn/error`
- **后端**：使用 `logger` 工具，禁止 `console`

### 类型安全

- 禁止 `any` 类型
- 禁止非空断言（`!`）
- 使用可选链（`?.`）和空值合并（`??`）

## AI 服务规范

### Prompt 管理

- **必须从数据库读取**：禁止硬编码
- **三层管理**：System < User < Graph（优先级递增）
- **使用方式**：
  ```typescript
  const prompt = await promptService.getRenderedPrompt(
    supabaseAdmin,
    "prompt_code",
    { variable: "value" },
  );
  ```

### AI 监控

- **必须记录性能数据**：token 使用、成本、时长
- **使用方式**：
  ```typescript
  await performanceMonitor.recordLog({
    operation: "operation_name",
    provider: "openai",
    model: "gpt-4",
    inputTokens: 100,
    outputTokens: 200,
    duration: 1500,
    success: true,
  });
  ```

## 缓存机制

### 架构

- **生产**：Redis
- **开发/降级**：NodeCache
- **自动降级**：Redis 不可用时自动切换

### 使用规范

```typescript
// 基本使用
await cacheService.set(key, value, ttl);
const data = await cacheService.get(key);

// 请求去重（推荐）
const data = await cacheService.getOrSet(
  CacheKeys.GRAPH_NODES(userId, graphId),
  () => fetchFromDB(),
  300,
);

// 标签化缓存
await cacheService.set(key, value, 300, ["graph", `user-${userId}`]);
await cacheService.delByTags(["graph"]);

// 业务缓存失效
await cacheService.invalidateGraphCache(userId, graphId);
```

### 最佳实践

1. 优先使用 `getOrSet`
2. 使用标签便于批量失效
3. TTL 随机化防止缓存雪崩

## 错误处理

### 自定义错误

```typescript
throw new AppError(ErrorCodes.NOT_FOUND, {
  context: { userId: "123", resource: "graph" },
});
```

### 常用错误代码

- `VALIDATION_REQUIRED_FIELD_MISSING` (400)
- `NOT_FOUND` (404)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)

### 特性

- 自动过滤敏感信息
- 请求 ID 追踪

## 重试机制

### 使用方式

```typescript
// 组合使用（推荐）
await withTimeoutAndRetry(() => callAI(), {
  timeout: LONG_TIMEOUT, // 3分钟
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
});
```

### 使用场景

- AI 服务调用
- 外部 API 调用
- 数据库操作

## 任务队列

### 架构

- **队列**：BullMQ
- **存储**：Redis
- **Worker**：独立进程，并发数 5

### 任务类型

- `expand_graph`（高优先级）
- `generate_questions`（中优先级）
- `embedding_generation`（低优先级）

### 使用方式

```typescript
await queueService.addTask({
  type: "expand_graph",
  userId: "user-123",
  payload: { nodeId: "node-456" },
});
```

## SSE 实时通信

### 使用方式

```typescript
// 服务端发送
sseService.sendToUser(userId, {
  type: "notification",
  message: "Task completed",
});

// 客户端接收
const eventSource = new EventSource("/api/sse");
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
};
```

### 特性

- 用户级连接管理
- 心跳保活（25秒）
- 自动清理断开连接

## 任务调度

### SM2 算法

```typescript
const nextReview = sm2Service.calculateNextReview(
  quality, // 0-5
  interval, // 当前间隔
  easeFactor, // 难度因子
);
```

### 智能推荐

```typescript
const recommendations = await taskRecommendationService.getRecommendations(
  client,
  userId,
);
```

## 自动备份

- **定时备份**：定期自动备份
- **增量备份**：只备份变更数据
- **自动清理**：保留最近 30 天

```typescript
const backup = await exportUserData(userId);
```
