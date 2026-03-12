# Checklist

## 错误码定义

- [x] 共享错误码文件已创建，包含所有业务模块的错误码
- [x] 错误码按模块分类（AUTH、RESOURCE、VALIDATION、DATABASE、AI、LEARNING、SCHEDULER、FILE、SYSTEM）
- [x] 每个错误码有对应的默认消息和 HTTP 状态码

## 后端错误处理

- [x] api/config/errorCodes.ts 已更新使用共享错误码
- [x] api/constants/errorCodes.ts 正确重新导出
- [x] AppError 类支持新的错误码和上下文信息

## 前端错误处理

- [x] src/utils/errors.ts 已更新使用共享错误码
- [x] 前端错误类型和辅助函数保持兼容

## 错误日志

- [x] logger.ts 支持结构化日志输出
- [x] 生产环境使用 JSON 格式日志
- [x] 错误日志包含上下文字段

## 请求 ID 追踪

- [x] requestId 中间件已创建
- [x] 请求 ID 在请求开始时生成或复用
- [x] 响应头包含 X-Request-ID
- [x] 错误日志包含请求 ID

## 错误处理中间件

- [x] errorHandler 中间件支持所有新错误类型
- [x] 错误响应格式统一（包含 success、code、message、requestId、timestamp）
- [x] 结构化错误日志正确记录

## 服务层更新

- [x] AI 服务使用 AI_* 错误码
- [x] 学习服务使用 LEARNING_* 错误码
- [x] 任务调度服务使用 SCHEDULER_* 错误码
- [x] 图谱服务使用 RESOURCE_* 错误码

## 测试验证

- [x] 运行 npm run lint 无错误
- [x] 运行 npm run check 无类型错误
- [x] 错误响应格式正确
- [x] 请求 ID 正确追踪
