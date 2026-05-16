# 象限视图节点重叠与连线偏移修复 Spec

## Why
上一轮优化（`quadrant-dense-layout`）引入了碰撞检测 `adjustedNodePositions`，但存在两个关键缺陷：① **碰撞检测结果未作用于节点渲染** — `QuadrantNode` 组件仍自行从 `angle + regionRadius * distanceRatio` 计算位置，完全忽略父组件的碰撞修正坐标，导致节点视觉上仍然重叠；② **连线端点与节点中心不对齐** — 边使用 `adjustedNodePositions`（碰撞后），而节点用自算位置（碰撞前），两者随半径扩大差异放大。此外密度因子上限 2.5 仍偏低。

## What Changes
- **修复**：将碰撞调整后的位置 (`adjustedNodePositions`) 作为显式 props 传入 `QuadrantNode`，替代其内部自算的极坐标定位
- **修复**：移除或大幅提高 densityFactor 上限（从 2.5 → 无上限 / 3.5）
- **简化**：`QuadrantNode` 接收 `positionX/positionY` 后直接使用，不再独立计算 `distanceRatio → x/y`

## Impact
- Affected specs: quadrant-dense-layout (follow-up fix)
- Affected code:
  - `src/components/GraphEditor/canvas/QuadrantCanvas.tsx` — 传参 + 去上限
  - `src/components/GraphEditor/canvas/QuadrantNode.tsx` — 接收外部位置，废弃内部计算

## ADDED Requirements

### Requirement: 节点位置由父组件统一控制
`QuadrantNode` SHALL 不再自行计算笛卡尔坐标，而是接收父组件传入的 `positionX` 和 `positionY`。

#### Scenario: 碰撞检测推开节点 A
- **WHEN** avoidCollisions 将节点 A 从 (100, 200) 推开到 (130, 220)
- **THEN** QuadrantNode 渲染在 (130, 220)，而非自算的 (100, 200)

#### Scenario: 拖拽节点
- **WHEN** 用户拖拽节点
- **THEN** 拖拽偏移量叠加在 positionX/positionY 之上（保持现有拖拽行为）

### Requirement: 连线端点对齐节点中心
边（Edge）的起点和终点 SHALL 与节点实际渲染位置一致。

#### Scenario: 半径扩大后的连线
- **WHEN** regionRadius 因高密度因子变大
- **THEN** 连线两端精确落在对应节点的圆心位置，无线头悬空或错位

### Requirement: 密度因子无封顶或高封顶
regionRadius 的 densityFactor SHALL 不设上限或设置足够高的上限（≥3.5），确保超大规模图谱也能充分展开。

#### Scenario: 150+ 节点图谱
- **WHEN** 图谱包含 150+ 个节点
- **THEN** regionRadius 持续增长不被截断，节点有充足空间分散

## MODIFIED Requirements

### Requirement: regionRadius 计算
移除 `Math.min(2.5, ...)` 封顶，改为不封顶或上限 3.5。