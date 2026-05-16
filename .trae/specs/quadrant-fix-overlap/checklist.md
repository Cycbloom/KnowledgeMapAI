# Checklist

- [x] QuadrantNode 接收 positionX/positionY props 后，节点渲染位置与传入值一致
- [x] 拖拽功能正常：拖拽偏移正确叠加在 positionX/positionY 之上
- [x] 不传 positionX/positionY 时回退到自算逻辑（向后兼容）
- [x] QuadrantCanvas 向 QuadrantNode 传入 adjustedNodePositions 的 x/y
- [x] 碰撞检测后节点视觉上不再重叠（间距 ≥ minDistance）
- [x] 连线端点精确落在对应节点的圆心位置（边和节点共用 adjustedNodePositions）
- [x] densityFactor 上限已移除，无封顶
- [x] 类型检查通过（npm run check）
- [x] 代码检查通过（npm run lint）