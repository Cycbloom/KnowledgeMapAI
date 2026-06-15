# MindMap 布局计算迁移至 Web Worker Spec

## Why

MindMapCanvas 的 `createMindMapLayout` 使用 d3-force 在主线程同步执行 500-700 次力导向迭代（O(n²) 复杂度），大图（>100 节点）时严重阻塞渲染导致卡顿。项目已有 Web Worker 基础设施（graphCalculator.worker.ts + useGraphWorker hook），但 MindMapCanvas 未使用。需将完整布局计算迁移至 Worker，释放主线程保障交互流畅度。

## What Changes

- 将 `createMindMapLayout` 的核心力导向计算从 `utils/mindmapLayout.ts` 迁移至 `workers/graphCalculator.worker.ts`
- 新增 Worker 端的 `calculateMindMapLayout` 方法，保留 d3-force 全部特性（域分组、层级电荷、碰撞检测、中心力）
- MindMapCanvas 中将 `useMemo` 同步调用替换为异步 Worker 调用 + `useState` 管理
- 添加布局计算中的加载状态反馈（骨架屏/进度指示）
- 保留原有 Worker 的 `calculateForceDirectedLayout` 作为轻量备选方案

## Impact

- Affected code:
  - `src/workers/graphCalculator.worker.ts` — 新增 MindMap 布局方法
  - `src/hooks/common/useWorker.ts` — 扩展 GraphWorkerApi 类型
  - `src/components/GraphEditor/canvas/MindMapCanvas.tsx` — 核心改动：同步→异步
  - `src/utils/mindmapLayout.ts` — 保留作为类型导出和降级方案

## ADDED Requirements

### Requirement: Worker 端 MindMap 布局计算

系统 SHALL 在 Web Worker 中提供与 `createMindMapLayout` 功能等价的异步布局计算接口。

#### Scenario: 大图布局计算不阻塞主线程

- **WHEN** 图谱节点数 > 50 且用户触发布局刷新或节点/边数据变更
- **THEN** 布局计算在 Web Worker 中异步执行，主线程保持响应（帧率 ≥ 30fps）
- **AND** 计算完成后返回包含 x/y 坐标的节点数组和边数组

#### Scenario: 保留全部布局特性

- **WHEN** Worker 执行布局计算时
- **THEN** 支持以下特性：
  - 层级差异化电荷强度（root/core/sub/normal/leaf）
  - 域分组聚类（domainGroups 初始位置分布）
  - 碰撞检测（基于层级的动态半径）
  - 中心引力 + X/Y 定位力
  - 动态参数调整（根据节点数量自动调整迭代次数、距离、电荷）

#### Scenario: 布局计算进度反馈

- **WHEN** 布局计算执行时间超过 200ms
- **THEN** 显示加载状态指示器（使用现有 Skeleton 组件）
- **AND** 计算完成后平滑过渡到新布局（非突变）

### Requirement: MindMapCanvas 异步布局集成

系统 SHALL 将 MindMapCanvas 的布局计算从同步 useMemo 迁移为异步 Worker 调用。

#### Scenario: 首次加载和增量更新

- **WHEN** 组件挂载或 nodes/edges/containerSize 变更时
- **THEN** 通过 useGraphWorker 触发异步布局计算
- **AND** 使用 useState 存储布局结果，触发重渲染
- **AND** 相同输入参数下复用上一次计算结果（防抖 300ms）

#### Scenario: Worker 不可用时的降级

- **WHEN** Web Worker 创建失败或 Comlink 通信异常
- **THEN** 自动降级为主线程同步计算（调用原 createMindMapLayout）
- **AND** 控制台输出 warning 日志

## MODIFIED Requirements

### Requirement: graphCalculator.worker.ts 扩展

在现有 `calculateForceDirectedLayout` 基础上，新增 `calculateMindMapLayout` 方法：

```typescript
// 新增接口
calculateMindMapLayout(
  nodes: MindMapLayoutNode[],
  edges: MindMapLayoutEdge[],
  options: MindMapLayoutOptions
): Promise<MindMapLayoutResult>
```

其中 `MindMapLayoutOptions` 包含 width/height/chargeStrength/linkDistance/centerForce/domainGroups。
`MindMapLayoutResult` 包含 nodes（带 x/y）和 links 数组。

### Requirement: useGraphWorker Hook 扩展

在 `useGraphWorker` 中新增 `calculateMindMapLayout` 方法，封装 Comlink 调用。

## REMOVED Requirements

无。原有功能完全保留，仅改变执行位置（主线程 → Worker）。
