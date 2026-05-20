# 大纲视图树形层级修复 Spec

## Why

知识图谱的大纲视图（GraphOutline）在构建树形结构时，未区分边的语义类型（relationship_type），将所有边（包括 `related`、`similar_to`、`synonym`、`opposite`、`branch` 等非层级关系）都当作父子关系来处理。这导致本应平级的节点被错误地嵌套显示，大纲视图无法反映真实的知识逻辑层次关系。

## What Changes

- 修改 `GraphOutline.tsx` 中树形结构的构建逻辑（第 171-298 行的 `useMemo`）
- 引入**层级边类型白名单**机制，仅将具有包含/从属语义的边用于构建树形父子关系
- 非层级边（如 related、similar_to、synonym、opposite 等）不再影响大纲视图的节点嵌套
- 同步修改 `treeLayout.ts` 中的树形布局构建逻辑，保持一致性行为

## Impact

- Affected code:
  - `src/components/GraphEditor/panels/GraphOutline.tsx` — 大纲视图组件的核心树形构建逻辑
  - `src/utils/layouts/treeLayout.ts` — 树形布局算法（TreeView 视图使用）
- Affected specs: 无直接关联的现有 spec

## ADDED Requirements

### Requirement: 层级边类型过滤

系统 SHALL 在构建大纲视图的树形结构时，仅使用具有层级/包含语义的边来建立父子关系。

#### 层级边类型白名单（HIERARCHICAL_EDGE_TYPES）

以下 `relationship_type` 的边被视为层级关系，可用于构建树形父子结构：

| 关系类型 | 语义 | 说明 |
|---------|------|------|
| `contains` | 包含 | A 包含 B，B 是 A 的子概念 |
| `parent_child` | 父子 | 显式父子关系 |
| `part_of` | 组成部分 | A 是 B 的一部分 |
| `generalization` | 泛化 | A 是 B 的泛化（父→子） |
| `specialization` | 特化 | A 是 B 的特化（父→子） |
| `derived_from` | 派生自 | A 从 B 派生 |

#### 非层级边类型（不参与树形构建）

以下类型的边 SHALL NOT 用于建立大纲视图中的父子关系：

- **语义类**: `related`, `similar_to`, `opposite`, `synonym`, `equivalent`
- **依赖类**: `depends_on`, `prerequisite`, `constrains`
- **时序/过程类**: `branch`, `merge`, `follows`, `parallel`, `trigger`, `loop`
- **交互类**: `points_to`, `acts_on`, `influences`, `feedback`, `calls`
- **因果类**: `causes`, `derives`, `proportional`, `inverse`
- **其他**: `supports`, `mutex`, `exclusive`

#### Scenario: 文献综述下对比节点平级显示

- **WHEN** 用户查看知识图谱的大纲视图，其中「文献综述」节点下有多个「与XX框架对比」子节点，以及这些对比节点通过非层级边（如 `related` 或 `synonym`）连接到其他节点
- **THEN** 所有「与XX框架对比」节点应作为「文献综述」的直接同级子节点显示，不会因为非层级边的关系而被错误地嵌套到不同层级

#### Scenario: 复合词/同义词边不影响树形结构

- **WHEN** 节点之间存在 `synonym` 或 `similar_to` 类型的边
- **THEN** 这些边不应在大纲视图中创建任何父子嵌套关系

## MODIFIED Requirements

### Requirement: GraphOutline 树形构建算法

修改后的树形构建算法 SHALL：

1. 在遍历边构建 `childrenMap` 和 `parentMap` 时，先过滤出 `relationship_type` 属于 `HIERARCHICAL_EDGE_TYPES` 白名单的边
2. 仅使用过滤后的层级边来建立父子关系
3. 对于没有 `relationship_type` 或类型不在白名单中的边，不将其纳入树形结构
4. 保持现有的排序优化逻辑（level-based 排序）不变
5. 孤立节点（无层级边连接的节点）仍作为根节点或独立节点展示

### Requirement: treeLayout 布局算法一致性

`treeLayout.ts` 中的 `createTreeLayout` 函数 SHALL 应用相同的层级边类型过滤逻辑，确保 TreeView 视图与大纲视图的行为一致。
