# QuadrantCanvas 虚拟化 Spec

## Why
QuadrantCanvas 支持平移/缩放交互，但渲染所有节点和边，不进行视口裁剪。当用户缩放查看局部区域时，大量离屏节点仍被渲染为 SVG DOM，造成不必要的性能开销。MindMapCanvas 已实现完整的空间虚拟化管线（空间网格索引 + 视口裁剪 + rAF 节流），QuadrantCanvas 应复用该方案以保持一致性。

## What Changes
- 在 QuadrantCanvas 中集成现有的 `useSpatialGrid`、`useViewportBounds`、`useVisibleNodes`、`useVisibleEdges` hooks
- 添加 `viewportVersion` 状态，在平移/缩放时通过 `requestAnimationFrame` 节流更新
- 仅渲染视口内可见的节点和边，超过 100 个节点时启用空间网格加速
- 保留 RegionBackground 和 RegionHeader 始终渲染（它们数量少且代表区域结构）

## Impact
- Affected code: `src/components/GraphEditor/canvas/QuadrantCanvas.tsx`
- 复用代码: `src/components/GraphEditor/shared/hooks/useVirtualization.ts`（已有 hooks，无需修改）
- 无破坏性变更：虚拟化对用户透明，视觉行为不变

## ADDED Requirements

### Requirement: QuadrantCanvas 视口裁剪
系统 SHALL 在 QuadrantCanvas 中实现视口裁剪，仅渲染当前视口内可见的节点和边。

#### Scenario: 节点数 <= 100 时不创建空间索引
- **WHEN** 图谱节点数不超过 100
- **THEN** 系统跳过空间网格索引构建，直接通过 AABB 检测过滤可见节点（与 MindMapCanvas 行为一致）

#### Scenario: 节点数 > 100 时启用空间网格
- **WHEN** 图谱节点数超过 100
- **THEN** 系统构建空间网格索引，仅查询视口覆盖的网格单元格中的节点，减少遍历开销

#### Scenario: 缩放后仅渲染可见节点
- **WHEN** 用户缩放到局部区域
- **THEN** 系统仅渲染视口内（含 200px 缓冲区）的节点，离屏节点不进入 SVG DOM

#### Scenario: 平移后仅渲染可见节点
- **WHEN** 用户拖拽平移画布
- **THEN** 系统通过 rAF 节流更新视口，仅渲染新视口内的节点

#### Scenario: 边的可见性过滤
- **WHEN** 系统计算可见边
- **THEN** 仅当边的 source 或 target 节点在视口内时，该边被渲染

### Requirement: 视口更新节流
系统 SHALL 使用 `requestAnimationFrame` 节流视口更新，避免拖拽时每帧都触发虚拟化重计算。

#### Scenario: 拖拽时节流更新
- **WHEN** 用户拖拽平移画布
- **THEN** 视口版本号通过 rAF 更新，确保最多每帧更新一次

#### Scenario: 缩放时节流更新
- **WHEN** 用户滚轮缩放
- **THEN** 视口版本号通过 rAF 更新，避免连续滚轮事件导致过度重计算

### Requirement: 区域背景和标题始终渲染
系统 SHALL 始终渲染 RegionBackground 和 RegionHeader，不受虚拟化影响。

#### Scenario: 区域结构始终可见
- **WHEN** 图谱启用虚拟化
- **THEN** 所有区域的背景扇形和标题文字始终渲染，因为它们数量少（通常 3-8 个区域）且代表图谱的整体结构

## MODIFIED Requirements

无修改项。

## REMOVED Requirements

无移除项。
