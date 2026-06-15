# 虚拟滚动统一 Spec

## Why
`useVirtualScroll` Hook 和 `VirtualList`/`VirtualGrid` 组件存在功能重复，且 Hook 版缺少 `requestAnimationFrame` 节流。两者都未被实际使用，统一后可消除混淆，提供单一、完整的虚拟滚动方案。

## What Changes
- 将 `useVirtualScroll` Hook 升级为完整的虚拟滚动逻辑层，加入 `requestAnimationFrame` 节流、`onEndReached` 支持、`useMemo` 优化
- `VirtualList` 和 `VirtualGrid` 组件改为内部使用 `useVirtualScroll` Hook，消除重复逻辑
- 删除 Hook 和组件中重复的计算代码

## Impact
- Affected code: `src/hooks/common/useVirtualScroll.ts`, `src/components/common/VirtualList.tsx`, `src/hooks/common/index.ts`, `src/components/common/index.ts`
- 无破坏性变更：两者当前均未被使用，导出接口保持兼容

## ADDED Requirements

### Requirement: 统一虚拟滚动 Hook
系统 SHALL 提供一个 `useVirtualScroll` Hook，包含完整的虚拟滚动逻辑：
- `requestAnimationFrame` 节流滚动事件
- 可配置的 `overscan` 参数
- `onEndReached` 回调支持（带阈值和去重）
- `useMemo` 优化可见项计算
- 组件卸载时自动清理 rAF

#### Scenario: 滚动事件节流
- **WHEN** 用户快速滚动容器
- **THEN** 滚动事件通过 `requestAnimationFrame` 节流，不会导致过度渲染

#### Scenario: 触底加载
- **WHEN** 滚动位置接近底部（距离 < `endReachedThreshold * itemHeight`）
- **THEN** 触发 `onEndReached` 回调，且同一滚动位置不重复触发

### Requirement: VirtualList 组件使用统一 Hook
`VirtualList` 组件 SHALL 内部使用 `useVirtualScroll` Hook 实现滚动逻辑，自身仅负责渲染。

#### Scenario: VirtualList 功能不变
- **WHEN** 使用 `VirtualList` 组件
- **THEN** 行为与现有实现完全一致（rAF 节流、触底加载、GPU 加速）

### Requirement: VirtualGrid 组件使用统一 Hook
`VirtualGrid` 组件 SHALL 内部使用扩展后的 `useVirtualScroll` Hook（支持双向滚动），自身仅负责渲染。

#### Scenario: VirtualGrid 功能不变
- **WHEN** 使用 `VirtualGrid` 组件
- **THEN** 行为与现有实现完全一致（双向虚拟化、rAF 节流、绝对定位）

### Requirement: Hook 支持网格模式
`useVirtualScroll` Hook SHALL 支持网格模式（双向滚动 + 列计算），通过配置项区分列表和网格模式。

#### Scenario: 网格模式计算
- **WHEN** 传入 `itemWidth` 和 `containerWidth` 参数
- **THEN** Hook 自动计算列数、行数，返回每个可见项的 `(x, y)` 坐标
