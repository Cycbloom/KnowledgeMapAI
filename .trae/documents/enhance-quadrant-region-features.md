# 象限视图区域功能增强 Spec

## Why

当前象限视图的区域功能需要增强：
1. 用户可以手动折叠区域（已实现）
2. 点击区域标题后，镜头应该移动到该区域对应的位置，方便查看

## What Changes

- 点击区域标题时，镜头平滑移动到该区域的中心位置
- 保持现有的折叠/展开功能

## Impact

- Affected specs: `add-quadrant-view`, `enhance-quadrant-view-layout`
- Affected code:
  - `src/components/GraphEditor/canvas/QuadrantCanvas.tsx` - 添加镜头移动逻辑
  - `src/components/GraphEditor/canvas/RegionHeader.tsx` - 修改点击行为

## ADDED Requirements

### Requirement: 点击区域标题镜头移动

点击区域标题时，镜头应该移动到该区域：

#### Scenario: 镜头移动到区域中心
- **WHEN** 用户点击区域标题时
- **THEN** 镜头平滑移动到该区域的中心位置
- **AND** 区域中心位于视图中心
- **AND** 缩放级别保持不变

#### Scenario: 区域中心计算
- **WHEN** 计算区域中心位置时
- **THEN** 使用区域的中间角度计算中心点
- **AND** 距离为 regionRadius * 0.5（区域中间位置）

## Technical Design

### 镜头移动逻辑

```typescript
// 在 QuadrantCanvas.tsx 中添加镜头移动函数
const moveCameraToRegion = useCallback((region: RegionInfo) => {
  const midAngle = (region.angleStart + region.angleEnd) / 2;
  const targetDistance = regionRadius * 0.5;
  
  // 计算区域中心点相对于原点的偏移
  const regionCenterX = targetDistance * Math.cos(midAngle);
  const regionCenterY = targetDistance * Math.sin(midAngle);
  
  // 计算新的 transform，使区域中心位于视图中心
  const centerX = containerSize.width / 2;
  const centerY = containerSize.height / 2;
  
  const newTransform = {
    x: centerX - (originPosition.x + regionCenterX) * transformRef.current.k,
    y: centerY - (originPosition.y + regionCenterY) * transformRef.current.k,
    k: transformRef.current.k,
  };
  
  // 应用动画
  animateTransform(newTransform);
}, [regionRadius, originPosition, containerSize]);
```

### RegionHeader 点击行为修改

```typescript
// 双击：镜头移动到区域
// 单击：折叠/展开区域
const handleClick = useCallback(() => {
  onToggle(); // 单击折叠/展开
}, [onToggle]);

const handleDoubleClick = useCallback(() => {
  onMoveToRegion(); // 双击移动镜头
}, [onMoveToRegion]);
```

### 实现步骤

1. 在 QuadrantCanvas.tsx 中添加 moveCameraToRegion 函数
2. 修改 RegionHeader 支持双击移动镜头
3. 添加平滑动画效果
