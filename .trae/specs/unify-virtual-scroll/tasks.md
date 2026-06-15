# Tasks

- [x] Task 1: 升级 `useVirtualScroll` Hook，加入 rAF 节流和网格模式支持
  - [x] 1.1: 添加 `requestAnimationFrame` 节流逻辑，组件卸载时清理
  - [x] 1.2: 添加 `onEndReached` / `endReachedThreshold` 支持，含去重逻辑
  - [x] 1.3: 添加网格模式支持（`itemWidth`、`containerWidth`、双向滚动、列/行计算、坐标返回）
  - [x] 1.4: 使用 `useMemo` 优化 `visibleItems` 计算
  - [x] 1.5: 添加 `useCallback` 优化 `handleScroll`
- [x] Task 2: 重构 `VirtualList` 组件，内部使用 `useVirtualScroll` Hook
  - [x] 2.1: 将滚动逻辑替换为 `useVirtualScroll` 调用
  - [x] 2.2: 组件仅保留渲染逻辑和样式
  - [x] 2.3: 确保导出接口和 Props 不变
- [x] Task 3: 重构 `VirtualGrid` 组件，内部使用 `useVirtualScroll` Hook（网格模式）
  - [x] 3.1: 将滚动逻辑替换为 `useVirtualScroll` 网格模式调用
  - [x] 3.2: 组件仅保留渲染逻辑和样式
  - [x] 3.3: 确保导出接口和 Props 不变
- [x] Task 4: 验证类型检查通过
  - [x] 4.1: 运行 `npm run check` 确保无类型错误
  - [x] 4.2: 运行 `npm run lint` 确保无 lint 错误（仅预存问题，本次修改无新增）

# Task Dependencies
- Task 2 depends on Task 1
- Task 3 depends on Task 1
- Task 4 depends on Task 2 and Task 3
