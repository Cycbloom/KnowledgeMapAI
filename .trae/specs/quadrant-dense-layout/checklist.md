# Checklist

- [x] 10 个节点图谱：regionRadius 约为容器短边的 42%（factor ≈ 1.2）
- [x] 50 个节点图谱：regionRadius 约为容器短边的 68%（factor ≈ 1.8）
- [x] 100+ 节点图谱：regionRadius 接近填满容器（factor ≈ 2.3，上限 2.5）
- [x] 基础容器比例随节点数从 0.35 微调到最高 0.43
- [x] 节点数 ≤80 时碰撞检测迭代 30 次，minDistance ≥55px
- [x] 节点数 >80 时碰撞检测降至 25 次迭代
- [x] 节点数 >150 时碰撞检测降至 15 次迭代
- [x] 碰撞检测用 useMemo 包裹，不引起不必要的重算
- [x] 区域内 ≤5 节点时 distanceRatio 范围 [0.30, 0.82]
- [x] 区域内 6~12 节点时 distanceRatio 范围 [0.24, 0.87]
- [x] 区域内 >12 节点时 distanceRatio 范围 [0.18, 0.92]
- [x] QuadrantNode.tsx 与 QuadrantCanvas.tsx 的距离计算逻辑保持一致
- [x] 截图中 ~30 节点的密集场景下节点不再明显重叠，间距可辨识
- [x] 类型检查通过（npm run check）
- [x] 代码检查通过（npm run lint）