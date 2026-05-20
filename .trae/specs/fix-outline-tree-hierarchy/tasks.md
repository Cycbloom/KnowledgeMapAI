# Tasks

- [x] Task 1: 修改 GraphOutline.tsx 的树形构建逻辑，引入层级边类型过滤
  - [x] 在 `GraphOutline.tsx` 中定义 `HIERARCHICAL_EDGE_TYPES` 白名单常量
  - [x] 修改第 171-298 行的 `useMemo`，在构建 `childrenMap`/`parentMap` 前先过滤边：仅保留 `relationship_type` 在白名单中的边（以及无类型时按现有行为处理）
  - [x] 确保排序优化逻辑（level-based edge sorting）仍然应用于过滤后的边集
  - [x] 验证孤立节点仍能正确显示为根节点

- [x] Task 2: 修改 treeLayout.ts 的树形布局算法，应用相同的层级边过滤
  - [x] 在 `treeLayout.ts` 中引入相同的层级边过滤逻辑
  - [x] 修改 `createTreeLayout` 函数中构建 `childrenMap` 的部分，仅使用层级边
  - [x] 确保 TreeView 视图与大纲视图的行为一致

- [x] Task 3: 运行 lint 和类型检查验证修改正确性
  - [x] 执行 `npm run check` 确认无类型错误
  - [x] 执行 `npm run lint` 确认代码规范

# Task Dependencies
- [Task 2] depends on [Task 1] (Task 2 需要与 Task 1 保持一致的过滤策略，建议在 Task 1 完成后参考其实现)
