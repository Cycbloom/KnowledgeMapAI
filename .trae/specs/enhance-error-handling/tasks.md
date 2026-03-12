# Tasks

- [x] Task 1: 创建共享错误码定义文件
  - [x] SubTask 1.1: 在 shared/types 目录创建 errorCodes.ts，定义所有错误码
  - [x] SubTask 1.2: 按业务模块分类组织错误码（AUTH、RESOURCE、VALIDATION、DATABASE、AI、LEARNING、SCHEDULER、FILE、SYSTEM）
  - [x] SubTask 1.3: 为每个错误码定义默认消息和 HTTP 状态码映射

- [x] Task 2: 更新后端错误处理
  - [x] SubTask 2.1: 更新 api/config/errorCodes.ts 从共享文件导入
  - [x] SubTask 2.2: 更新 api/constants/errorCodes.ts 重新导出
  - [x] SubTask 2.3: 扩展 AppError 类，支持新的错误码和上下文

- [x] Task 3: 更新前端错误处理
  - [x] SubTask 3.1: 更新 src/utils/errors.ts 使用共享错误码
  - [x] SubTask 3.2: 保持前端错误类型和辅助函数的兼容性

- [x] Task 4: 增强错误日志记录
  - [x] SubTask 4.1: 更新 logger.ts 支持结构化日志输出
  - [x] SubTask 4.2: 添加 JSON 格式日志选项（生产环境）
  - [x] SubTask 4.3: 添加错误日志上下文字段

- [x] Task 5: 实现请求 ID 追踪
  - [x] SubTask 5.1: 创建 requestId 中间件
  - [x] SubTask 5.2: 在请求开始时生成或复用请求 ID
  - [x] SubTask 5.3: 在响应头中返回请求 ID
  - [x] SubTask 5.4: 在错误日志中包含请求 ID

- [x] Task 6: 更新错误处理中间件
  - [x] SubTask 6.1: 更新 errorHandler 中间件支持新的错误类型
  - [x] SubTask 6.2: 返回统一格式的错误响应（包含 requestId 和 timestamp）
  - [x] SubTask 6.3: 记录结构化错误日志

- [x] Task 7: 更新服务层使用新错误码
  - [x] SubTask 7.1: 更新 AI 服务使用 AI_* 错误码
  - [x] SubTask 7.2: 更新学习服务使用 LEARNING_* 错误码
  - [x] SubTask 7.3: 更新任务调度服务使用 SCHEDULER_* 错误码
  - [x] SubTask 7.4: 更新图谱服务使用 RESOURCE_* 错误码

# Task Dependencies

- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1]
- [Task 5] has no dependencies
- [Task 6] depends on [Task 1], [Task 4], [Task 5]
- [Task 7] depends on [Task 1], [Task 2], [Task 6]
