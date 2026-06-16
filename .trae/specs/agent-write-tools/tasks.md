# Tasks

- [x] Task 1: 扩展 Agent 类型系统
  - [x] SubTask 1.1: 在 `api/services/agent/types.ts` 中新增 `ToolCategory`（`"read" | "write"`）、`RiskLevel`（`"low" | "medium" | "high"`）类型
  - [x] SubTask 1.2: 扩展 `AgentTool` 接口，增加 `category`（默认 `"read"`）、`requiresConfirmation`（默认 `false"`）、`riskLevel`（默认 `"low"`）可选字段
  - [x] SubTask 1.3: 新增 `PendingAction` 接口，包含 id、sessionId、toolName、args、category、riskLevel、description、status、result、createdAt、executedAt 字段
  - [x] SubTask 1.4: 扩展 `AgentSession` 的 status 类型，新增 `"awaiting_confirmation"` 状态
  - [x] SubTask 1.5: 扩展 `SkillDefinition` 接口，增加 `allowWrite`（默认 `false`）字段
  - [x] SubTask 1.6: 新增 `PendingActionStatus` 类型（`"pending" | "confirmed" | "rejected" | "expired" | "executed" | "failed"`）

- [x] Task 2: 实现 5 个写入类工具
  - [x] SubTask 2.1: 创建 `api/services/agent/tools/writeTools.ts` 文件
  - [x] SubTask 2.2: 实现 `create_node` 工具 — 在指定图谱中创建知识点节点，category: "write"，riskLevel: "low"
  - [x] SubTask 2.3: 实现 `create_edge` 工具 — 在指定图谱中创建知识关系边，category: "write"，riskLevel: "low"
  - [x] SubTask 2.4: 实现 `create_graph_relation` 工具 — 创建图谱间关系，category: "write"，riskLevel: "medium"
  - [x] SubTask 2.5: 实现 `create_study_card` 工具 — 为知识点创建学习卡片，category: "write"，riskLevel: "low"
  - [x] SubTask 2.6: 实现 `update_node` 工具 — 更新知识点内容，category: "write"，riskLevel: "medium"
  - [x] SubTask 2.7: 在 `api/services/agent/tools/index.ts` 中导出 writeTools 并加入 allTools 数组

- [x] Task 3: 为现有只读工具添加分类标记
  - [x] SubTask 3.1: 为 `graphTools` 的 6 个工具添加 `category: "read"`、`riskLevel: "low"` 标记
  - [x] SubTask 3.2: 为 `analysisTools` 的 6 个工具添加 `category: "read"`、`riskLevel: "low"` 标记
  - [x] SubTask 3.3: 为 `learningTools` 的 4 个工具添加 `category: "read"`、`riskLevel: "low"` 标记
  - [x] SubTask 3.4: 为 `nodeTools` 的 2 个工具添加 `category: "read"`、`riskLevel: "low"` 标记

- [x] Task 4: 扩展 ToolRegistry 支持分类查询
  - [x] SubTask 4.1: 在 `ToolRegistry` 中添加 `getByCategory(category)` 方法，返回指定分类的工具列表
  - [x] SubTask 4.2: 在 `ToolRegistry` 中添加 `getWriteTools()` 便捷方法
  - [x] SubTask 4.3: 修改 `getToolDefinitions()` 方法，支持按技能的 `allowWrite` 过滤写入工具

- [x] Task 5: 扩展 AgentService 执行循环支持确认流程
  - [x] SubTask 5.1: 在 `AgentService` 中添加 `pendingActions` Map，按 sessionId 存储 PendingAction 列表
  - [x] SubTask 5.2: 修改 `executeSession` 方法：当工具为写入类时，创建 PendingAction 而非直接执行，将 session 状态设为 `awaiting_confirmation`
  - [x] SubTask 5.3: 实现 `confirmAction(sessionId, actionId)` 方法 — 执行确认的操作，将结果返回给 Agent 继续执行
  - [x] SubTask 5.4: 实现 `rejectAction(sessionId, actionId)` 方法 — 拒绝操作，将拒绝信息返回给 Agent
  - [x] SubTask 5.5: 实现 `batchConfirmActions(sessionId, actionIds)` 方法 — 批量确认执行
  - [x] SubTask 5.6: 实现 `batchRejectActions(sessionId, actionIds)` 方法 — 批量拒绝
  - [x] SubTask 5.7: 实现 `getPendingActions(sessionId)` 方法 — 获取待确认操作列表
  - [x] SubTask 5.8: 实现操作描述自动生成函数 `generateActionDescription(toolName, args)` — 根据工具名和参数生成人类可读描述
  - [x] SubTask 5.9: 实现 PendingAction 超时检查 — 创建 10 分钟后自动标记为 `expired`

- [x] Task 6: 新增确认流程 API 路由
  - [x] SubTask 6.1: 在 `api/routes/agent.ts` 中添加 `GET /sessions/:id/pending-actions` 路由
  - [x] SubTask 6.2: 添加 `POST /sessions/:id/actions/:actionId/confirm` 路由
  - [x] SubTask 6.3: 添加 `POST /sessions/:id/actions/:actionId/reject` 路由
  - [x] SubTask 6.4: 添加 `POST /sessions/:id/actions/batch-confirm` 路由（含 Zod Schema 验证）
  - [x] SubTask 6.5: 添加 `POST /sessions/:id/actions/batch-reject` 路由（含 Zod Schema 验证）

- [x] Task 7: 新增执行型技能
  - [x] SubTask 7.1: 在 `AgentService` 的 SKILLS 数组中添加 `auto_fix_islands` 技能 — 检测孤岛图谱并提议创建关联关系，allowWrite: true
  - [x] SubTask 7.2: 添加 `auto_expand_knowledge` 技能 — 分析图谱结构并提议创建新节点和关系，allowWrite: true

- [x] Task 8: 前端 API 客户端扩展
  - [x] SubTask 8.1: 在 `src/services/api/agent.ts` 中新增 `PendingAction`、`PendingActionStatus` 类型定义
  - [x] SubTask 8.2: 扩展 `AgentSession` 类型，status 新增 `"awaiting_confirmation"`
  - [x] SubTask 8.3: 新增 `getPendingActions(sessionId)` API 方法
  - [x] SubTask 8.4: 新增 `confirmAction(sessionId, actionId)` API 方法
  - [x] SubTask 8.5: 新增 `rejectAction(sessionId, actionId)` API 方法
  - [x] SubTask 8.6: 新增 `batchConfirmActions(sessionId, actionIds)` API 方法
  - [x] SubTask 8.7: 新增 `batchRejectActions(sessionId, actionIds)` API 方法

- [x] Task 9: 前端 ActionConfirmationPanel 组件
  - [x] SubTask 9.1: 创建 `src/components/GraphMap/ActionConfirmationPanel.tsx` 组件
  - [x] SubTask 9.2: 实现待确认操作列表展示 — 每项显示操作描述、风险等级标签、资源名称
  - [x] SubTask 9.3: 实现逐项确认/拒绝按钮交互
  - [x] SubTask 9.4: 实现批量确认/拒绝按钮交互
  - [x] SubTask 9.5: 实现操作执行结果反馈（成功/失败状态显示）

- [x] Task 10: 前端 AgentAnalysisPanel 集成确认流程
  - [x] SubTask 10.1: 修改 `AgentAnalysisPanel.tsx`，在 Agent 会话进入 `awaiting_confirmation` 状态时展示 ActionConfirmationPanel
  - [x] SubTask 10.2: 实现确认/拒绝操作后的会话状态刷新
  - [x] SubTask 10.3: 实现确认操作后 Agent 继续执行的状态展示
  - [x] SubTask 10.4: 在 SkillSelector 中为执行型技能添加"执行型"标签区分

# Task Dependencies

- Task 1 是 Task 2-5 的前置依赖
- Task 2 和 Task 3 可并行执行
- Task 4 依赖 Task 1
- Task 5 依赖 Task 1、Task 2、Task 4
- Task 6 依赖 Task 5
- Task 7 依赖 Task 2、Task 5
- Task 8 依赖 Task 1（类型定义对齐）
- Task 9 依赖 Task 8
- Task 10 依赖 Task 9
