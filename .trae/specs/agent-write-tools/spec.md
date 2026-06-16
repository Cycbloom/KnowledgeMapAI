# 执行型 Agent（写入工具）Spec

## Why

当前 Agent 系统的 17 个工具全部为只读（查询/分析），Agent 只能"看"和"说"，不能"做"。用户在 Agent 分析完成后，仍需手动逐项执行建议（如创建关系、添加节点），体验割裂。添加写入工具并配合用户确认机制，可将 Agent 从"分析助手"升级为"执行助手"，实现"分析-提议-确认-执行"的闭环工作流。

## What Changes

- 新增 5 个写入类 Agent 工具：`create_node`、`create_edge`、`create_graph_relation`、`create_study_card`、`update_node`
- 新增 `ToolCategory` 工具分类（`read` / `write`），写入工具需用户确认后执行
- 扩展 `AgentTool` 类型，增加 `category`、`requiresConfirmation`、`riskLevel` 字段
- 新增 `PendingAction` 数据模型，记录待确认的写入操作
- 新增 Agent 会话中的确认流程 API（`/agent/sessions/:id/pending-actions`、`/agent/sessions/:id/actions/:actionId/confirm`、`/agent/sessions/:id/actions/:actionId/reject`）
- 扩展 `AgentService.executeSession` 支持写入工具的暂停-确认-继续流程
- 新增 2 个执行型技能：`auto_fix_islands`（自动修复知识孤岛）、`auto_expand_knowledge`（自动扩展知识）
- 前端新增 `ActionConfirmationPanel` 组件，展示待确认操作并支持逐项审批/批量审批/拒绝
- 前端 `AgentAnalysisPanel` 增加确认步骤流程

## Impact

- Affected specs: Agent 服务、Agent 路由、前端 Agent 面板
- Affected code:
  - `api/services/agent/types.ts` — 新增 ToolCategory、PendingAction 等类型
  - `api/services/agent/AgentService.ts` — 扩展执行循环支持确认流程
  - `api/services/agent/ToolRegistry.ts` — 增加分类查询方法
  - `api/services/agent/tools/` — 新增 writeTools.ts，修改 index.ts
  - `api/routes/agent.ts` — 新增确认流程 API
  - `src/services/api/agent.ts` — 新增确认流程 API 客户端方法
  - `src/components/GraphMap/AgentAnalysisPanel.tsx` — 增加确认步骤
  - `src/components/GraphMap/` — 新增 ActionConfirmationPanel.tsx

## ADDED Requirements

### Requirement: 写入类 Agent 工具

系统 SHALL 提供 5 个写入类 Agent 工具，允许 Agent 在分析基础上提议创建/修改知识图谱数据。

#### Scenario: 创建知识点节点
- **WHEN** Agent 调用 `create_node` 工具，提供 graph_id、title、content、level 参数
- **THEN** 系统创建一个 PendingAction 记录，包含操作类型 `create_node` 和参数，状态为 `pending`，等待用户确认
- **AND** Agent 执行循环暂停，返回待确认操作列表给前端

#### Scenario: 创建知识关系边
- **WHEN** Agent 调用 `create_edge` 工具，提供 graph_id、source_knowledge_point_id、target_knowledge_point_id、relationship_type 参数
- **THEN** 系统创建 PendingAction 记录，等待用户确认

#### Scenario: 创建图谱间关系
- **WHEN** Agent 调用 `create_graph_relation` 工具，提供 source_graph_id、target_graph_id、relation_type、context 参数
- **THEN** 系统创建 PendingAction 记录，等待用户确认

#### Scenario: 创建学习卡片
- **WHEN** Agent 调用 `create_study_card` 工具，提供 knowledge_point_id、question、answer、card_type 参数
- **THEN** 系统创建 PendingAction 记录，等待用户确认

#### Scenario: 更新节点内容
- **WHEN** Agent 调用 `update_node` 工具，提供 knowledge_point_id、title 或 content 更新字段
- **THEN** 系统创建 PendingAction 记录，等待用户确认

---

### Requirement: 工具分类与风险等级

系统 SHALL 为每个 Agent 工具标注分类和风险等级，写入工具默认需要用户确认。

#### Scenario: 工具分类标记
- **WHEN** 注册 Agent 工具时
- **THEN** 每个工具具有 `category` 字段（`read` 或 `write`）和 `riskLevel` 字段（`low`、`medium`、`high`）
- **AND** 所有现有只读工具标记为 `category: "read"`、`riskLevel: "low"`
- **AND** 写入工具标记为 `category: "write"`，风险等级根据操作影响范围设定

#### Scenario: 风险等级设定
- **WHEN** 定义写入工具的风险等级
- **THEN** `create_node` 为 `low`（可轻松删除），`create_edge` 为 `low`，`create_graph_relation` 为 `medium`（影响图谱间结构），`create_study_card` 为 `low`，`update_node` 为 `medium`（修改已有内容）

---

### Requirement: 用户确认流程

系统 SHALL 在 Agent 调用写入工具时暂停执行，等待用户确认后才执行操作。

#### Scenario: 写入操作暂停
- **WHEN** Agent 在执行循环中调用写入类工具
- **THEN** 系统不立即执行操作，而是创建 PendingAction 记录
- **AND** Agent 执行循环进入 `awaiting_confirmation` 状态
- **AND** 通过 API 返回待确认操作列表

#### Scenario: 用户逐项确认
- **WHEN** 用户确认某个 PendingAction
- **THEN** 系统执行该操作，将 PendingAction 状态更新为 `confirmed`
- **AND** 操作执行成功后，将结果返回给 Agent 继续执行

#### Scenario: 用户拒绝操作
- **WHEN** 用户拒绝某个 PendingAction
- **THEN** 系统将 PendingAction 状态更新为 `rejected`，不执行操作
- **AND** 将拒绝信息返回给 Agent，Agent 可调整策略继续执行

#### Scenario: 用户批量确认
- **WHEN** 用户批量确认多个 PendingAction
- **THEN** 系统按顺序执行所有确认的操作
- **AND** 任一操作失败不影响其他操作的执行

#### Scenario: 确认超时
- **WHEN** PendingAction 创建后超过 10 分钟未确认
- **THEN** 系统自动将 PendingAction 标记为 `expired`，Agent 会话状态更新为 `interrupted`

---

### Requirement: PendingAction 数据模型

系统 SHALL 定义 PendingAction 数据结构，记录待确认的写入操作。

#### Scenario: PendingAction 结构
- **WHEN** 创建 PendingAction
- **THEN** 包含以下字段：`id`（唯一标识）、`sessionId`（关联会话）、`toolName`（工具名）、`args`（工具参数）、`category`（操作分类）、`riskLevel`（风险等级）、`description`（人类可读的操作描述）、`status`（`pending`/`confirmed`/`rejected`/`expired`/`executed`/`failed`）、`result`（执行结果）、`createdAt`、`executedAt`

#### Scenario: 操作描述自动生成
- **WHEN** 创建 PendingAction
- **THEN** 系统根据工具名和参数自动生成人类可读的描述，如"在图谱「机器学习」中创建节点「梯度下降」"、"在「线性代数」和「机器学习」之间创建前置关系"

---

### Requirement: 确认流程 API

系统 SHALL 提供确认流程的 REST API。

#### Scenario: 获取待确认操作列表
- **WHEN** GET `/api/agent/sessions/:id/pending-actions`
- **THEN** 返回该会话所有 `pending` 状态的 PendingAction 列表

#### Scenario: 确认单个操作
- **WHEN** POST `/api/agent/sessions/:id/actions/:actionId/confirm`
- **THEN** 执行该操作，返回执行结果，Agent 会话继续

#### Scenario: 拒绝单个操作
- **WHEN** POST `/api/agent/sessions/:id/actions/:actionId/reject`
- **THEN** 标记操作为拒绝，返回拒绝确认，Agent 会话继续

#### Scenario: 批量确认
- **WHEN** POST `/api/agent/sessions/:id/actions/batch-confirm`，提供 actionIds 数组
- **THEN** 按顺序执行所有确认操作，返回每个操作的执行结果

#### Scenario: 批量拒绝
- **WHEN** POST `/api/agent/sessions/:id/actions/batch-reject`，提供 actionIds 数组
- **THEN** 标记所有操作为拒绝

---

### Requirement: 执行型技能

系统 SHALL 提供 2 个新的执行型技能，利用写入工具实现自动化操作。

#### Scenario: 自动修复知识孤岛
- **WHEN** 用户选择 `auto_fix_islands` 技能
- **THEN** Agent 使用 `get_isolated_graphs` 检测孤岛图谱，使用 `get_similar_graphs` 发现相似图谱，使用 `create_graph_relation` 提议创建关联关系
- **AND** 所有创建关系的操作需用户确认后执行

#### Scenario: 自动扩展知识
- **WHEN** 用户选择 `auto_expand_knowledge` 技能
- **THEN** Agent 使用 `analyze_graph_structure` 分析图谱结构，识别叶子节点，使用 AI 生成扩展建议，使用 `create_node` 和 `create_edge` 提议创建新节点和关系
- **AND** 所有创建操作需用户确认后执行

---

### Requirement: 前端确认面板

系统 SHALL 在前端提供操作确认面板，展示待确认操作并支持审批。

#### Scenario: 展示待确认操作
- **WHEN** Agent 会话进入 `awaiting_confirmation` 状态
- **THEN** 前端展示 ActionConfirmationPanel，列出所有待确认操作
- **AND** 每个操作显示：操作描述、风险等级标签、涉及的资源名称

#### Scenario: 逐项审批
- **WHEN** 用户点击某个操作的"确认"按钮
- **THEN** 前端调用确认 API，操作执行后从列表中移除或标记为已执行

#### Scenario: 批量审批
- **WHEN** 用户点击"全部确认"按钮
- **THEN** 前端调用批量确认 API，所有操作执行后更新列表

#### Scenario: 拒绝操作
- **WHEN** 用户点击某个操作的"拒绝"按钮
- **THEN** 前端调用拒绝 API，操作从列表中移除

#### Scenario: 操作执行结果反馈
- **WHEN** 操作执行完成（成功或失败）
- **THEN** 前端显示执行结果（成功/失败），失败时显示错误原因

## MODIFIED Requirements

### Requirement: AgentTool 类型（现有）

现有 `AgentTool` 接口增加 `category`（`"read" | "write"`，默认 `"read"`）、`requiresConfirmation`（`boolean`，默认 `false`）、`riskLevel`（`"low" | "medium" | "high"`，默认 `"low"`）三个可选字段。

### Requirement: AgentSession 状态（现有）

现有 `AgentSession.status` 新增 `"awaiting_confirmation"` 状态，表示 Agent 正在等待用户确认写入操作。

### Requirement: Agent 执行循环（现有）

现有 `AgentService.executeSession` 的执行循环修改为：当遇到写入工具调用时，不直接执行，而是创建 PendingAction 并将会话状态设为 `awaiting_confirmation`，等待确认后继续。

### Requirement: Agent 技能定义（现有）

现有 `SkillDefinition` 新增 `allowWrite`（`boolean`，默认 `false`）字段，标记该技能是否允许使用写入工具。现有技能默认 `allowWrite: false`。

## REMOVED Requirements

无移除项。
