# 边类型兼容性统一修复 Spec

## Why

树状视图（GraphOutline 侧栏、TreeView 布局）依赖 `HIERARCHICAL_EDGE_TYPES`（`contains`、`parent_child`、`part_of`、`derived_from`）过滤层级边来构建父子关系树。但思维导图节点无限拓展、节点操作、辅导提取、手动连线等多个功能在创建父子边时统一使用 `relationship_type: 'related'`（语义关系类型），导致这些边被树状视图过滤掉，无法正确呈现在层级树中。此外，代码库中存在默认值不一致、常量重复定义、布局组件不按类型过滤等多处系统性问题，需要统一修复。

## What Changes

- 提取 `HIERARCHICAL_EDGE_TYPES` 为共享常量，消除重复定义
- 修复所有创建父子边时使用 `'related'` 的代码，改为使用 `'contains'`（层级关系的默认类型）
- 统一全代码库默认边类型为 `'contains'`：数据库 DDL、后端服务、前端代码均使用 `'contains'` 作为默认值（`'related'` 是早期类型系统建立前的占位符，类型拓展后应使用 `'contains'`）
- 修复 `LayoutOrganizer` 不按边类型过滤的问题，增加层级边过滤逻辑
- 修复 `QuadrantEdge.tsx` 中遗留的 `related_to` 幽灵类型
- 修复 `GraphEdges.tsx` 中不安全的 `GraphRelationType` 强制类型转换
- 修复 `graphRelationService.ts` 中缺少 `cross_domain` 的类型定义
- 修复数据库种子数据中 `prerequisite` 颜色与前端配置不一致的问题

## Impact

- Affected specs: 树状视图层级构建、思维导图拓展、节点操作、辅导提取、图分析、图谱间关系
- Affected code:
  - `src/config/relationshipTypes.ts` — 新增共享常量导出
  - `src/components/GraphEditor/panels/GraphOutline.tsx` — 使用共享常量
  - `src/utils/layouts/treeLayout.ts` — 使用共享常量
  - `src/components/GraphEditor/shared/LayoutOrganizer.tsx` — 增加边类型过滤
  - `src/hooks/utils/nodeExpansionUtils.ts` — 修改边类型为 `'contains'`
  - `src/hooks/graphEditor/useGraphNodeOperations.ts` — 修改父子边类型为 `'contains'`
  - `src/hooks/common/useTutorOperations.ts` — 修改父子边类型为 `'contains'`
  - `src/pages/GraphEditor.tsx` — 修改手动连线默认类型为 `'contains'`
  - `src/pages/LearningMode.tsx` — 修改连线默认类型为 `'contains'`
  - `src/components/GraphEditor/canvas/QuadrantEdge.tsx` — 移除 `related_to`
  - `src/components/GraphMap/canvas/GraphEdges.tsx` — 修复类型转换
  - `api/services/graph/edgeService.ts` — 默认边类型改为 `'contains'`
  - `api/database/adapters/supabase.ts` — 默认边类型改为 `'contains'`
  - `api/routes/backup.ts` — 默认边类型改为 `'contains'`
  - `api/services/graph/graphRelationService.ts` — 补充 `cross_domain`
  - `supabase/migrations/04_graph_structure.sql` — 数据库 DDL 默认值改为 `'contains'`
  - `supabase/migrations/54_seed_relationship_types.sql` — 修复颜色

---

## ADDED Requirements

### Requirement: 共享层级边类型常量

系统 SHALL 在 `src/config/relationshipTypes.ts` 中导出 `HIERARCHICAL_EDGE_TYPES` 常量集合，包含 `contains`、`parent_child`、`part_of`、`derived_from` 四种层级边类型。

#### Scenario: 所有需要层级边类型过滤的代码使用共享常量
- **WHEN** 任何组件或工具函数需要判断边是否为层级类型
- **THEN** 使用从 `relationshipTypes.ts` 导入的 `HIERARCHICAL_EDGE_TYPES`
- **AND** 不再在各自文件中重复定义该常量

### Requirement: 父子边创建使用层级类型

系统 SHALL 在创建明确表达父子关系的边时，使用 `contains` 作为默认 `relationship_type`，而非 `related`。

#### Scenario: 思维导图节点拓展创建父子边
- **WHEN** 用户通过思维导图无限拓展功能创建子节点
- **THEN** 新创建的边使用 `relationship_type: 'contains'`
- **AND** 该边在树状视图中正确显示为父子关系

#### Scenario: 节点操作创建父子边
- **WHEN** 用户通过节点操作（添加子节点、编辑节点父节点）创建父子边
- **THEN** 新创建的边使用 `relationship_type: 'contains'`

#### Scenario: 辅导提取创建父子边
- **WHEN** 用户通过辅导提取功能将概念添加到图谱
- **THEN** 新创建的边使用 `relationship_type: 'contains'`

#### Scenario: 手动连线创建父子边
- **WHEN** 用户在图谱编辑器或学习模式中手动创建连线
- **THEN** 新创建的边使用 `relationship_type: 'contains'`（因为手动连线场景下通常建立的是包含/父子关系）

### Requirement: LayoutOrganizer 按边类型过滤层级关系

系统 SHALL 在 `LayoutOrganizer` 的布局计算中，仅使用层级类型的边构建父子映射，与 `GraphOutline` 和 `treeLayout` 保持一致。

#### Scenario: LayoutOrganizer 组织布局时过滤非层级边
- **WHEN** LayoutOrganizer 计算节点位置
- **THEN** 仅使用 `HIERARCHICAL_EDGE_TYPES` 中的边构建父子关系
- **AND** 非层级边（如 `related`、`similar_to`）不参与层级布局计算

### Requirement: 默认边类型统一为 contains

系统 SHALL 在所有代码路径中，当边类型未指定时统一回退为 `'contains'`。`'related'` 是早期类型系统建立前的占位符，类型拓展后 `'contains'` 更符合知识图谱中绝大多数边表达层级/包含关系的实际语义。

#### Scenario: 数据库 DDL 默认值
- **WHEN** 向 `edges` 表插入记录且未指定 `relationship_type`
- **THEN** 数据库默认值为 `'contains'`

#### Scenario: 后端边服务默认值
- **WHEN** 通过 `edgeService` 创建边且未指定 `relationship_type`
- **THEN** 默认使用 `'contains'`

#### Scenario: 数据库适配器默认值
- **WHEN** 通过 `supabase.ts` 适配器创建边且未指定 `relationship_type`
- **THEN** 默认使用 `'contains'`

#### Scenario: 备份恢复默认值
- **WHEN** 从备份恢复边数据且边缺少 `relationship_type`
- **THEN** 默认使用 `'contains'`

## MODIFIED Requirements

### Requirement: GraphOutline 和 treeLayout 使用共享层级边类型常量

`GraphOutline.tsx` 和 `treeLayout.ts` 中的 `HIERARCHICAL_EDGE_TYPES` 局部常量 SHALL 替换为从 `relationshipTypes.ts` 导入的共享常量。

- 过滤逻辑不变：无类型的边保留，层级类型的边保留，其他类型过滤掉

### Requirement: QuadrantEdge 移除幽灵类型

`QuadrantEdge.tsx` 中的 `LINE_STYLES` 映射 SHALL 移除 `related_to` 条目（该类型不在 32 种预设类型中，属于遗留数据）。

### Requirement: GraphEdges 修复不安全类型转换

`GraphEdges.tsx` SHALL 不再将 `edge.relationship_type` 强制转换为 `GraphRelationType`，而是使用安全的类型判断或映射逻辑。

### Requirement: graphRelationService 补充 cross_domain 类型

后端 `graphRelationService.ts` 中的 `GraphRelationType` SHALL 包含 `'cross_domain'`，与前端 `shared/types/graph.ts` 中的定义保持一致。

### Requirement: 数据库种子数据 prerequisite 颜色修正

`54_seed_relationship_types.sql` 中 `prerequisite` 的颜色 SHALL 从 `'#F59E0B'` 修改为 `'#EF4444'`，与前端 `relationshipTypes.ts` 配置一致。

## REMOVED Requirements

无移除的需求。
