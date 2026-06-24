# Tasks

- [x] Task 1: 提取 `useFocusNode` Hook
  - [x] 1.1: 创建 `src/hooks/graphEditor/useFocusNode.ts`，封装节点焦点设置逻辑（setSelectedNode, setSelectedNodeIds, setFocusedNodeId, setFocusedNodeIds, setFocusedLinkIds, setForceShowTextIds）
  - [x] 1.2: 提供 `focusNode(nodeId)` 和 `focusNodeWithNode(node)` 方法
  - [x] 1.3: 提供 `clearFocus()` 方法
  - [x] 1.4: 在 GraphEditor.tsx 中替换 9 处重复的焦点设置代码
  - [x] 1.5: 在 GraphEditor.tsx 的 `useGraphEditorState` 导出中添加 useFocusNode

- [x] Task 2: 提取 `useNodeStatusSets` Hook
  - [x] 2.1: 创建 `src/hooks/graphEditor/useNodeStatusSets.ts`，从 nodeStatus 一次性计算 lockedNodeIds/masteredNodeIds/dueTodayNodeIds/graphStats
  - [x] 2.2: 替换 GraphEditor.tsx 中 3 个重复的 useMemo（L778-819）

- [x] Task 3: 提取 `computeRegions` 工具函数
  - [x] 3.1: 创建 `src/lib/graph/regions.ts`，将 L821-949 的 regions 计算逻辑提取为纯函数
  - [x] 3.2: 在 GraphEditor.tsx 中替换原有的 regions useMemo

- [x] Task 4: 提取 `useGraphEditorPanelState` Hook
  - [x] 4.1: 创建 `src/hooks/graphEditor/useGraphEditorPanelState.ts`，集中管理约 15 个面板开关 useState
  - [x] 4.2: 包含 console 状态（isOpen, isMinimized, context, open, close, toggleMinimize）
  - [x] 4.3: 包含 ragChat 状态（isOpen, width, onOpenChange, onWidthChange）
  - [x] 4.4: 在 GraphEditor.tsx 中替换分散的 useState 声明

- [x] Task 5: 提取 `useBranchSelection` Hook
  - [x] 5.1: 创建 `src/hooks/graphEditor/useBranchSelection.ts`，封装分支选择和创建流程
  - [x] 5.2: 实现 `selectBranch(selectedSuggestion)` 方法
  - [x] 5.3: 实现 `switchBranch(pathItem, selectedSuggestion)` 方法
  - [x] 5.4: 替换 MindMapCanvas onSelectBranch（L1285-1341）
  - [x] 5.5: 替换 TreeView onSelectBranch（L1435-1491）
  - [x] 5.6: 替换 TreeView onSwitchBranch（L1492-1557）
  - [x] 5.7: 替换 ExplorationTimeline onSwitchBranch（L1804-1863）

- [x] Task 6: 将 `handleExecuteAction` 移入 `useGraphAIOperations`
  - [x] 6.1: 将 L1130-1177 的 handleExecuteAction 逻辑移入 `src/hooks/graphAI/useGraphAIOperations.ts`
  - [x] 6.2: 在 GraphEditor.tsx 中改为调用 `aiOps.handleExecuteAction`

- [x] Task 7: 消除 `as any` 类型断言
  - [x] 7.1: 修复 L724 `mutations: mutations as any` — 为 mutations 添加正确的类型
  - [x] 7.2: 修复 L1930 `nodeStatus={nodeStatus as any}` — 为 nodeStatus 添加正确的类型定义

- [x] Task 8: 更新导出和验证
  - [x] 8.1: 在 `src/hooks/graphEditor/index.ts` 中导出新增的 Hook
  - [x] 8.2: 运行 `npm run check` 确保类型检查通过
  - [x] 8.3: 运行 `npm run lint` 确保代码规范通过

# Task Dependencies

- Task 1 (useFocusNode) 是 Task 5 (useBranchSelection) 的前置依赖，因为 useBranchSelection 内部需要调用 focusNode
- Task 4 (useGraphEditorPanelState) 和 Task 2 (useNodeStatusSets) 和 Task 3 (computeRegions) 互相独立，可并行
- Task 6 (handleExecuteAction 移动) 和 Task 7 (消除 as any) 互相独立，可并行
- Task 8 (验证) 依赖所有其他 Task 完成
