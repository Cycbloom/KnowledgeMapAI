# GraphEditor 页面组件拆分重构 Spec

## Why

GraphEditor.tsx 当前有 2186 行，包含 33 个 useState、9 处重复的节点焦点设置逻辑、2 处 `as any` 类型断言，以及大量内联回调函数。这使得组件难以理解、测试和维护——任何修改都需要在 2000+ 行中定位相关代码，重复逻辑的修改需要同步多处，容易遗漏导致行为不一致。

## What Changes

- 提取 `useFocusNode` Hook，消除 9 处重复的节点焦点设置逻辑
- 提取 `useGraphEditorPanelState` Hook，将面板开关状态（约 15 个 useState）集中管理
- 提取 `useBranchSelection` Hook，消除 MindMapCanvas/TreeView/ExplorationTimeline 中 3 处几乎相同的分支选择回调
- 提取 `useNodeStatusSets` Hook，消除 lockedNodeIds/masteredNodeIds/dueTodayNodeIds 三处重复遍历
- 将 `regions` 计算逻辑（130 行）提取为独立的 `computeRegions` 工具函数
- 将 `handleExecuteAction`（AI 动作执行）移入 `useGraphAIOperations`
- 消除 2 处 `as any` 类型断言

## Impact

- Affected code:
  - `src/pages/GraphEditor.tsx` — 主要重构对象，预计从 2186 行降至约 800 行
  - `src/hooks/graphEditor/` — 新增 4 个 Hook 文件
  - `src/lib/graph/` — 新增 `computeRegions` 工具函数
  - `src/hooks/graphAI/useGraphAIOperations.ts` — 接收 handleExecuteAction

## ADDED Requirements

### Requirement: useFocusNode Hook

系统 SHALL 提供 `useFocusNode` Hook，封装节点焦点设置的完整逻辑。

#### Scenario: 选中节点并设置焦点
- **WHEN** 调用 `focusNode(nodeId)` 或 `focusNodeWithNode(node)`
- **THEN** 系统自动执行以下操作：
  - 设置 selectedNode / selectedNodeIds
  - 设置 focusedNodeId / focusedNodeIds / focusedLinkIds
  - 设置 forceShowTextIds（包含当前节点和直接子节点）

#### Scenario: 清除焦点
- **WHEN** 调用 `clearFocus()`
- **THEN** 系统将 selectedNode、focusedNodeId、focusedNodeIds、focusedLinkIds、forceShowTextIds 全部重置为空

### Requirement: useGraphEditorPanelState Hook

系统 SHALL 提供 `useGraphEditorPanelState` Hook，集中管理所有面板/对话框的开关状态。

#### Scenario: 面板状态管理
- **WHEN** 组件使用 `useGraphEditorPanelState()`
- **THEN** 返回对象包含以下面板状态及其 toggle/close 方法：
  - styleSettings, relationshipTypeSettings, commandPalette, shortcutHelp
  - ragChat (含 width), literatureExtract, researchProgress, literatureLibrary
  - conceptPreview, conceptAggregation, versionHistory, analysisPanel
  - console (含 context, isMinimized)

### Requirement: useBranchSelection Hook

系统 SHALL 提供 `useBranchSelection` Hook，封装分支选择和创建的完整流程。

#### Scenario: 选择分支建议
- **WHEN** 调用 `selectBranch(selectedSuggestion)`
- **THEN** 系统执行：
  1. 为所有建议创建分支节点（标记选中/未选中）
  2. 将选中节点添加到探索路径
  3. 自动聚焦到选中的新节点

#### Scenario: 切换历史分支
- **WHEN** 调用 `switchBranch(pathItem, selectedSuggestion)`
- **THEN** 系统执行：
  1. 为备选分支创建新节点
  2. 更新历史备选分支记录
  3. 自动聚焦到新选中的节点

### Requirement: useNodeStatusSets Hook

系统 SHALL 提供 `useNodeStatusSets` Hook，从 nodeStatus 一次性计算所有状态集合。

#### Scenario: 计算 nodeStatus 派生集合
- **WHEN** 传入 nodeStatus 对象
- **THEN** 返回 `{ lockedNodeIds, masteredNodeIds, dueTodayNodeIds, graphStats }`，每个集合仅遍历一次 nodeStatus

### Requirement: computeRegions 工具函数

系统 SHALL 提供 `computeRegions` 纯函数，将区域计算逻辑从组件中提取。

#### Scenario: topic_research 模板类型
- **WHEN** 传入 template_type 为 "topic_research" 的参数
- **THEN** 根据 backbone_modules 配置计算区域

#### Scenario: 自定义区域
- **WHEN** 传入 customRegions
- **THEN** 按 customRegions 分组计算区域

#### Scenario: 默认层级分组
- **WHEN** 无 backbone_modules 且无 customRegions
- **THEN** 按 level 字段分组计算区域

### Requirement: handleExecuteAction 移入 AI Operations

系统 SHALL 将 `handleExecuteAction` 逻辑从 GraphEditor 移入 `useGraphAIOperations`。

#### Scenario: 执行 AI 动作
- **WHEN** 调用 `aiOps.handleExecuteAction(action, nodeId)`
- **THEN** 执行动作并根据 target_mode 显示结果或刷新数据

## MODIFIED Requirements

### Requirement: GraphEditor 页面组件

GraphEditor 组件 SHALL 仅作为容器组件，负责：
1. 获取数据（useGraph, useGraphData 等）
2. 组合各子 Hook（useFocusNode, useGraphEditorPanelState, useBranchSelection, useNodeStatusSets, useGraphEditorState 等）
3. 渲染子组件（Canvas、Toolbar、Sidebar、Modal 等）

组件 SHALL NOT 包含：
- 直接的节点焦点设置逻辑（应使用 useFocusNode）
- 直接的面板开关 useState（应使用 useGraphEditorPanelState）
- 直接的分支选择回调（应使用 useBranchSelection）
- 直接的 nodeStatus 遍历计算（应使用 useNodeStatusSets）
- 直接的区域计算逻辑（应使用 computeRegions）
- `as any` 类型断言
