# Milestone 2 性能攻坚优化 Spec

## Why
GraphEditor 存在严重的渲染性能问题：93个 useState 导致任意状态变化触发全组件树重渲染，MindMapCanvas(35+props) 和 GraphToolbar(50+props) 无 React.memo 保护，大量内联回调每次渲染创建新引用。后端存在 batchGetGraphNodeStatus 的 N+1 查询和 aiActionService 的循环 INSERT。

## What Changes
- 为 GraphEditor 核心子组件（MindMapCanvas、GraphToolbar、面板组件）添加 React.memo
- 将 GraphEditor 中传递给子组件的内联箭头函数提取为 useCallback，内联对象提取为 useMemo
- 修复 useCallback 依赖列表不精确的问题（如 handleSelectParentFromGraph 依赖整个 state）
- 优化 batchGetGraphNodeStatus 为单次批量 SQL 查询
- 优化 aiActionService 的循环 INSERT 为批量 INSERT

**移除项（验证后确认无需优化）：**
- ~~OPT-06 3D力导向算法~~：O(N²)版本是死代码，生产路径用 Worker+空间网格优化
- ~~OPT-11 虚拟滚动增强~~：VirtualList 未被任何页面使用，Dashboard 分页方案够用

## Impact
- Affected specs: GraphEditor 渲染性能、图谱列表加载性能、AI 生成子节点写入性能
- Affected code:
  - `src/pages/GraphEditor.tsx`
  - `src/components/GraphEditor/canvas/MindMapCanvas.tsx`
  - `src/components/GraphEditor/toolbar/GraphToolbar.tsx`
  - `src/components/GraphEditor/panels/*.tsx`
  - `api/services/graph/graphService.ts`
  - `api/services/ai/aiActionService.ts`

## ADDED Requirements

### Requirement: GraphEditor 核心子组件 React.memo 保护
系统 SHALL 为以下组件添加 React.memo（含自定义比较函数）：
1. MindMapCanvas — 35+ props，forwardRef 组件
2. GraphToolbar — 50+ props

#### Scenario: MindMapCanvas memo 保护
- **WHEN** GraphEditor 中非 MindMapCanvas 相关的状态变化（如 sidebarMode、isRightPanelOpen）
- **THEN** MindMapCanvas 不应重渲染（props 未变化时）

#### Scenario: GraphToolbar memo 保护
- **WHEN** GraphEditor 中非工具栏相关的状态变化
- **THEN** GraphToolbar 不应重渲染（props 未变化时）

### Requirement: GraphEditor 内联回调提取
系统 SHALL 将 GraphEditor 中传递给子组件的内联箭头函数提取为 useCallback，内联对象提取为 useMemo。

#### Scenario: 内联回调稳定化
- **WHEN** GraphEditor 重渲染但回调依赖未变化
- **THEN** 传递给子组件的回调引用保持不变，不触发子组件 memo 比较失败

### Requirement: useCallback 依赖精确化
系统 SHALL 修复 useCallback 依赖列表不精确的问题，避免依赖整个 state 对象。

#### Scenario: handleSelectParentFromGraph 依赖精确化
- **WHEN** selectedNode 变化而其他状态未变
- **THEN** handleSelectParentFromGraph 不应因 state 对象引用变化而重建

### Requirement: batchGetGraphNodeStatus 批量查询优化
系统 SHALL 将 batchGetGraphNodeStatus 从 N 次并行查询优化为单次批量 SQL 查询 `WHERE graph_id IN (...)`，按 graph_id 分组返回结果。

#### Scenario: 10图谱状态查询
- **WHEN** 请求 10 个图谱的节点状态
- **THEN** 仅产生 1 次数据库查询（而非 10 次），结果按 graph_id 正确分组

### Requirement: aiActionService 批量 INSERT 优化
系统 SHALL 将 aiActionService 中创建子节点的循环 INSERT 改为批量 INSERT。

#### Scenario: AI 生成 5 个子节点
- **WHEN** AI 生成 5 个子节点需要写入 knowledge_points + graph_nodes + edges
- **THEN** 使用批量 INSERT 而非 15 次逐条 INSERT

## MODIFIED Requirements

### Requirement: GraphEditor 面板组件 memo 保护
GraphEditor 的 lazy 加载面板组件（GraphAnalysisPanel、RAGChatPanel、VersionHistoryPanel 等）SHALL 添加 React.memo，避免父组件状态变化导致面板重渲染。

## REMOVED Requirements

### Requirement: OPT-06 3D力导向算法优化
**Reason**: 验证确认 O(N²) 版本是死代码，生产路径已使用 Worker + 空间网格优化（O(n)平均）
**Migration**: 无需迁移，仅需在 forceLayout3D.ts 添加注释标注该函数未被生产代码使用

### Requirement: OPT-11 虚拟滚动增强
**Reason**: 验证确认 VirtualList/VirtualGrid 未被任何页面使用，Dashboard 使用分页方案（6-15项/页）完全够用
**Migration**: 无需迁移
