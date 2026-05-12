# 优化象限视图节点样式 Spec

## Why

当前象限视图的节点样式过于简单：
1. 只是一个简单的实心圆形，没有层次感
2. 文字直接显示在节点下方，没有优化
3. 缺少 MindMapNode 中的丰富样式（环形、渐变、阴影、中心点等）

## What Changes

- 参考 MindMapNode 的样式，为 QuadrantNode 添加更丰富的视觉效果
- 使用 NodeRing 组件渲染环形节点
- 添加阴影、发光效果
- 优化文字展示

## Impact

- Affected specs: `add-quadrant-view`, `enhance-quadrant-view-layout`
- Affected code:
  - `src/components/GraphEditor/canvas/QuadrantNode.tsx` - 重构节点样式

## ADDED Requirements

### Requirement: 环形节点样式

象限视图节点应该使用与 MindMapNode 类似的环形样式：

#### Scenario: 节点渲染
- **WHEN** 渲染象限视图节点时
- **THEN** 使用 NodeRing 组件渲染环形节点
- **AND** 根据节点级别（level）应用不同的样式配置
- **AND** 添加中心点

#### Scenario: 节点样式配置
- **WHEN** 确定节点样式时
- **THEN** 使用 NODE_STYLE_CONFIG 配置
- **AND** 根据节点级别（sub, normal, leaf）选择对应配置
- **AND** 应用阴影效果

### Requirement: 文字展示优化

优化节点文字展示：

#### Scenario: 文字位置
- **WHEN** 显示节点标题时
- **THEN** 文字显示在节点下方
- **AND** 根据缩放级别调整字体大小
- **AND** 添加文字阴影提高可读性

#### Scenario: 文字可见性
- **WHEN** 缩放级别较低时
- **THEN** 可以隐藏或淡化文字
- **AND** 缩放级别较高时完全显示文字

## Technical Design

### 节点样式对比

**当前样式**：
```tsx
<circle r={20} fill={colors.primary} stroke="white" strokeWidth={2} />
<text y={34}>{title}</text>
```

**优化后样式**：
```tsx
// 使用 NodeRing 组件
{rings}
// 中心点
{styleConfig.showCenterDot && <circle r={centerDotRadius} fill={colors.primary} />}
// 文字（带阴影）
<text style={{ textShadow: "..." }}>{title}</text>
```

### 样式配置

对于象限视图，使用较小的节点尺寸：
- `sub` 级别：baseRadius = 24, rings = 2
- `normal` 级别：baseRadius = 20, rings = 1
- `leaf` 级别：baseRadius = 16, rings = 1

### 实现步骤

1. 导入 NodeRing 组件和相关配置
2. 根据节点级别获取样式配置
3. 渲染环形节点
4. 添加中心点
5. 优化文字展示
