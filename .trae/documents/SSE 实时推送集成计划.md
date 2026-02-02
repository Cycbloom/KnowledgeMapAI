# SSE (Server-Sent Events) 集成实施计划

为替代前端轮询，实现任务进度的实时推送，我们将实施以下 SSE 集成方案。该方案采用轻量级单向推送架构，对现有代码侵入性低且高效。

## 1. 核心架构变更

### A. 新增 SSE 服务 (`api/services/sseService.ts`)
创建一个单例 `SSEService`，负责：
- 维护 `UserId -> Response[]` 的连接池映射。
- 处理连接生命周期（接入、断开、Keep-alive）。
- 提供 `sendToUser(userId, data)` 广播接口。

### B. 新增 SSE 路由 (`api/routes/tasks.ts`)
新增端点 `GET /api/tasks/events`：
- 仅允许认证用户连接。
- 设置标准 SSE 响应头 (`text/event-stream`, `no-cache`, `keep-alive`)。
- 连接建立时自动注册到 `SSEService`。

### C. 改造任务服务 (`api/services/taskService.ts`)
修改 `updateTaskStatus` 方法：
- 增加可选参数 `userId`。
- 在成功更新数据库后，若存在 `userId`，则调用 `sseService.sendToUser` 广播事件。
- 事件类型定义为 `task_update`，包含 `taskId`, `status`, `progress` 等关键信息。

### D. 更新调用链路
- 在 `processBatchGenerateCards` 等长任务逻辑中，调用 `updateTaskStatus` 时显式传入 `userId`，确保进度能被推送到对应用户。

## 2. 执行步骤

1.  **创建服务**: 新建 `api/services/sseService.ts`。
2.  **注册路由**: 修改 `api/routes/tasks.ts`，添加 `/events` 端点。
3.  **增强逻辑**: 修改 `api/services/taskService.ts`，集成广播逻辑并更新所有调用点。
4.  **验证**: 使用 `curl` 或浏览器控制台模拟 SSE 连接，触发任务并验证实时消息接收。

## 3. 预期效果
- 前端建立一个 SSE 连接即可实时收到所有后台任务的进度更新。
- 数据库负载降低（不再需要每 5 秒轮询）。
- 用户体验提升，进度条更新更加流畅（毫秒级响应）。
