# Tasks

- [x] Task 1: 创建 TokenRefreshManager 类
  - [x] SubTask 1.1: 实现 TokenRefreshManager 单例类
  - [x] SubTask 1.2: 实现 token 刷新队列管理逻辑
  - [x] SubTask 1.3: 实现 shouldRefreshToken 方法判断是否需要刷新
  - [x] SubTask 1.4: 实现 refreshAccessToken 方法执行刷新
  - [x] SubTask 1.5: 添加单元测试

- [x] Task 2: 创建 Axios API 客户端工厂函数
  - [x] SubTask 2.1: 创建 createApiClient 函数
  - [x] SubTask 2.2: 实现请求拦截器（添加认证头和 CSRF token）
  - [x] SubTask 2.3: 实现响应拦截器（错误处理和 token 刷新）
  - [x] SubTask 2.4: 配置 Axios 实例（baseURL、credentials 等）

- [x] Task 3: 重构 client.ts 使用新架构
  - [x] SubTask 3.1: 导入 TokenRefreshManager 和 createApiClient
  - [x] SubTask 3.2: 创建并导出 Axios 实例
  - [x] SubTask 3.3: 重构 request 函数使用 Axios 实例
  - [x] SubTask 3.4: 保持 getHeaders、initCsrf 等辅助函数兼容
  - [x] SubTask 3.5: 移除旧的模块级变量和 processQueue 函数

- [x] Task 4: 验证和测试
  - [x] SubTask 4.1: 运行类型检查 `npm run check`
  - [x] SubTask 4.2: 运行代码检查 `npm run lint`
  - [x] SubTask 4.3: 运行认证相关测试 `npx playwright test`

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1, Task 2]
- [Task 4] depends on [Task 3]
