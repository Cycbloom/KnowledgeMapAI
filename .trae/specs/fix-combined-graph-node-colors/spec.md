# 修复知识图谱视图节点颜色全黑问题

## Why
CombinedGraphView（知识星球视图）中节点颜色全黑，着色模式无法正确应用。之前的修复（添加 nodeStatus 传递）不够完整，节点仍然显示为黑色。

## What Changes
- 修复 API 路由层 `getNodeStatus` 未认证时返回空数组 `[]` 而非空对象 `{}` 的问题
- 修复 `useBatchGraphStatus` 返回的 data 对象未做 memoization 导致每次渲染创建新引用
- 修复 `mergedNodeStatus` 构建逻辑，正确处理 API 返回空数组的情况
- 在 MindMapNode 颜色计算中添加防御性兜底，确保 colors.primary 始终有值

## Impact
- Affected specs: 知识图谱视图节点渲染
- Affected code:
  - `api/routes/graphs/analysis.ts` - API 路由返回值
  - `src/hooks/queries/useGraphQueries.ts` - useBatchGraphStatus hook
  - `src/pages/CombinedGraphView.tsx` - mergedNodeStatus 构建
  - `src/components/GraphEditor/canvas/MindMapNode.tsx` - 颜色计算防御性兜底

## ADDED Requirements

### Requirement: 节点颜色防御性兜底
MindMapNode 的颜色计算 SHALL 始终返回有效的 ColorConfig 对象，确保 colors.primary 不为 undefined。当颜色计算函数返回无效值时，SHALL 回退到 level 模式的 normal 层级颜色。

#### Scenario: nodeStatus 为空时着色模式仍正常
- **WHEN** coloringMode 为 status/heatmap/decay 且 nodeStatus 为空对象或查找失败
- **THEN** 节点 SHALL 显示对应模式的默认颜色（非黑色）

#### Scenario: API 未认证时返回空对象
- **WHEN** 用户未认证请求 node-status API
- **THEN** API SHALL 返回空对象 `{}` 而非空数组 `[]`

### Requirement: useBatchGraphStatus 数据 memoization
useBatchGraphStatus 返回的 data 对象 SHALL 使用 useMemo 缓存，避免每次渲染创建新引用导致下游组件不必要的重渲染。

#### Scenario: data 引用稳定性
- **WHEN** 查询数据未变化
- **THEN** data 对象引用 SHALL 保持不变

## MODIFIED Requirements

### Requirement: CombinedGraphView mergedNodeStatus 构建
mergedNodeStatus 的构建 SHALL 正确处理 API 返回空数组的情况，将空数组视为空对象。

#### Scenario: API 返回空数组
- **WHEN** getNodeStatus API 返回空数组 `[]`
- **THEN** mergedNodeStatus SHALL 等价于空对象 `{}`，不包含无效键
