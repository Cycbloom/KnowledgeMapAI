# Tasks

- [x] Task 1: 修改 API 速率限制中间件
  - [x] SubTask 1.1: 在 rateLimiter.ts 中添加环境变量检查
  - [x] SubTask 1.2: 当 DISABLE_RATE_LIMIT=true 或 NODE_ENV=test 时跳过速率限制
  - [x] SubTask 1.3: 添加日志记录速率限制状态

- [x] Task 2: 提高 Supabase 速率限制阈值
  - [x] SubTask 2.1: 修改 supabase/config.toml 中的 auth.rate_limit 配置
  - [x] SubTask 2.2: 将 sign_in_sign_ups 提高到 100000
  - [x] SubTask 2.3: 将 token_verifications 提高到 100000

- [x] Task 3: 更新环境变量配置
  - [x] SubTask 3.1: 在 .env.example 中添加 DISABLE_RATE_LIMIT 说明
  - [x] SubTask 3.2: 确保 Playwright 测试配置正确设置环境变量

- [x] Task 4: 验证修改
  - [x] SubTask 4.1: 重启 Supabase 服务
  - [x] SubTask 4.2: 重启 API 服务
  - [x] SubTask 4.3: 运行 Playwright 测试验证

# Task Dependencies
- Task 2 和 Task 3 可以并行执行
- Task 4 依赖 Task 1-3 完成
