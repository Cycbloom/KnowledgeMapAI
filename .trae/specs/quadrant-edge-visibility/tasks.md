# Tasks

- [x] Task 1: 重构 QuadrantEdge 组件为三档渲染
  - [x] SubTask 1.1: 新增 `hasFocusMode` prop 到 QuadrantEdgeProps 接口
  - [x] SubTask 1.2: 实现三档渲染逻辑：默认（关系颜色 + opacity 0.45 + strokeWidth 1.2 + 保留 dash）、聚焦暗淡（关系颜色 + opacity 0.15 + strokeWidth 1 + 保留 dash）、聚焦高亮（关系颜色 + opacity 1 + strokeWidth 2.5 + glow）
  - [x] SubTask 1.3: 移除非高亮边强制实线逻辑（删除 `strokeDasharray="none"` 覆盖），改为保留关系类型 dash 样式
  - [x] SubTask 1.4: 移除非高亮边统一灰色逻辑，改为使用关系类型颜色

- [x] Task 2: 调整 QuadrantNode 聚焦模式透明度
  - [x] SubTask 2.1: 将非聚焦节点透明度从 0.3 调整为 0.45

- [x] Task 3: 修复 QuadrantCanvas 幽灵高亮问题
  - [x] SubTask 3.1: 新增 `visibleFocusedNodeIds` 计算逻辑 — 基于 `regionEdges` 和 `focusedNodeId`，只包含通过可见边与选中节点直接相连的节点
  - [x] SubTask 3.2: 新增 `visibleFocusedLinkIds` 计算逻辑 — 只包含 `regionEdges` 中且在 `focusedLinkIds` 中的边
  - [x] SubTask 3.3: 将 QuadrantNode 的 `focused` prop 从 `focusedNodeIds.has(node.id)` 改为 `visibleFocusedNodeIds.has(node.id)`
  - [x] SubTask 3.4: 将 QuadrantEdge 的 `highlighted` prop 从 `focusedLinkIds.has(String(edge.id))` 改为 `visibleFocusedLinkIds.has(String(edge.id))`
  - [x] SubTask 3.5: 将 `hasFocusMode` prop 传递给 QuadrantEdge 组件

# Task Dependencies
- Task 1 和 Task 2 可并行
- Task 3 依赖 Task 1（需要 `hasFocusMode` prop）
