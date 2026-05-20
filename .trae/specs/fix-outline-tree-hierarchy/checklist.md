# Checklist

- [x] GraphOutline.tsx 中定义了 HIERARCHICAL_EDGE_TYPES 白名单，包含 contains、parent_child、part_of、generalization、specialization、derived_from
- [x] GraphOutline.tsx 的树形构建 useMemo 中，在遍历边之前已按 relationship_type 过滤，非层级边不参与 childrenMap/parentMap 构建
- [x] 无 relationship_type 的边仍按原有行为处理（保持向后兼容）
- [x] treeLayout.ts 的 createTreeLayout 函数应用了相同的层级边过滤逻辑
- [x] 修改后 npm run check 通过（无类型错误）
- [x] 修改后 npm run lint 通过（无 lint 错误）
