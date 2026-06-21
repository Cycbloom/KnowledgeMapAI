# Tasks

## Phase 1: 数据传递层修改

- [x] Task 1: 在 GraphEditor 中为 PlanetView 传递 `nodeStatus` 和 `focusedNodeId` props
  - [x] SubTask 1.1: 在 `src/pages/GraphEditor.tsx` 中 PlanetView 组件调用处添加 `nodeStatus={nodeStatus}` prop
  - [x] SubTask 1.2: 在 `src/pages/GraphEditor.tsx` 中 PlanetView 组件调用处添加 `focusedNodeId={focusedNodeId}` prop

## Phase 2: PlanetView 着色功能实现

- [x] Task 2: 修改 PlanetView props 接口，新增 `nodeStatus` 和 `focusedNodeId`，将 `coloringMode` 从忽略改为传递
  - [x] SubTask 2.1: 在 `PlanetViewProps` 接口中添加 `nodeStatus?: Record<string, any>` 和 `focusedNodeId?: string | null`
  - [x] SubTask 2.2: 移除 `coloringMode: _coloringMode` 的下划线前缀，改为实际使用
  - [x] SubTask 2.3: 将 `coloringMode`、`colorScheme`、`nodeStatus`、`isDark` 传递给 Scene 组件

- [x] Task 3: 在 Scene 组件中实现着色逻辑
  - [x] SubTask 3.1: 导入 `learningStatusColors.ts` 中的着色函数（`getLevelColors`、`getStatusColors`、`getHeatmapColors`、`getDecayColors`、`calculateNodeHeat`、`getLearningStatus`）和类型（`NodeLevel`）
  - [x] SubTask 3.2: 在 Scene 组件中创建 `getNodeColor(nodeId: string): THREE.Color` 函数，根据 `coloringMode` 调用对应着色函数，将 `ColorConfig.primary` 转换为 `THREE.Color`
  - [x] SubTask 3.3: 在 InstancedMesh 创建时（`useMemo` 中）使用 `getNodeColor` 替代 `NODE_COLORS[type]`
  - [x] SubTask 3.4: 在 useFrame 批量更新中，非选中/hover 节点使用 `getNodeColor` 替代 `NODE_COLORS[type]`
  - [x] SubTask 3.5: 移除 `NODE_COLORS` 常量中的 root/core/normal/leaf 颜色（保留 selected 和 hover），移除 `getNodeType`、`buildNodeTypeMap` 函数和 `NodeType` 类型

## Phase 3: PlanetView 居中功能实现

- [x] Task 4: 在 Scene 组件中实现 `focusedNodeId` 变化时的相机居中动画
  - [x] SubTask 4.1: 在 Scene 组件中添加 `focusedNodeId` prop
  - [x] SubTask 4.2: 使用 `useEffect` 监听 `focusedNodeId` 变化，找到目标节点位置
  - [x] SubTask 4.3: 在 useFrame 中实现相机位置和 OrbitControls target 的 lerp 平滑过渡动画（约 800ms）
  - [x] SubTask 4.4: 添加 `isAnimatingRef` 标记防止动画期间用户操作冲突

## Phase 4: 验证

- [x] Task 5: 功能验证
  - [x] SubTask 5.1: 验证类型检查通过（`npm run check`）— 唯一错误为预存问题（GraphEditor.tsx:507）
  - [x] SubTask 5.2: 验证 lint 通过（`npm run lint`）
  - [x] SubTask 5.3: 验证 level 着色模式在 PlanetView 中正确显示
  - [x] SubTask 5.4: 验证 status/heatmap/decay 着色模式在 PlanetView 中正确显示
  - [x] SubTask 5.5: 验证选中节点时相机自动居中到目标节点
  - [x] SubTask 5.6: 验证居中动画平滑无跳变

# Task Dependencies

- Task 1 独立，可先行
- Task 2 依赖 Task 1（需要 props 接口定义）
- Task 3 依赖 Task 2（需要 Scene 接收着色参数）
- Task 4 独立于 Task 2/3，可并行执行
- Task 5 依赖所有前置 Task 完成
