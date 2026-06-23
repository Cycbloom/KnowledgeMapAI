# AI Agent 流式输出与会话持久化 Spec

## Why

当前 Agent 系统存在三个关键缺陷：(1) 执行整个 ReAct 循环后才一次性返回结果，深度分析（最多 20 轮迭代）期间用户只能看到旋转 Loader，无任何中间反馈；(2) 会话和待确认操作全内存存储，进程重启后全部丢失，`awaiting_confirmation` 状态的会话尤其脆弱；(3) 确认写操作后 ReAct 循环已退出，无法恢复推理，导致执行型 Skill（如 `auto_fix_islands`、`auto_expand_knowledge`）在确认后无法继续工作。此外，结构化输出使用正则解析 JSON，脆弱且不可靠。

## What Changes

- **SSE 流式推送**：`executeSession` 改为 SSE 流式响应，逐步推送工具调用、中间结果和状态变更，前端实时展示 Agent 思考过程
- **会话数据库持久化**：`SessionManager` 从纯内存 Map 改为 Supabase 数据库存储，支持进程重启后恢复会话
- **PendingAction 数据库持久化**：`pendingActions` Map 改为数据库存储，与 Session 同生命周期
- **确认后恢复推理循环**：实现 `resumeSession` 方法，在所有待确认操作处理完毕后重新进入 ReAct 循环
- **结构化输出改用 `response_format`**：`parseStructuredResult` 从正则解析改为使用 OpenAI `response_format: { type: "json_object" }`，提高可靠性
- **前端实时状态展示**：`AgentAnalysisPanel` 在执行阶段实时展示工具调用和中间结果，替代静态 Loader

## Impact

- Affected specs: agent-write-tools（确认后恢复循环是对该 spec 的功能补全）
- Affected code:
  - `api/services/agent/AgentService.ts` — 流式执行、恢复循环、结构化输出
  - `api/services/agent/SessionManager.ts` — 数据库持久化
  - `api/services/agent/types.ts` — 新增 SSE 事件类型、数据库映射类型
  - `api/routes/agent.ts` — execute 路由改为 SSE 响应、新增 resume 路由
  - `src/services/api/agent.ts` — 新增 SSE 客户端、resume API
  - `src/components/GraphMap/AgentAnalysisPanel.tsx` — 实时状态展示
  - `supabase/migrations/` — 新增 agent_sessions、agent_messages、agent_pending_actions 表

## ADDED Requirements

### Requirement: Agent SSE 流式输出

系统 SHALL 在 Agent 执行期间通过 SSE 逐步推送中间状态和结果，而非等待整个 ReAct 循环结束后一次性返回。

#### Scenario: 工具调用开始推送
- **WHEN** Agent 在 ReAct 循环中调用某个工具
- **THEN** 系统通过 SSE 推送 `tool_call_start` 事件，包含工具名称和参数
- **AND** 前端实时显示"正在调用 xxx 工具..."

#### Scenario: 工具调用结果推送
- **WHEN** Agent 工具执行完成
- **THEN** 系统通过 SSE 推送 `tool_call_result` 事件，包含工具名称和执行结果摘要
- **AND** 前端实时更新工具调用日志

#### Scenario: Agent 思考过程推送
- **WHEN** LLM 返回 assistant 消息（非工具调用）
- **THEN** 系统通过 SSE 推送 `agent_message` 事件，包含消息内容
- **AND** 前端实时展示 Agent 的分析思路

#### Scenario: 等待确认状态推送
- **WHEN** Agent 遇到写操作需要用户确认
- **THEN** 系统通过 SSE 推送 `awaiting_confirmation` 事件，包含待确认操作列表
- **AND** SSE 流保持连接（不关闭），等待确认后继续推送

#### Scenario: 执行完成推送
- **WHEN** Agent ReAct 循环正常结束
- **THEN** 系统通过 SSE 推送 `session_completed` 事件，包含最终结果
- **AND** SSE 流关闭

#### Scenario: 执行失败推送
- **WHEN** Agent 执行过程中发生错误
- **THEN** 系统通过 SSE 推送 `session_failed` 事件，包含错误信息
- **AND** SSE 流关闭

---

### Requirement: Agent 会话数据库持久化

系统 SHALL 将 Agent 会话、消息和待确认操作持久化到 Supabase 数据库，支持进程重启后恢复。

#### Scenario: 创建会话时持久化
- **WHEN** 调用 `SessionManager.create()` 创建新会话
- **THEN** 会话数据写入 `agent_sessions` 表
- **AND** 内存中同时保留一份缓存

#### Scenario: 添加消息时持久化
- **WHEN** 调用 `SessionManager.addMessage()` 添加消息
- **THEN** 消息数据写入 `agent_messages` 表
- **AND** 内存缓存同步更新

#### Scenario: 添加工具调用时持久化
- **WHEN** 调用 `SessionManager.addToolCall()` 添加工具调用记录
- **THEN** 工具调用数据写入 `agent_tool_calls` 表

#### Scenario: 进程重启后恢复会话
- **WHEN** 服务进程重启后，客户端请求某个会话
- **THEN** 系统从数据库加载该会话及其消息和工具调用记录
- **AND** `awaiting_confirmation` 状态的会话可继续确认流程

#### Scenario: PendingAction 持久化
- **WHEN** Agent 创建 PendingAction
- **THEN** PendingAction 数据写入 `agent_pending_actions` 表
- **AND** 确认/拒绝/过期操作同步更新数据库状态

---

### Requirement: 确认后恢复推理循环

系统 SHALL 在所有待确认操作处理完毕后，自动恢复 Agent 的 ReAct 推理循环。

#### Scenario: 所有操作确认后恢复
- **WHEN** 用户确认了会话中最后一个 pending 状态的 PendingAction
- **THEN** 系统自动调用 `resumeSession`，重新进入 ReAct 循环
- **AND** Agent 基于已执行操作的结果继续推理
- **AND** 通过 SSE 继续推送后续的中间状态

#### Scenario: 所有操作拒绝后恢复
- **WHEN** 用户拒绝了会话中最后一个 pending 状态的 PendingAction
- **THEN** 系统自动调用 `resumeSession`，将拒绝信息注入 LLM 上下文
- **AND** Agent 根据拒绝反馈调整策略继续推理

#### Scenario: 恢复时重建 LLM 上下文
- **WHEN** `resumeSession` 被调用
- **THEN** 系统从数据库加载会话的完整消息历史
- **AND** 将已确认/拒绝操作的结果作为 tool 消息注入 LLM 上下文
- **AND** 继续执行 ReAct 循环

#### Scenario: 恢复后再次遇到写操作
- **WHEN** 恢复后的 ReAct 循环再次遇到写操作
- **THEN** 系统再次进入 `awaiting_confirmation` 状态，推送新待确认操作
- **AND** 用户可继续确认/拒绝，循环往复直到 Agent 完成分析

---

### Requirement: 结构化输出使用 response_format

系统 SHALL 使用 OpenAI `response_format` 参数替代正则解析，提高结构化输出的可靠性。

#### Scenario: 最终结果请求 JSON 输出
- **WHEN** Agent ReAct 循环结束，LLM 返回最终分析结果
- **THEN** 系统在最后一次 LLM 调用中使用 `response_format: { type: "json_object" }`
- **AND** 系统直接 `JSON.parse` 响应内容，无需正则匹配

#### Scenario: JSON 解析失败降级
- **WHEN** `response_format` 返回的内容仍无法解析为有效 JSON
- **THEN** 系统将原始文本作为 `summary`，`structuredResult` 设为 undefined
- **AND** 不影响 Agent 会话的正常完成

---

### Requirement: 前端实时状态展示

系统 SHALL 在前端 Agent 执行阶段实时展示中间状态，替代静态 Loader。

#### Scenario: 执行阶段实时展示
- **WHEN** Agent 开始执行，SSE 流建立
- **THEN** 前端在执行面板中实时展示：当前调用的工具名称、工具执行结果摘要、Agent 的中间分析消息
- **AND** 使用 SessionLog 组件展示实时日志流

#### Scenario: SSE 连接断开重连
- **WHEN** SSE 连接意外断开
- **THEN** 前端自动重连，从数据库获取最新会话状态
- **AND** 展示断连期间缺失的中间状态

#### Scenario: 等待确认时展示确认面板
- **WHEN** SSE 推送 `awaiting_confirmation` 事件
- **THEN** 前端展示 ActionConfirmationPanel
- **AND** SSE 流保持连接，确认操作后通过 resume 继续接收后续事件

## MODIFIED Requirements

### Requirement: Agent 执行路由（现有）

现有 `POST /sessions/:id/execute` 路由从标准 JSON 响应修改为 SSE 流式响应。响应 Content-Type 改为 `text/event-stream`，事件格式为 `{ type: string, data: unknown }`。

### Requirement: SessionManager（现有）

现有 `SessionManager` 从纯内存 Map 修改为数据库优先+内存缓存模式。`create`/`get`/`update`/`addMessage`/`addToolCall` 方法均先写数据库再更新缓存；`get` 方法在缓存未命中时从数据库加载。

### Requirement: AgentService.executeSession（现有）

现有 `executeSession` 方法从返回 `Promise<ExecuteResult>` 修改为接受 SSE Response 对象，在 ReAct 循环中通过 SSE 推送中间状态。`ExecuteResult.stream` 字段移除（不再需要，SSE 直接写入 Response）。

### Requirement: AgentService.confirmAction/rejectAction（现有）

现有 `confirmAction` 和 `rejectAction` 方法在所有 pending 操作处理完毕后，自动调用 `resumeSession` 恢复 ReAct 循环，而非仅标记状态为 running。

### Requirement: AgentAnalysisPanel 执行阶段（现有）

现有 `AgentAnalysisPanel` 在执行阶段从显示静态 Loader 修改为展示实时 SSE 事件流，包括工具调用日志和 Agent 中间消息。

## REMOVED Requirements

### Requirement: ExecuteResult.stream 字段
**Reason**: SSE 直接写入 Response 对象，不再需要 ReadableStream 字段
**Migration**: 从 `ExecuteResult` 接口中移除 `stream?: ReadableStream<string>` 字段
