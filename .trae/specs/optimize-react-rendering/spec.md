# React 渲染优化 Spec

## Why
项目存在三类显著的渲染性能问题：Scheduler 模块列表项组件完全缺失 React.memo 且回调函数未稳定化，导致每次状态变更触发 15-60 个组件不必要重渲染；PlanetView 每帧无条件全量更新 InstancedMesh 矩阵和颜色，无脏标记机制；MindMapCanvas 的 nodeImportanceMap/edgeStrengthMap 依赖链过长且内部存在重复计算（O(V * N * E)），拖拽时严重卡顿。

## What Changes
- 为 Scheduler 模块的 TaskCard、DraggableTaskCard 添加 React.memo，Scheduler 页面关键回调添加 useCallback
- PlanetView 引入脏标记机制，分离颜色更新，移除无条件球体自转
- MindMapCanvas 拆分长依赖链 useMemo，提取全局预计算，修复默认 prop 引用不稳定问题

## Impact
- Affected specs: 无
- Affected code:
  - `src/components/Scheduler/TaskCard.tsx`
  - `src/components/Scheduler/DraggableTaskCard.tsx`
  - `src/pages/Scheduler.tsx`
  - `src/components/Scheduler/QueueColumn.tsx`
  - `src/components/Scheduler/HorizontalQueue.tsx`
  - `src/three/PlanetView.tsx`
  - `src/components/GraphEditor/canvas/MindMapCanvas.tsx`
  - `src/lib/graph/analysis.ts`

## ADDED Requirements

### Requirement: Scheduler 列表项 memo 化
Scheduler 模块的列表项组件 SHALL 使用 React.memo 包裹，防止父组件状态变更导致不相关列表项重渲染。

#### Scenario: Scheduler 页面状态变更不影响未变化任务卡片
- **WHEN** 用户在 Scheduler 页面切换视图或打开表单弹窗
- **THEN** 已渲染的 TaskCard/DraggableTaskCard 中 task 数据未变化的组件 SHALL NOT 重新渲染

### Requirement: Scheduler 回调函数稳定化
Scheduler 页面传递给子组件的回调函数 SHALL 使用 useCallback 包裹，避免因引用变化触发子组件重渲染。

#### Scenario: 回调引用在无关状态变更时保持稳定
- **WHEN** Scheduler 页面因 showTaskForm 等局部状态变更而重渲染
- **THEN** handleStartTask/handlePauseTask/handleCompleteTask/handleDeleteTask/openEditTaskForm 等回调的引用 SHALL 保持不变

### Requirement: PlanetView 脏标记机制
PlanetView 的 InstancedMesh 更新 SHALL 仅在场景实际变化时执行，静态场景下 SHALL NOT 每帧更新矩阵和颜色。

#### Scenario: 静态场景跳过帧更新
- **WHEN** 场景无动画、无交互、相机静止
- **THEN** useFrame 回调 SHALL NOT 执行 InstancedMesh 矩阵和颜色更新

#### Scenario: 颜色变更独立更新
- **WHEN** 仅 selectedNodeId 或 hoveredNodeId 或 coloringMode 变化
- **THEN** SHALL 仅更新颜色，不重新计算矩阵

### Requirement: PlanetView 球体自转可选化
PlanetView 的球体自转效果 SHALL 改为可选且默认关闭，避免每帧强制更新所有 instance 矩阵。

#### Scenario: 默认无自转
- **WHEN** 用户未启用自转效果
- **THEN** 球体 SHALL 保持静止，矩阵仅在其他因素变化时更新

### Requirement: MindMapCanvas useMemo 依赖链拆分
MindMapCanvas 中依赖数组超过 4 项的 useMemo SHALL 拆分为更小的、职责单一的 useMemo，使昂贵计算仅在真正相关的依赖变化时执行。

#### Scenario: 视口变化不触发重要性重算
- **WHEN** 用户拖拽平移图谱视口，仅可见节点集合变化
- **THEN** nodeImportanceMap SHALL NOT 重新计算（因为 nodes/edges/nodeStatus 未变）

#### Scenario: 图谱数据变化触发重要性重算
- **WHEN** 图谱的节点或边数据发生变更
- **THEN** nodeImportanceMap SHALL 重新计算

### Requirement: calculateNodeImportance 全局预计算
calculateNodeImportance 中对每个节点重复计算的 maxDegree 和 maxChildren SHALL 提取为独立的预计算步骤，避免 O(V * N * E) 的重复计算。

#### Scenario: maxDegree/maxChildren 只计算一次
- **WHEN** nodeImportanceMap 需要重新计算
- **THEN** maxDegree 和 maxChildren SHALL 各只计算一次，作为参数传入 calculateNodeImportance

### Requirement: MindMapCanvas 默认 prop 引用稳定化
MindMapCanvas 中 Set/Map/Array 类型的默认 prop 值 SHALL 使用组件外常量，避免每次渲染创建新引用触发下游 useMemo 重算。

#### Scenario: 未传递 narrativeRevealedNodeIds 时不触发重算
- **WHEN** 父组件未传递 narrativeRevealedNodeIds prop
- **THEN** 默认值 SHALL 使用稳定的模块级常量，不因引用变化触发 narrativeFilteredNodes/narrativeFilteredLinks 重算

### Requirement: edgeStrengthMap 中 edges.find 替换为 Map 查找
edgeStrengthMap 计算中的 edges.find 线性查找 SHALL 替换为预构建的 Map 查找，将 O(E) 降为 O(1)。

#### Scenario: 边强度计算使用 Map 查找
- **WHEN** edgeStrengthMap 需要根据 link.id 查找对应的 edge
- **THEN** SHALL 使用预构建的 Map<id, Edge> 查找，而非 Array.find
