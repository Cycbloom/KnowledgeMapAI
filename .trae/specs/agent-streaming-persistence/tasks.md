# Tasks

- [x] Task 1: 创建数据库表和迁移
  - [x] SubTask 1.1: 创建 `supabase/migrations/28_agent_sessions.sql`，定义 `agent_sessions` 表
  - [x] SubTask 1.2: 定义 `agent_messages` 表
  - [x] SubTask 1.3: 定义 `agent_tool_calls` 表
  - [x] SubTask 1.4: 定义 `agent_pending_actions` 表
  - [x] SubTask 1.5: 添加必要的索引、RLS 策略、触发器、Grants

- [x] Task 2: 重构 SessionManager 支持数据库持久化
  - [x] SubTask 2.1: 修改 `SessionManager.create()` — 写入 `agent_sessions` 表后再更新内存缓存
  - [x] SubTask 2.2: 修改 `SessionManager.get()` — 缓存未命中时从数据库加载，含消息和工具调用
  - [x] SubTask 2.3: 修改 `SessionManager.update()` — 先更新数据库再更新缓存
  - [x] SubTask 2.4: 修改 `SessionManager.addMessage()` — 写入 `agent_messages` 表
  - [x] SubTask 2.5: 修改 `SessionManager.addToolCall()` — 写入 `agent_tool_calls` 表
  - [x] SubTask 2.6: 新增 `SessionManager.getByUserId()` — 查询用户的所有会话列表
  - [x] SubTask 2.7: 新增 `SessionManager.deleteSession()` — 删除会话及关联数据

- [x] Task 3: PendingAction 持久化
  - [x] SubTask 3.1: 修改 `AgentService` 的 `pendingActions` — 从内存 Map 改为数据库 `agent_pending_actions` 表
  - [x] SubTask 3.2: 修改 `getPendingActions()` — 从数据库查询 pending 状态的操作
  - [x] SubTask 3.3: 修改 `confirmAction()` — 更新数据库状态为 executed/failed
  - [x] SubTask 3.4: 修改 `rejectAction()` — 更新数据库状态为 rejected
  - [x] SubTask 3.5: 修改 `expirePendingActions()` — 批量更新数据库中过期操作状态

- [x] Task 4: 实现 SSE 流式输出
  - [x] SubTask 4.1: 定义 SSE 事件类型（`AgentSSEEvent`）
  - [x] SubTask 4.2: 修改 `executeSession()` — 接受 `res: Response` 参数，提取 `runReActLoop` 方法
  - [x] SubTask 4.3: 修改 `runReActLoop()` — 工具调用前推送 `tool_call_start`，工具返回后推送 `tool_call_result`
  - [x] SubTask 4.4: 修改 `runReActLoop()` — LLM 返回非工具调用消息时推送 `agent_message`
  - [x] SubTask 4.5: 修改 `runReActLoop()` — 遇到写操作时推送 `awaiting_confirmation`，SSE 流保持连接
  - [x] SubTask 4.6: 修改 `runReActLoop()` — 循环结束时推送 `session_completed` 或 `session_failed`，关闭 SSE 流

- [x] Task 5: 实现确认后恢复推理循环
  - [x] SubTask 5.1: 实现 `resumeSession()` 方法 — 从数据库加载会话消息历史，重建 LLM 上下文，重新进入 ReAct 循环
  - [x] SubTask 5.2: 修改 `confirmAction()` — 所有 pending 操作处理完毕后返回 `needsResume: true`
  - [x] SubTask 5.3: 修改 `rejectAction()` — 所有 pending 操作处理完毕后返回 `needsResume: true`
  - [x] SubTask 5.4: 修改 `batchConfirmActions()` / `batchRejectActions()` — 批量操作完成后返回 `needsResume`

- [x] Task 6: 结构化输出改用 response_format
  - [x] SubTask 6.1: 修改 `parseStructuredResult()` — 直接 `JSON.parse(content)`，移除正则匹配逻辑
  - [x] SubTask 6.2: 在 ReAct 循环最后一次 LLM 调用（无工具调用时）添加 `response_format: { type: "json_object" }`
  - [x] SubTask 6.3: JSON 解析失败时降级为 `summary: content, structuredResult: undefined`

- [x] Task 7: 修改 API 路由
  - [x] SubTask 7.1: 修改 `POST /sessions/:id/execute` — 改为 SSE 响应（Content-Type: text/event-stream）
  - [x] SubTask 7.2: 新增 `POST /sessions/:id/resume` 路由 — 触发恢复推理循环，同样返回 SSE 流
  - [x] SubTask 7.3: 新增 `GET /sessions` 路由 — 查询用户会话列表
  - [x] SubTask 7.4: 新增 `DELETE /sessions/:id` 路由 — 删除会话及关联数据
  - [x] SubTask 7.5: 修改确认/拒绝路由 — 透传 `needsResume` 字段

- [x] Task 8: 前端 SSE 客户端和实时展示
  - [x] SubTask 8.1: 在 `src/services/api/agent.ts` 中新增 `executeSessionStream()` 方法
  - [x] SubTask 8.2: 新增 `resumeSessionStream()` 方法
  - [x] SubTask 8.3: 定义前端 SSE 事件类型，与后端 `AgentSSEEvent` 对齐
  - [x] SubTask 8.4: 修改 `AgentAnalysisPanel` — 执行阶段使用 SSE 流实时更新，替代静态 Loader
  - [x] SubTask 8.5: 修改 `AgentAnalysisPanel` — 确认操作后自动建立 resume SSE 连接
  - [x] SubTask 8.6: 修改 `AgentAnalysisPanel` — SSE 断连时 fallback 到 getSession

- [x] Task 9: 类型更新和清理
  - [x] SubTask 9.1: 从 `ExecuteResult` 接口移除 `stream` 字段（已移除）
  - [x] SubTask 9.2: 更新 `IAgentApi` 合约层接口定义
  - [x] SubTask 9.3: 移动端 `mobileAgentApi` 已通过 `createNotSupportedModule` 自动适配

# Task Dependencies

- Task 1 是 Task 2、Task 3 的前置依赖
- Task 2 和 Task 3 可并行执行
- Task 4 依赖 Task 2
- Task 5 依赖 Task 2、Task 3、Task 4
- Task 6 独立，可与其他 Task 并行
- Task 7 依赖 Task 4、Task 5
- Task 8 依赖 Task 7
- Task 9 依赖 Task 4、Task 7
