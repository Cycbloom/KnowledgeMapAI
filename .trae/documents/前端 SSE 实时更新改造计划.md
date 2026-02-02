# 前端 SSE (Server-Sent Events) 集成实施计划

本计划旨在通过引入 SSE 机制，替换前端现有的低效轮询 (`setInterval` / React Query polling)，实现任务状态的实时更新与通知。

## 1. 核心架构变更

### A. 创建全局事件 Hook (`src/hooks/useTaskEvents.ts`)
- **功能**: 负责建立和维护与后端 `/api/tasks/events` 的 `EventSource` 连接。
- **职责**:
  1.  监听 `task_update` 事件。
  2.  利用 `queryClient.setQueryData` 直接修改 React Query 的 `['tasks']` 缓存。
  3.  **优势**: 所有消费 `useTasks` 的组件（如 `Tasks.tsx` 和 `Layout.tsx`）无需修改任何渲染逻辑，即可自动获得实时数据更新。

### B. 改造数据获取 Hook (`src/hooks/useQueries.ts`)
- **修改**: 移除 `useTasks` 中的 `refetchInterval` 配置。
- **结果**: 停止前端的主动轮询，转为被动接收 SSE 推送。

### C. 全局挂载 (`src/components/Layout.tsx`)
- **操作**: 在 `Layout` 组件中引入并调用 `useTaskEvents`。
- **联动**: 现有的 `lastTaskStatusRef` 逻辑将继续工作，但响应速度会从“最长延迟 15 秒”变为“毫秒级实时”。

## 2. 详细执行步骤

1.  **新建 Hook**: 创建 `src/hooks/useTaskEvents.ts`。
    - 实现 `EventSource` 连接逻辑，处理 token 认证（通过 URL query 或 cookie 传递 token，或者使用 `fetch-event-source` 库来支持 header 传递，**建议优先尝试原生 EventSource + Cookie 或 URL Token 方案**，若后端已支持 header 则使用 polyfill）。
    - *注：根据后端实现，我们将使用 `event-source-polyfill` 以便在 Header 中传递 `Authorization: Bearer <token>`，这是最安全的做法。*

2.  **集成 React Query**: 在 `useTaskEvents.ts` 中实现缓存更新策略。
    - 当收到 `task_update` 时，查找缓存中的对应任务。
    - 如果存在，更新其 `status`, `result`, `error`。
    - 如果不存在（新任务），将其插入列表头部。

3.  **清理轮询**: 修改 `src/hooks/useQueries.ts`，删除 `useTasks` 的轮询参数。

4.  **挂载与验证**: 在 `Layout.tsx` 中使用该 Hook，并验证：
    - 启动一个批量生成任务。
    - 观察 `Tasks` 页面的进度条是否流畅滚动。
    - 观察任务完成时的 Toast 通知是否即时弹出。

## 3. 依赖管理
- 需要安装 `event-source-polyfill` 以支持在连接时发送 Auth Header（标准 `EventSource` 不支持 Headers）。
  ```bash
  npm install event-source-polyfill
  ```

## 4. 预期效果
- **性能**: 网络请求量大幅减少（由每 15s 一次请求变为单一长连接）。
- **体验**: 任务进度条将如流水般顺滑，不再有卡顿感。
- **即时性**: 任务完成通知将实现真正的“实时到达”。
