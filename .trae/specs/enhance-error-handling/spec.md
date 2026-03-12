# 完善错误处理机制 Spec

## Why

项目当前错误处理存在以下问题：
1. 后端错误码定义不完整，缺少业务模块相关的错误码（AI 服务、学习系统、任务调度等）
2. 前后端错误码定义不一致，存在重复和不匹配
3. 错误日志缺少结构化上下文，难以追踪和排查问题
4. 缺少请求 ID 追踪机制，无法关联同一请求的多个日志

## What Changes

- 统一并扩展错误码定义，覆盖所有业务模块
- 前后端共享错误码定义
- 增强错误日志记录，添加结构化上下文和请求 ID
- 完善错误处理中间件，支持更多错误类型

## Impact

- Affected specs: 整体 API 错误处理、前端错误处理
- Affected code: 
  - `api/config/errorCodes.ts`
  - `api/middleware/errorHandler.ts`
  - `api/utils/logger.ts`
  - `src/utils/errors.ts`

---

## ADDED Requirements

### Requirement: 统一错误码定义

系统 SHALL 提供完整的错误码定义，覆盖所有业务模块。

#### 错误码分类

**认证授权类 (AUTH_*)**
- `AUTH_HEADER_MISSING` - 缺少认证头
- `AUTH_TOKEN_MISSING` - 缺少令牌
- `AUTH_TOKEN_INVALID` - 无效令牌
- `AUTH_TOKEN_EXPIRED` - 令牌过期
- `AUTH_TOKEN_REVOKED` - 令牌已撤销
- `AUTH_UNAUTHORIZED` - 未授权
- `AUTH_FORBIDDEN` - 禁止访问

**资源类 (RESOURCE_*)**
- `RESOURCE_NOT_FOUND` - 资源不存在
- `RESOURCE_GRAPH_NOT_FOUND` - 图谱不存在
- `RESOURCE_NODE_NOT_FOUND` - 节点不存在
- `RESOURCE_CARD_NOT_FOUND` - 卡片不存在
- `RESOURCE_TASK_NOT_FOUND` - 任务不存在
- `RESOURCE_PATH_NOT_FOUND` - 学习路径不存在
- `RESOURCE_TEMPLATE_NOT_FOUND` - 模板不存在

**验证类 (VALIDATION_*)**
- `VALIDATION_ERROR` - 验证错误
- `VALIDATION_INVALID_JSON` - 无效 JSON
- `VALIDATION_INVALID_PARAMS` - 无效参数
- `VALIDATION_MISSING_FIELD` - 缺少必填字段
- `VALIDATION_INVALID_FORMAT` - 格式无效

**数据库类 (DATABASE_*)**
- `DATABASE_DUPLICATE_ENTRY` - 重复条目
- `DATABASE_FOREIGN_KEY_VIOLATION` - 外键约束违反
- `DATABASE_CONNECTION_ERROR` - 数据库连接错误
- `DATABASE_QUERY_ERROR` - 查询错误

**AI 服务类 (AI_*)**
- `AI_SERVICE_UNAVAILABLE` - AI 服务不可用
- `AI_RATE_LIMIT_EXCEEDED` - AI 请求频率超限
- `AI_PROVIDER_ERROR` - AI 提供商错误
- `AI_TIMEOUT` - AI 请求超时
- `AI_INVALID_RESPONSE` - AI 响应无效
- `AI_EMBEDDING_ERROR` - 向量嵌入错误

**学习系统类 (LEARNING_*)**
- `LEARNING_CARD_GENERATION_FAILED` - 卡片生成失败
- `LEARNING_FSRS_ERROR` - FSRS 算法错误
- `LEARNING_PROGRESS_ERROR` - 学习进度错误
- `LEARNING_QUIZ_ERROR` - 测验错误

**任务调度类 (SCHEDULER_*)**
- `SCHEDULER_TASK_CREATION_FAILED` - 任务创建失败
- `SCHEDULER_TASK_EXECUTION_FAILED` - 任务执行失败
- `SCHEDULER_DEPENDENCY_ERROR` - 任务依赖错误
- `SCHEDULER_QUEUE_ERROR` - 队列错误

**文件操作类 (FILE_*)**
- `FILE_NOT_FOUND` - 文件不存在
- `FILE_TOO_LARGE` - 文件过大
- `FILE_INVALID_TYPE` - 文件类型无效
- `FILE_UPLOAD_FAILED` - 文件上传失败

**系统类 (SYSTEM_*)**
- `SYSTEM_INTERNAL_ERROR` - 内部服务器错误
- `SYSTEM_MAINTENANCE` - 系统维护中
- `SYSTEM_CONFIGURATION_ERROR` - 配置错误

#### Scenario: 错误码使用

- **WHEN** 服务层抛出错误
- **THEN** 应使用预定义的错误码，并附带描述性消息

### Requirement: 共享错误码定义

系统 SHALL 在前后端共享错误码定义。

#### Scenario: 共享类型文件

- **WHEN** 开发者需要使用错误码
- **THEN** 可以从共享位置导入统一的错误码定义

### Requirement: 结构化错误日志

系统 SHALL 记录结构化的错误日志，包含完整的上下文信息。

#### 日志字段要求

每条错误日志 SHALL 包含以下字段：
- `timestamp` - 时间戳
- `level` - 日志级别
- `message` - 错误消息
- `code` - 错误码
- `requestId` - 请求唯一标识
- `userId` - 用户 ID（如适用）
- `path` - 请求路径
- `method` - 请求方法
- `statusCode` - HTTP 状态码
- `duration` - 请求处理时长
- `stack` - 错误堆栈（开发环境）
- `context` - 额外上下文信息

#### Scenario: 错误日志记录

- **WHEN** 发生错误
- **THEN** 系统应记录包含所有必要字段的结构化日志

### Requirement: 请求 ID 追踪

系统 SHALL 为每个请求生成唯一的请求 ID，并在所有相关日志中包含该 ID。

#### Scenario: 请求 ID 生成

- **WHEN** 收到 HTTP 请求
- **THEN** 系统应生成或复用请求 ID（优先使用客户端传入的 X-Request-ID 头）

#### Scenario: 响应头包含请求 ID

- **WHEN** 返回响应
- **THEN** 响应头应包含 X-Request-ID

### Requirement: 错误响应格式

系统 SHALL 返回统一格式的错误响应。

#### 响应格式

```typescript
interface ErrorResponse {
  success: false;
  code: string;           // 错误码
  message: string;        // 用户友好的错误消息
  details?: unknown;      // 详细错误信息（如验证错误的具体字段）
  requestId: string;      // 请求 ID
  timestamp: string;      // 时间戳
}
```

#### Scenario: 错误响应返回

- **WHEN** API 返回错误
- **THEN** 应使用统一格式，包含请求 ID 和时间戳

### Requirement: 错误类型扩展

系统 SHALL 提供丰富的错误类型，支持不同业务场景。

#### 错误类型

- `AppError` - 基础错误类
- `AuthError` - 认证错误
- `NotFoundError` - 资源不存在错误
- `ValidationError` - 验证错误
- `DatabaseError` - 数据库错误
- `AIError` - AI 服务错误
- `RateLimitError` - 频率限制错误

#### Scenario: 使用特定错误类型

- **WHEN** 抛出特定类型的错误
- **THEN** 错误应包含正确的状态码、错误码和描述信息

## MODIFIED Requirements

### Requirement: 错误处理中间件增强

现有的错误处理中间件 SHALL 支持更多错误类型和结构化日志。

#### 改进内容

1. 支持所有新增的错误类型
2. 自动附加请求 ID
3. 记录结构化错误日志
4. 返回统一格式的错误响应
