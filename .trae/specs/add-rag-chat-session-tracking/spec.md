# RAG Chat 会话追踪与性能监控分组 Spec

## Why

RAG Chat（智能问答）当前没有会话追踪机制——每次对话请求都是独立的，性能日志中不会记录 sessionId。用户在同一轮对话中（不刷新页面的情况下）针对同一知识点的多次问答，在性能监控面板中被分散显示，无法看出它们属于同一次对话。而 AI Chat（`/ai/chat`）已有完整的 session_id 支持，RAG Chat 需要对齐这一能力。

## What Changes

- 前端 `useChatState` hook 增加 `sessionId` 状态，在组件生命周期内保持不变
- 前端 RAG API 层（`ragApi.chatStream`）增加 `session_id` 参数传递
- 前端 `RAGChatPanel` 在调用 `api.rag.chatStream` 时传递 `session_id`
- 后端 RAG 路由 schema 增加 `session_id` 字段，自动生成或接受前端传入
- 后端 RAG 路由通过 SSE 响应头 `X-Session-Id` 返回 sessionId
- 后端 RAG Service 的 `chat` 和 `streamChat` 方法增加 `sessionId` 参数
- 后端 RAG 路由为主要的 chat/stream 操作添加性能监控记录（含 sessionId）
- 后端 `AIMonitoringOptions` 增加 `sessionId` 可选字段，支持 `withAIMonitoring` 传递 sessionId

## Impact

- Affected specs: AI 性能监控系统
- Affected code:
  - `src/components/RAGChat/hooks/useChatState.ts` — 增加 sessionId
  - `src/services/api/rag.ts` — 增加 session_id 参数
  - `src/components/RAGChat/index.tsx` — 传递 session_id
  - `api/routes/rag.ts` — 增加 session_id schema 和性能监控
  - `api/services/ai/ragService.ts` — 增加 sessionId 参数
  - `api/services/ai/aiMonitor.ts` — AIMonitoringOptions 增加 sessionId

## ADDED Requirements

### Requirement: RAG Chat 会话追踪

系统 SHALL 为 RAG Chat 的每次对话会话分配唯一的 sessionId，使得同一轮对话中的多个轮次在性能监控中被归为同一组。

#### Scenario: 用户首次发起 RAG 对话
- **WHEN** 用户在 RAG Chat 面板中发送第一条消息
- **THEN** 前端生成一个 sessionId 并随请求发送到后端
- **AND** 后端将该 sessionId 记录到性能日志中
- **AND** 后端通过 `X-Session-Id` 响应头返回该 sessionId

#### Scenario: 用户在同一轮对话中继续提问
- **WHEN** 用户在不刷新页面的情况下继续发送消息
- **THEN** 前端使用相同的 sessionId 发送后续请求
- **AND** 后端将后续请求的性能日志记录到同一个 sessionId 下

#### Scenario: 用户刷新页面或重新打开 RAG Chat
- **WHEN** 用户刷新页面或关闭后重新打开 RAG Chat
- **THEN** 前端生成新的 sessionId，开始新的对话会话

### Requirement: RAG Chat 性能监控记录

系统 SHALL 为 RAG Chat 的主要操作（chat 和 streamChat）记录性能日志，包含 sessionId 信息。

#### Scenario: RAG Chat 流式对话的性能记录
- **WHEN** 用户发起 RAG Chat 流式对话
- **THEN** 系统记录该次 AI 调用的性能日志（inputTokens、outputTokens、duration 等）
- **AND** 日志中包含 sessionId 字段
- **AND** 日志的 operation 为 `rag_chat` 或 `rag_stream_chat`

#### Scenario: 性能监控面板按会话分组展示
- **WHEN** 用户在性能监控面板查看日志
- **THEN** 同一 sessionId 的 RAG Chat 日志被归入同一会话组
- **AND** 会话组名称标识为"RAG 智能问答"

## MODIFIED Requirements

### Requirement: AIMonitoringOptions 支持 sessionId

`AIMonitoringOptions` 接口 SHALL 增加可选的 `sessionId` 字段，使得通过 `withAIMonitoring` 包装的 AI 调用也能传递 sessionId 到性能日志。

#### Scenario: 使用 withAIMonitoring 并传递 sessionId
- **WHEN** 调用 `withAIMonitoring` 时 options 中包含 sessionId
- **THEN** 该 sessionId 被记录到 `performanceMonitor.recordLog()` 的日志中
