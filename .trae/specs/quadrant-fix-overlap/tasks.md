# Tasks

- [x] Task 1: QuadrantNode 接收外部位置坐标 — 替代内部自算
  - [x] 1.1 `QuadrantNodeProps` 新增 `positionX?: number` 和 `positionY?: number` 可选 props
  - [x] 1.2 组件内：当 positionX/positionY 存在时，直接使用它们作为 x/y（仍叠加 dragOffset）；不存在时回退到现有自算逻辑
  - [x] 1.3 保留 distanceRatio 的 useMemo，不再驱动最终 x/y

- [x] Task 2: QuadrantCanvas 传入碰撞调整后的坐标
  - [x] 2.1 渲染 QuadrantNode 时，从 adjustedNodePositions[node.id] 取出 {x, y} 作为 positionX/positionY prop
  - [x] 2.2 节点数 ≤5 时 adjustedNodePositions 回退 nodePositions，坐标正确

- [x] Task 3: 移除 densityFactor 上限
  - [x] 3.1 移除 Math.min(2.5, ...) 封顶，densityFactor 无上限

# Task Dependencies
- Task 1 (QuadrantNode 改造) ✅
- Task 2 (传参) ✅
- Task 3 (去上限) ✅