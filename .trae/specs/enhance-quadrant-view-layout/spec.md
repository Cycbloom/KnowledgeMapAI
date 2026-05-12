# 优化象限视图节点布局和连线显示 Spec

## Why

当前象限视图存在两个 UI 问题：
1. 所有节点到中心的距离相等（`distanceRatio = 0.6` 固定值），看起来是一圈，没有错落有致的感觉
2. 节点之间的连线（边）没有显示，无法看到节点之间的关系

## What Changes

- 修改节点距离计算逻辑，引入随机浮动和基于节点属性的距离变化
- 新增象限视图边渲染组件，显示节点之间的关系连线
- 优化节点布局算法，使同一区域内的节点分布更自然

## Impact

- Affected specs: `add-quadrant-view`
- Affected code:
  - `src/components/GraphEditor/canvas/QuadrantNode.tsx` - 修改距离计算
  - `src/components/GraphEditor/canvas/QuadrantCanvas.tsx` - 添加边渲染
  - `src/components/GraphEditor/canvas/QuadrantEdge.tsx` - 新增边组件

## ADDED Requirements

### Requirement: 节点距离变化

节点到中心的距离应该有变化，而不是固定值：

#### Scenario: 基础距离计算
- **WHEN** 计算节点位置时
- **THEN** 基础距离 = `regionRadius * baseRatio`（如 0.5）
- **AND** 添加随机浮动（如 ±20%）
- **AND** 可以基于节点属性（如 level、连接数）调整距离

#### Scenario: 距离浮动范围
- **WHEN** 同一区域内有多个节点时
- **THEN** 节点距离在 `regionRadius * 0.3` 到 `regionRadius * 0.8` 范围内变化
- **AND** 避免节点重叠
- **AND** 保持视觉上的错落有致

### Requirement: 边连线显示

象限视图应该显示节点之间的边：

#### Scenario: 边渲染
- **WHEN** 渲染象限视图时
- **THEN** 显示区域内节点之间的边
- **AND** 边的样式与普通视图一致（颜色、线型）
- **AND** 边应该连接两个节点的中心

#### Scenario: 边样式
- **WHEN** 渲染边时
- **THEN** 使用边的关系类型对应的颜色
- **AND** 支持虚线、实线等线型
- **AND** 边的透明度适中，不遮挡节点

## Technical Design

### 节点距离计算

```typescript
// 基础距离比例
const baseRatio = 0.5;

// 随机浮动（±20%）
const randomOffset = (Math.random() - 0.5) * 0.4;

// 基于节点属性的调整
const levelFactor = node.level === 'sub' ? 0.1 : 0;

// 最终距离
const distanceRatio = baseRatio + randomOffset + levelFactor;
const distance = regionRadius * Math.max(0.3, Math.min(0.8, distanceRatio));
```

### 边渲染组件

```typescript
interface QuadrantEdgeProps {
  edge: Edge;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  color: string;
  lineStyle: 'solid' | 'dashed' | 'dotted';
}
```

### 布局优化

为了使节点分布更自然：
1. 使用伪随机数（基于节点 ID）代替纯随机，保证刷新后位置一致
2. 考虑节点之间的碰撞避免
3. 同一区域内的节点按角度均匀分布，但距离有变化
