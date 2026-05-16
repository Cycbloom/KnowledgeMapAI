# Tasks

- [x] Task 1: 重构 regionRadius 密度缩放算法 — 支持大节点量级的合理扩展
  - [x] 1.1 修改 `QuadrantCanvas.tsx` 中 `regionRadius` 的 `useMemo`：将线性密度因子替换为 5 段分段公式
  - [x] 1.2 新公式：10→1.2, 25→1.5, 50→1.8, 100→2.3, 上限 2.5
  - [x] 1.3 基础容器比例从固定 0.35 改为 `0.35 + min(0.08, count/500)`
  - [x] 1.4 验证：在 30+ 节点的图谱中象限视图半径明显扩大

- [x] Task 2: 集成碰撞检测到渲染流程 — 避免节点重叠
  - [x] 2.1 在 `QuadrantCanvas.tsx` 中新增 `adjustedNodePositions` useMemo，调用 `avoidCollisions()`
  - [x] 2.2 从 `quadrantLayout.ts` 导入 `avoidCollisions` 函数
  - [x] 2.3 将 nodePositions Map 转换后传入 avoidCollisions，minDistance=58px
  - [x] 2.4 边渲染使用 adjustedNodePositions，节点数 >80 时迭代 25 次，>150 时 15 次
  - [x] 2.5 用 useMemo 包裹碰撞检测计算

- [x] Task 3: 动态 distanceRatio 分布 — 区域内节点多时扩大径向范围
  - [x] 3.1 修改 `QuadrantCanvas.tsx` 的 `getNodePosition()` 增加 `regionNodeCount?: number` 参数
  - [x] 3.2 动态边界：≤5 → [0.30, 0.82], 6~12 → [0.24, 0.87], >12 → [0.18, 0.92]
  - [x] 3.3 同步修改 `QuadrantNode.tsx` 新增 `regionNodeCount` prop，distanceRatio 使用相同动态边界
  - [x] 3.4 QuadrantCanvas 渲染 QuadrantNode 时传入 regionNodeCount

# Task Dependencies
- Task 1 (radius 扩展) 独立实施 ✅
- Task 2 (碰撞检测) 依赖于 Task 1 提供更大的空间来散开节点 ✅
- Task 3 (动态距离比) 与 Task 1、2 并行完成 ✅