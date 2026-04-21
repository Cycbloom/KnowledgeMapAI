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

### 环境分离

项目支持开发环境与生产环境的数据库分离：

- **开发环境**：使用 Supabase CLI 本地服务
- **生产环境**：使用云端 Supabase 服务

### 本地数据库管理

使用 Supabase CLI 管理本地数据库（推荐）：

```bash
npm run db:local:start    # 启动本地数据库
npm run db:local:stop     # 停止本地数据库
npm run db:local:reset    # 重置本地数据库（删除所有数据）
npm run db:local:status   # 查看本地数据库状态
npm run db:local:logs     # 查看本地数据库日志
```

或直接使用 Supabase CLI：

```bash
npx supabase start        # 启动本地数据库
npx supabase stop         # 停止本地数据库
npx supabase db reset     # 重置本地数据库
npx supabase status       # 查看状态
```

### 本地数据库访问地址

启动后，Supabase CLI 会显示各服务的访问地址，通常为：

| 服务       | 地址                   | 说明              |
| ---------- | ---------------------- | ----------------- |
| API        | http://127.0.0.1:54321 | Supabase API 网关 |
| Studio     | http://127.0.0.1:54323 | Supabase 管理界面 |
| PostgreSQL | localhost:54322        | 直连数据库        |
| Inbucket   | http://127.0.0.1:54324 | 邮件测试服务      |

> 注意：实际端口以 `npx supabase status` 输出为准

### 本地数据库

- **Schema 文件**：`supabase/migrations/` 目录下按业务域组织的模块化 SQL 文件（00-16 为 Schema，17-25 为 Seed）
- **Seed 文件**：`supabase/migrations/` 目录下按数据类型组织的模块化 SQL 文件
- **测试用户**：`test@example.com` / `test123456`（每次 `npx supabase db reset` 后自动创建）
- **迁移文件管理**：所有变更直接修改对应的模块化文件，不创建新的增量迁移文件
- **迁移文件命名**：`{两位序号}_{业务域}.sql`，序号确保执行顺序

### 开发环境配置

开发环境使用 `.env.development` 文件配置，自动连接本地 Supabase：

```bash
# 复制开发环境配置
cp .env.example .env.development

# 启动本地数据库
npm run db:local:start

# 启动开发服务器
npm run dev
```

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

- **内存缓存**：NodeCache（适用于桌面应用）

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
