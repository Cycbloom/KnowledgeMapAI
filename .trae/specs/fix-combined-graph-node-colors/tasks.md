# Tasks

- [x] Task 1: 修复 API 路由层 getNodeStatus 未认证时返回空数组的问题
  - [x] 修改 `api/routes/graphs/analysis.ts` 第 57 行，将 `[]` 改为 `{}`

- [x] Task 2: 修复 useBatchGraphStatus 的 data memoization 问题
  - [x] 在 `src/hooks/queries/useGraphQueries.ts` 中用 useMemo 包裹 data 对象的构建

- [x] Task 3: 修复 CombinedGraphView 中 mergedNodeStatus 构建逻辑
  - [x] 修改 `src/pages/CombinedGraphView.tsx` 中 mergedNodeStatus 的 useMemo，确保空数组被正确处理为空对象

- [x] Task 4: 在 MindMapNode 颜色计算中添加防御性兜底
  - [x] 修改 `src/components/GraphEditor/canvas/MindMapNode.tsx` 中 colors 的 useMemo，当返回值缺少 primary 时回退到 LEVEL_COLORS.normal

- [x] Task 5: 运行类型检查验证
  - [x] 运行 `npm run check` 确认无新增类型错误

# Task Dependencies
- Task 5 依赖 Task 1-4 完成
- Task 1-4 之间无依赖，可并行执行
