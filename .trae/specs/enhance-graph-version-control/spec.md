# 图谱版本控制增强 Spec

## Why
当前图谱版本控制系统存在三个关键缺陷：(1) 快照不包含知识点内容(content)，导致 diff 和合并无法检测内容变更；(2) 分支与主图共享 knowledge_point 记录，分支中修改内容会直接影响主图数据；(3) 合并操作不处理分支中删除的实体，且 fallback 路径缺少合并后快照。这些问题使版本控制在内容层面形同虚设，用户无法安全地在分支中编辑知识内容。

## What Changes
- 快照数据结构增加 knowledge_point 的 content/summary 字段，实现内容级 diff
- 分支创建时为 knowledge_point 创建独立副本，隔离分支与主图的数据
- 合并操作补全 removed 实体的处理逻辑
- 合并操作在 fallback 路径也创建 post_merge 快照
- 合并冲突检测扩展到内容字段
- `listBranches` 返回值增加类型安全

## Impact
- Affected specs: graphVersion 类型定义、graphVersionService 服务层、版本控制 API 路由
- Affected code:
  - `shared/types/graphVersion.ts` — SnapshotNodeData 增加 content/summary 字段
  - `api/services/graph/graphVersionService.ts` — 快照创建、diff 计算、分支创建、合并逻辑
  - `api/routes/graphs/versions.ts` — 无需变更（接口不变）
  - `src/components/GraphEditor/panels/DiffDetailPanel.tsx` — 展示内容变更
  - `src/components/GraphEditor/panels/BranchManagePanel.tsx` — 冲突展示增强
  - `supabase/migrations/27_graph_version_control.sql` — 无需变更（snapshot_data 是 JSONB）

## ADDED Requirements

### Requirement: 快照包含知识点内容
系统 SHALL 在创建快照时，将 knowledge_point 的 content 和 summary 字段一并保存到 SnapshotNodeData 中。

#### Scenario: 创建快照包含内容
- **WHEN** 系统创建图谱快照
- **THEN** SnapshotNodeData 中包含 `content` 和 `summary` 字段，值来自 knowledge_points 表

#### Scenario: 内容变更被 diff 检测
- **WHEN** 两个快照中同一 knowledgePointId 的 content 或 summary 不同
- **THEN** computeDiff 将该节点标记为 modified，changedFields 包含 `content` 和/或 `summary`

### Requirement: 分支知识点隔离
系统 SHALL 在创建分支时，为分支中的每个 knowledge_point 创建独立副本，确保分支中对知识内容的修改不影响主图。

#### Scenario: 分支创建独立知识点
- **WHEN** 用户从主图创建分支
- **THEN** 系统为分支中的每个 knowledge_point 创建新记录（新 ID），分支的 graph_nodes 引用新的 knowledge_point_id
- **AND** 分支的 knowledge_point 记录的 `source_knowledge_point_id` 指向原始 knowledge_point_id

#### Scenario: 分支修改不影响主图
- **WHEN** 用户在分支中修改某知识点的 content
- **THEN** 主图中对应知识点的 content 保持不变

### Requirement: 合并处理删除的实体
系统 SHALL 在合并分支时，正确处理分支中删除的节点和边。

#### Scenario: 合并分支中删除的节点
- **WHEN** 分支中删除了某个节点（该节点在分支源快照中存在，在分支当前状态中不存在）
- **AND** 用户选择应用此删除变更
- **THEN** 主图中对应的 graph_node 被软删除

#### Scenario: 合并分支中删除的边
- **WHEN** 分支中删除了某条边
- **AND** 用户选择应用此删除变更
- **THEN** 主图中对应的 edge 被软删除

### Requirement: 合并后快照一致性
系统 SHALL 在所有代码路径（包括 transactionExecutor 不可用的 fallback 路径）中，合并成功后自动创建 post_merge 快照。

#### Scenario: Fallback 路径合并后创建快照
- **WHEN** transactionExecutor 不可用，applyMerge 通过 fallback 路径执行
- **THEN** 合并成功后仍自动创建 post_merge 快照

### Requirement: 内容级合并冲突检测
系统 SHALL 在三路合并中检测 content 和 summary 字段的冲突。

#### Scenario: 双方修改同一知识点内容
- **WHEN** 主图和分支都修改了同一 knowledge_point 的 content
- **THEN** 系统将该知识点标记为冲突，用户需选择保留 main 或 branch 的内容

### Requirement: listBranches 类型安全
系统 SHALL 为 listBranches 返回值定义具体的 TypeScript 类型，替代 any[]。

#### Scenario: listBranches 返回类型化数据
- **WHEN** 调用 listBranches
- **THEN** 返回 BranchInfo[] 类型，包含 id、title、branchName、createdAt、nodeCount、edgeCount 字段

## MODIFIED Requirements

### Requirement: DiffDetailPanel 展示内容变更
DiffDetailPanel 组件 SHALL 在节点 diff 展开时，显示 content 和 summary 字段的变更对比（before → after），与现有的 xPosition/level 等字段变更展示方式一致。

### Requirement: MergeConflictList 展示内容冲突
BranchManagePanel 中的 MergeConflictList 组件 SHALL 在冲突项展开时，显示冲突字段的 before/after 值，包括 content 和 summary 的变更对比。
