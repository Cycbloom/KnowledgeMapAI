# Tasks

- [x] Task 1: 前端 useChatState 增加 sessionId 管理
  - [x] 在 `useChatState.ts` 中增加 `sessionId` 状态（使用 `crypto.randomUUID()` 初始化）
  - [x] 导出 `sessionId` 供 RAGChatPanel 使用

- [x] Task 2: 前端 RAG API 层增加 session_id 参数
  - [x] `src/services/api/rag.ts` 的 `chat` 方法增加 `session_id` 可选参数
  - [x] `src/services/api/rag.ts` 的 `chatStream` 方法增加 `session_id` 可选参数

- [x] Task 3: 前端 RAGChatPanel 传递 session_id
  - [x] `src/components/RAGChat/index.tsx` 的 `handleSend` 函数中从 chatState 获取 sessionId
  - [x] 调用 `api.rag.chatStream` 时传递 `session_id: chatState.sessionId`

- [x] Task 4: 后端 RAG 路由增加 session_id 支持和性能监控
  - [x] `api/routes/rag.ts` 的 `ragChatSchema` 增加 `session_id` 可选字段
  - [x] `/chat` 路由：从请求体获取或生成 sessionId，记录性能日志
  - [x] `/chat/stream` 路由：从请求体获取或生成 sessionId，设置 `X-Session-Id` 响应头，记录性能日志

- [x] Task 5: 后端 RAG Service 增加 sessionId 参数
  - [x] `api/services/ai/ragService.ts` 的 `chat` 方法 options 增加 `sessionId`
  - [x] `api/services/ai/ragService.ts` 的 `streamChat` 方法 options 增加 `sessionId`

- [x] Task 6: 后端 AIMonitoringOptions 增加 sessionId 字段
  - [x] `api/services/ai/aiMonitor.ts` 的 `AIMonitoringOptions` 接口增加 `sessionId?: string`
  - [x] `withAIMonitoring` 函数中将 sessionId 传递给 `performanceMonitor.recordLog()`

# Task Dependencies
- Task 2 依赖 Task 1（需要 sessionId 的来源定义）
- Task 3 依赖 Task 1 和 Task 2（需要 sessionId 状态和 API 参数）
- Task 4 依赖 Task 5 和 Task 6（后端路由需要 Service 和 Monitor 支持）
- Task 5 独立
- Task 6 独立
