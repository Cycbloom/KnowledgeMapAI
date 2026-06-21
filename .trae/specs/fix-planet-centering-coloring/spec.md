# 修复知识星球视图居中与着色功能 Spec

## Why

知识星球视图（PlanetView）存在两个功能缺失：(1) 点击顶点时视图不会自动居中到该节点，而其他视图（MindMapCanvas）已实现此功能；(2) 所有顶点均未应用预设的着色模式（level/status/heatmap/decay），仅使用硬编码的拓扑类型颜色，导致着色模式切换在星球视图中完全无效。

## What Changes

- **实现 PlanetView 自动居中功能** — 当 `focusedNodeId` 变化时，通过动画移动 Three.js 相机到目标节点位置，同时更新 OrbitControls 的 target
- **实现 PlanetView 着色功能** — 将 `coloringMode` 和 `colorScheme` 传入 Scene，根据着色模式计算每个节点的 InstancedMesh instanceColor
- **补充 nodeStatus 数据传递** — 在 GraphEditor 中将 `nodeStatus` 传递给 PlanetView，使 status/heatmap/decay 着色模式有数据支撑

## Impact

- Affected specs: 知识星球视图、图谱编辑器视图系统
- Affected code:
  - `src/three/PlanetView.tsx` — 主要修改目标：添加居中逻辑、着色逻辑
  - `src/pages/GraphEditor.tsx` — 传递 `nodeStatus` 和 `focusedNodeId` 给 PlanetView

## ADDED Requirements

### Requirement: PlanetView 自动居中功能

系统 SHALL 在 `focusedNodeId` 变化时，通过动画将 Three.js 相机移动到目标节点位置，并更新 OrbitControls 的 target 到该节点。

#### Scenario: 侧边栏点击节点时自动居中
- **WHEN** 用户在侧边栏点击某个节点，导致 `focusedNodeId` 变化
- **THEN** 相机通过平滑动画移动到目标节点附近，OrbitControls 的 target 同步更新到目标节点位置，使用户视角聚焦到该节点

#### Scenario: 居中动画平滑过渡
- **WHEN** 相机开始居中动画
- **THEN** 相机位置和 OrbitControls target 在约 800ms 内通过 lerp 平滑过渡到目标位置，无跳变

#### Scenario: focusedNodeId 为 null 时不居中
- **WHEN** `focusedNodeId` 为 null
- **THEN** 相机保持当前位置，不执行居中动画

#### Scenario: 目标节点不在布局中时不居中
- **WHEN** `focusedNodeId` 对应的节点在当前布局中不存在
- **THEN** 相机保持当前位置，不执行居中动画

---

### Requirement: PlanetView 着色功能

系统 SHALL 根据 `coloringMode` 和 `colorScheme` 动态计算 InstancedMesh 中每个节点的 instanceColor，与 MindMapCanvas/QuadrantCanvas 的着色行为一致。

#### Scenario: level 着色模式
- **WHEN** `coloringMode` 为 `"level"`
- **THEN** 节点颜色根据 `LEVEL_COLORS` 按层级（root/core/sub/normal/leaf）分配，使用 `ColorConfig.primary` 转换为 `THREE.Color`

#### Scenario: status 着色模式
- **WHEN** `coloringMode` 为 `"status"`
- **THEN** 节点颜色根据学习状态（mastered/due/locked/new/learning）和 `colorScheme` 分配，使用 `getStatusColors()` 计算颜色

#### Scenario: heatmap 着色模式
- **WHEN** `coloringMode` 为 `"heatmap"`
- **THEN** 节点颜色根据 `calculateNodeHeat()` 计算的热力值，使用 `getHeatmapColors()` 渲染为热力图渐变色

#### Scenario: decay 着色模式
- **WHEN** `coloringMode` 为 `"decay"`
- **THEN** 节点颜色根据 FSRS retrievability 值，使用 `getDecayColors()` 渲染为衰减渐变色

#### Scenario: nodeStatus 为空时回退到 level 模式
- **WHEN** `coloringMode` 为 status/heatmap/decay 但 `nodeStatus` 为空或未提供
- **THEN** 节点颜色回退到 level 模式的对应层级颜色，不显示为黑色

#### Scenario: 选中/hover 节点颜色优先
- **WHEN** 节点被选中或 hover
- **THEN** 该节点的 instanceColor 仍使用 selected/hover 专用颜色，不受着色模式影响

---

### Requirement: nodeStatus 数据传递

系统 SHALL 在 GraphEditor 中将 `nodeStatus` 传递给 PlanetView 组件，使着色模式有数据支撑。

#### Scenario: PlanetView 接收 nodeStatus
- **WHEN** GraphEditor 渲染 PlanetView
- **THEN** `nodeStatus` 作为 prop 传递给 PlanetView，与 MindMapCanvas/QuadrantCanvas/TimelineView/TreeView 一致

## MODIFIED Requirements

### Requirement: PlanetView Props

PlanetView 的 props 接口 SHALL 新增 `focusedNodeId` 和 `nodeStatus` 属性，`coloringMode` 从忽略变为实际使用。

### Requirement: PlanetView Scene 组件

Scene 组件 SHALL 接收 `coloringMode`、`colorScheme`、`nodeStatus`、`isDark` 参数，在 InstancedMesh 创建和 useFrame 更新时根据着色模式计算节点颜色。

## REMOVED Requirements

无移除项。
