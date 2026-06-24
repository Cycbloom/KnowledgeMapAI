# Tasks

- [x] Task 1: 移除 client.ts 中的死代码导出
  - [x] SubTask 1.1: `getHeaders`/`handleResponse`/`getCookie` 实际有消费者（agent.ts, ai.ts），保留但改为从 createApiClient 重导出 getCookie
  - [x] SubTask 1.2: 移除 `tryLocalQuery` 函数（已移入 Axios 适配器）
  - [x] SubTask 1.3: 移除 `initCsrf` 函数体，改为从 createApiClient 重导出

- [x] Task 2: 将 Local-First 逻辑提取为 Axios 适配器
  - [x] SubTask 2.1: 在 `createApiClient.ts` 中创建 `localFirstAdapter` 函数
  - [x] SubTask 2.2: 适配器在 Electron 生产环境生效，非 Electron 环境直接使用默认适配器
  - [x] SubTask 2.3: 本地查询成功时返回 `{ data, status, ... }` 兼容响应拦截器

- [x] Task 3: 将 CSRF 初始化集成到 apiClient 创建流程
  - [x] SubTask 3.1: `initCsrf` 移入 `createApiClient.ts`，在实例创建后自动调用
  - [x] SubTask 3.2: `client.ts` 重导出 `initCsrf` 保持向后兼容

- [x] Task 4: 简化 client.ts 的 request() 函数
  - [x] SubTask 4.1: 移除 Local-First 逻辑（已由适配器处理）
  - [x] SubTask 4.2: 移除手动 header 拼接（已由拦截器处理）
  - [x] SubTask 4.3: 简化为 `apiClient.request()` 的参数格式转换薄包装

- [x] Task 5: 类型检查验证
  - [x] SubTask 5.1: `npx tsc --noEmit` 零错误通过
  - [x] SubTask 5.2: 所有消费者行为不变

# Task Dependencies
- [Task 4] depends on [Task 2, Task 3]
- [Task 5] depends on [Task 4]
