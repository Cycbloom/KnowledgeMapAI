# Tasks

- [x] Task 1: Scheduler 列表项 memo 化 + 回调稳定化
  - [x] SubTask 1.1: 为 TaskCard 添加 React.memo 包裹（带自定义比较函数，比较 task.id + task.status + task.updated_at）
  - [x] SubTask 1.2: 为 DraggableTaskCard 添加 React.memo 包裹（同上比较策略）
  - [x] SubTask 1.3: 在 Scheduler.tsx 中为 handleStartTask/handlePauseTask/handleCompleteTask/handleDeleteTask/openEditTaskForm/handleViewTaskDetail 添加 useCallback
  - [x] SubTask 1.4: 在 QueueColumn.tsx 中将 .map() 内的闭包回调改为传递 taskId + 通用回调模式，或使用 useCallback 包裹
  - [x] SubTask 1.5: 在 HorizontalQueue.tsx 中同 SubTask 1.4 处理闭包回调

- [x] Task 2: PlanetView 脏标记 + 颜色分离 + 自转可选化
  - [x] SubTask 2.1: 添加 enableRotation prop（默认 false），移除无条件 rotationAngleRef += 0.003
  - [x] SubTask 2.2: 引入 dirtyFlags ref（matrixDirty/colorDirty），矩阵仅在位置/缩放/旋转变化时标记 dirty，颜色仅在 selectedNodeId/hoveredNodeId/coloringMode/nodeStatus 变化时标记 dirty
  - [x] SubTask 2.3: useFrame 中根据 dirtyFlags 条件执行矩阵/颜色更新，无 dirty 时跳过
  - [x] SubTask 2.4: 将颜色更新逻辑从 useFrame 循环中分离为独立的 useEffect，仅在颜色相关依赖变化时执行

- [x] Task 3: MindMapCanvas useMemo 依赖链拆分
  - [x] SubTask 3.1: 拆分 nodeImportanceMap（7 项依赖）为 nodesForImportance（3 项）+ nodeImportanceMap（4 项）
  - [x] SubTask 3.2: 拆分 edgeStrengthMap（6 项依赖）为 linksForStrength（3 项）+ edgeLookupMap（1 项）+ edgeStrengthMap（3 项）
  - [x] SubTask 3.3: 修复 narrativeFilteredLinks 在非叙事模式下 layoutLinks 的无效依赖
  - [x] SubTask 3.4: 将第 707 行 nodeMap 用 useMemo 包裹，依赖 layout.nodes

- [x] Task 4: calculateNodeImportance 全局预计算优化
  - [x] SubTask 4.1: 在 analysis.ts 中导出 calculateGlobalMaxDegree 和 calculateGlobalMaxChildren 函数
  - [x] SubTask 4.2: 修改 calculateNodeImportance 接受 maxDegree 和 maxChildren 参数，移除内部重复计算
  - [x] SubTask 4.3: 在 MindMapCanvas 中添加 globalMaxDegree/globalMaxChildren 的 useMemo（依赖 nodes, edges, nodeSizeMode），传入 nodeImportanceMap 计算

- [x] Task 5: MindMapCanvas 默认 prop 引用稳定化
  - [x] SubTask 5.1: 在 MindMapCanvas.tsx 组件外部定义 EMPTY_SET/EMPTY_MAP/EMPTY_ARRAY 常量
  - [x] SubTask 5.2: 将 focusedNodeIds/focusedLinkIds/forceShowTextIds/historicalAlternativeBranches/selectedParentIds/learningPathNodeIds/learningPathOrderMap/narrativeRevealedNodeIds 的默认值替换为常量引用

# Task Dependencies
- [Task 4] depends on [Task 3] (globalMaxDegree/globalMaxChildren 的 useMemo 需要在 nodeImportanceMap 拆分后才能正确插入)
- [Task 2] 独立
- [Task 1] 独立
- [Task 5] 独立
