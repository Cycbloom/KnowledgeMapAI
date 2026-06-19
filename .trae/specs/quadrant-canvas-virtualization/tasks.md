# Tasks

- [x] Task 1: 在 QuadrantCanvas 中添加 viewportVersion 状态和 rAF 节流逻辑
  - [x] 添加 `viewportVersion` state 和 `scheduleViewportUpdate` 函数
  - [x] 在 `handleWheel` 和 `handleMouseMove`（拖拽平移时）中调用 `scheduleViewportUpdate`
  - [x] 在 `handleMouseUp` 中调用 `forceUpdate` 确保最终位置准确

- [x] Task 2: 集成虚拟化 hooks 进行视口裁剪
  - [x] 从 `useVirtualization` 导入 `useSpatialGrid`、`useViewportBounds`、`useVisibleNodes`、`useVisibleEdges`、`useVisibleNodeSet`
  - [x] 基于 `adjustedNodePositions` 构建 `layoutNodes` 数组（包含 id/x/y 字段），供空间索引使用
  - [x] 调用 `useSpatialGrid(layoutNodes)` 构建空间索引
  - [x] 调用 `useViewportBounds(transformRef.current, containerSize, 200, viewportVersion)` 计算视口边界
  - [x] 调用 `useVisibleNodes` 过滤可见节点
  - [x] 调用 `useVisibleNodeSet` 构建可见节点 ID 集合
  - [x] 调用 `useVisibleEdges` 过滤可见边

- [x] Task 3: 修改渲染逻辑，仅渲染可见节点和边
  - [x] 将 `regionEdges.map(...)` 替换为 `visibleLayoutEdges.map(...)` 渲染可见边
  - [x] 在节点渲染循环中，仅渲染 `visibleNodeIds` 集合中的节点
  - [x] 保持 RegionBackground 和 RegionHeader 始终渲染（不受虚拟化影响）
  - [x] 保持原点标记始终渲染

# Task Dependencies
- Task 2 depends on Task 1（viewportVersion 是 useViewportBounds 的依赖）
- Task 3 depends on Task 2（需要 visibleNodes/visibleEdges 的计算结果）
