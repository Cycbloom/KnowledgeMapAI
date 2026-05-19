# 象限视图连线可见性与幽灵高亮修复 Spec

## Why
象限视图存在三个严重的视觉问题：① **默认状态下连线几乎不可见** — 非高亮边 `strokeOpacity=0.25`、`strokeWidth=1`、统一灰色，导致用户看不到节点间的关联；② **选中节点后聚焦模式过于极端** — 非聚焦节点 opacity=0.3、非高亮边 opacity=0.25，几乎完全消失；③ **幽灵高亮** — 选中节点后，部分节点被高亮（opacity=1）但与选中节点之间没有可见连线，原因是 `focusedNodeIds` 基于**全量 edges** 计算，而 `regionEdges` 基于**可见节点**过滤，两者不一致导致节点高亮但对应边被过滤掉。

## What Changes
- **修复**：`QuadrantEdge` 组件重构为三档渲染（默认/聚焦暗淡/聚焦高亮），默认状态使用关系类型颜色 + 适中透明度
- **修复**：`QuadrantNode` 聚焦模式下非聚焦节点透明度从 0.3 调整为 0.45
- **修复**：`QuadrantCanvas` 内部基于 `regionEdges` 重新计算 `visibleFocusedNodeIds`，消除幽灵高亮
- **优化**：非高亮边保留关系类型的虚线样式（dashed/dotted），不再强制覆盖为实线

## Impact
- Affected specs: quadrant-dense-layout, quadrant-fix-overlap
- Affected code:
  - `src/components/GraphEditor/canvas/QuadrantEdge.tsx` — 三档渲染逻辑
  - `src/components/GraphEditor/canvas/QuadrantNode.tsx` — 透明度调整
  - `src/components/GraphEditor/canvas/QuadrantCanvas.tsx` — 可见聚焦节点计算 + 边渲染传参

## ADDED Requirements

### Requirement: 默认状态下连线可见
象限视图在无节点选中时，边 SHALL 使用关系类型对应颜色渲染，透明度不低于 0.4，线宽不低于 1.2，并保留关系类型的虚线样式（dashed/dotted）。

#### Scenario: 无选中节点时的边渲染
- **WHEN** 用户打开象限视图且未选中任何节点
- **THEN** 所有边使用关系类型颜色（如 `depends_on` 用主色），`strokeOpacity ≥ 0.4`，`strokeWidth ≥ 1.2`，保留 dash 样式

#### Scenario: 暗色模式下的默认边
- **WHEN** 暗色模式下未选中节点
- **THEN** 边使用关系类型颜色渲染，透明度与亮色模式一致

### Requirement: 聚焦模式三档边渲染
选中节点后，边 SHALL 根据聚焦状态分为三档渲染：高亮（聚焦相关）、暗淡（聚焦无关）、默认（无聚焦模式）。

#### Scenario: 高亮边渲染
- **WHEN** 选中节点且边在 `focusedLinkIds` 中
- **THEN** 边使用关系类型颜色，`strokeOpacity=1`，`strokeWidth=2.5`，保留 dash 样式，添加发光效果

#### Scenario: 聚焦模式下暗淡边渲染
- **WHEN** 选中节点且边不在 `focusedLinkIds` 中
- **THEN** 边使用关系类型颜色（非灰色），`strokeOpacity=0.15`，`strokeWidth=1`，保留 dash 样式，无发光效果

#### Scenario: 无聚焦模式边渲染
- **WHEN** 未选中任何节点
- **THEN** 边使用关系类型颜色，`strokeOpacity=0.45`，`strokeWidth=1.2`，保留 dash 样式

### Requirement: 聚焦模式下非聚焦节点适度暗淡
选中节点后，非聚焦节点 SHALL 以 opacity=0.45 渲染（而非当前的 0.3），保持基本可读性。

#### Scenario: 非聚焦节点可见性
- **WHEN** 选中节点且某节点不在 `focusedNodeIds` 中
- **THEN** 该节点以 `opacity=0.45` 渲染，仍可辨认标题和颜色

#### Scenario: 聚焦节点可见性
- **WHEN** 选中节点且某节点在 `focusedNodeIds` 中
- **THEN** 该节点以 `opacity=1` 渲染

### Requirement: 消除幽灵高亮
选中节点后，只有通过**可见边**（`regionEdges`）与选中节点直接相连的节点才 SHALL 被高亮。基于全量 edges 计算的 `focusedNodeIds` 中，若某节点与选中节点之间的边不在 `regionEdges` 中，该节点 SHALL 不被高亮。

#### Scenario: 邻居节点有可见边
- **WHEN** 选中节点 A，节点 B 是 A 的邻居，且边 A-B 在 `regionEdges` 中
- **THEN** 节点 B 被高亮（opacity=1），边 A-B 被高亮

#### Scenario: 邻居节点无可视边（幽灵高亮消除）
- **WHEN** 选中节点 A，节点 B 是 A 的邻居（全量 edges 中有边 A-B），但边 A-B 不在 `regionEdges` 中（例如 B 的另一端是 core 节点或折叠区域节点）
- **THEN** 节点 B 不被高亮（opacity=0.45），避免出现"高亮但无连线"的视觉混乱

#### Scenario: 跨区域边正常显示
- **WHEN** 选中节点 A（区域 1），节点 B（区域 2）是 A 的邻居，边 A-B 两端都在 `nodePositions` 中
- **THEN** 节点 B 被高亮，边 A-B 被高亮并正确渲染

## MODIFIED Requirements

### Requirement: QuadrantEdge 组件接口
`QuadrantEdge` 组件 SHALL 新增 `hasFocusMode` prop，用于区分"无聚焦模式"和"聚焦模式暗淡"两种非高亮状态。

```typescript
interface QuadrantEdgeProps {
  edge: Edge;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  isDark: boolean;
  highlighted?: boolean;
  hasFocusMode?: boolean;  // 新增
}
```

### Requirement: QuadrantCanvas 聚焦节点计算
`QuadrantCanvas` SHALL 基于 `regionEdges`（而非父组件传入的全量 `focusedNodeIds`）计算实际可见的聚焦节点集合，确保只有通过可见边连接的节点才被高亮。

## REMOVED Requirements

### Requirement: 非高亮边统一灰色渲染
**Reason**: 改为使用关系类型颜色 + 低透明度，保持视觉一致性
**Migration**: 非高亮边从灰色 `var(--slate-700)`/`var(--slate-300)` 改为关系类型颜色 + 低透明度

### Requirement: 非高亮边强制实线
**Reason**: 保留关系类型的虚线样式有助于在低透明度下仍能区分关系类型
**Migration**: 非高亮边保留 `strokeDasharray`，不再强制覆盖为 `"none"`
