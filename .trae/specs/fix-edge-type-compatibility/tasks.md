# Tasks

- [x] Task 1: 提取共享层级边类型常量
  - [x] SubTask 1.1: 在 `src/config/relationshipTypes.ts` 中新增并导出 `HIERARCHICAL_EDGE_TYPES` 常量（Set 类型，包含 `contains`、`parent_child`、`part_of`、`derived_from`）
  - [x] SubTask 1.2: 修改 `src/components/GraphEditor/panels/GraphOutline.tsx`，删除局部 `HIERARCHICAL_EDGE_TYPES` 定义，改为从 `relationshipTypes.ts` 导入
  - [x] SubTask 1.3: 修改 `src/utils/layouts/treeLayout.ts`，删除局部 `HIERARCHICAL_EDGE_TYPES` 定义，改为从 `relationshipTypes.ts` 导入

- [x] Task 2: 修复父子边创建使用层级类型（核心兼容性问题）
  - [x] SubTask 2.1: 修改 `src/hooks/utils/nodeExpansionUtils.ts`，将两处 `relationship_type: 'related'` 改为 `relationship_type: 'contains'`
  - [x] SubTask 2.2: 修改 `src/hooks/graphEditor/useGraphNodeOperations.ts`，将两处 `relationship_type: 'related'`（添加子节点和编辑父节点时）改为 `relationship_type: 'contains'`
  - [x] SubTask 2.3: 修改 `src/hooks/common/useTutorOperations.ts`，将两处 `relationship_type: "related"` 改为 `relationship_type: "contains"`
  - [x] SubTask 2.4: 修改 `src/pages/GraphEditor.tsx`，将两处手动连线的 `relationship_type: "related"` 改为 `relationship_type: "contains"`
  - [x] SubTask 2.5: 修改 `src/pages/LearningMode.tsx`，将 `relationship_type: "related"` 改为 `relationship_type: "contains"`

- [x] Task 3: 统一默认边类型为 contains
  - [x] SubTask 3.1: 修改 `supabase/migrations/04_graph_structure.sql`，将 `relationship_type VARCHAR(50) DEFAULT 'related'` 改为 `DEFAULT 'contains'`
  - [x] SubTask 3.2: 修改 `api/services/graph/edgeService.ts`，将三处 `relationship_type || 'related'` 改为 `relationship_type || 'contains'`
  - [x] SubTask 3.3: 修改 `api/database/adapters/supabase.ts`，将 `data.relationship_type || 'related'` 改为 `data.relationship_type || 'contains'`
  - [x] SubTask 3.4: 修改 `api/routes/backup.ts`，将 `e.relationship_type || "related"` 改为 `e.relationship_type || "contains"`

- [x] Task 4: 修复 LayoutOrganizer 边类型过滤
  - [x] SubTask 4.1: 修改 `src/components/GraphEditor/shared/LayoutOrganizer.tsx`，导入 `HIERARCHICAL_EDGE_TYPES`，在 `calculateOrganizedPositions` 中过滤层级边构建父子映射（与 GraphOutline 逻辑一致：无类型边保留，层级类型边保留）

- [x] Task 5: 修复其他边类型不一致问题
  - [x] SubTask 5.1: 修改 `src/components/GraphEditor/canvas/QuadrantEdge.tsx`，从 `LINE_STYLES` 映射中移除 `related_to` 条目
  - [x] SubTask 5.2: 修改 `src/components/GraphMap/canvas/GraphEdges.tsx`，修复不安全的 `edge.relationship_type as GraphRelationType` 强制类型转换，改为安全的类型判断
  - [x] SubTask 5.3: 修改 `api/services/graph/graphRelationService.ts`，在 `GraphRelationType` 类型定义中补充 `'cross_domain'`
  - [x] SubTask 5.4: 修改 `supabase/migrations/54_seed_relationship_types.sql`，将 `prerequisite` 的颜色从 `'#F59E0B'` 改为 `'#EF4444'`

- [x] Task 6: 验证与测试
  - [x] SubTask 6.1: 运行 `npm run check` 类型检查
  - [x] SubTask 6.2: 运行 `npm run lint` 代码检查
  - [x] SubTask 6.3: 验证思维导图拓展创建的边在树状视图中正确显示
  - [x] SubTask 6.4: 验证节点操作创建的父子边在树状视图中正确显示
  - [x] SubTask 6.5: 验证 LayoutOrganizer 布局不再受非层级边干扰

# Task Dependencies

- [Task 2] depends on [Task 1]（修复边类型前需要先提取共享常量）
- [Task 4] depends on [Task 1]（LayoutOrganizer 需要使用共享常量）
- [Task 6] depends on [Task 1, Task 2, Task 3, Task 4, Task 5]
