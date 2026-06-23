# Tasks

- [x] Task 1: 扩展 SnapshotNodeData 类型，增加 content/summary 字段
  - [x] SubTask 1.1: 在 `shared/types/graphVersion.ts` 的 SnapshotNodeData 接口中增加 `content: string` 和 `summary: string | null` 字段
  - [x] SubTask 1.2: 在 `graphVersionService.ts` 的 `createSnapshot` 和 `buildCurrentSnapshotData` 方法中，查询 knowledge_points 时增加 `content, summary` 字段并映射到 SnapshotNodeData
  - [x] SubTask 1.3: 在 `computeDiff` 方法中，增加 content 和 summary 的字段比较逻辑

- [x] Task 2: 分支知识点隔离 — createBranch 创建独立 knowledge_point 副本
  - [x] SubTask 2.1: 在 `shared/types/graphVersion.ts` 中增加 BranchInfo 类型定义（替代 listBranches 的 any[]）
  - [x] SubTask 2.2: 在 knowledge_points 表增加 `source_knowledge_point_id` 列（修改 `supabase/migrations/03_knowledge_points.sql`）
  - [x] SubTask 2.3: 修改 `graphVersionService.ts` 的 `createBranch` 方法：为每个 knowledge_point 创建新记录（复制 title/content/summary/keywords/properties 等），设置 source_knowledge_point_id 指向原始记录，分支的 graph_nodes 引用新的 knowledge_point_id
  - [x] SubTask 2.4: 修改 `graphVersionService.ts` 的 `listBranches` 方法，返回 BranchInfo[] 类型，增加 nodeCount/edgeCount 统计

- [x] Task 3: 合并操作补全 — 处理 removed 实体 + fallback 快照
  - [x] SubTask 3.1: 修改 `applyMerge` 方法，增加对 `mergeResult.diff.nodes.removed` 和 `mergeResult.diff.edges.removed` 的处理逻辑：当用户选择应用删除变更时，软删除主图中对应的 graph_node/edge
  - [x] SubTask 3.2: 修改 `applyMerge` 方法的 fallback 路径（transactionExecutor 不可用时），在合并成功后添加 `await this.autoSnapshot(supabase, mainGraphId, 'auto', operatorId)` 创建 post_merge 快照
  - [x] SubTask 3.3: 修改 `MergeRequest` 类型，在 `selectedChanges` 中增加 `removedNodeIds: string[]` 和 `removedEdgeIds: string[]` 字段

- [x] Task 4: 内容级合并冲突检测
  - [x] SubTask 4.1: 修改 `mergeBranch` 方法中的三路合并冲突检测，在节点冲突检测中增加 content 和 summary 字段的比较（当前仅比较 xPosition/yPosition/level/title）
  - [x] SubTask 4.2: 确保冲突解决时，content 和 summary 字段根据用户选择（main/branch）正确应用

- [x] Task 5: 前端 DiffDetailPanel 展示内容变更
  - [x] SubTask 5.1: 修改 `DiffDetailPanel.tsx` 的 NodeDiffRow 组件，在 expanded 状态下展示 content 和 summary 字段的 before → after 变更（对长文本使用截断显示）

- [x] Task 6: 前端 BranchManagePanel 冲突展示增强
  - [x] SubTask 6.1: 修改 `BranchManagePanel.tsx` 的 MergeConflictList 组件，接收实际冲突数据并渲染 ConflictItem 列表（当前组件为空壳，仅显示提示文字）
  - [x] SubTask 6.2: 修改 ConflictItem 组件，展示冲突字段的 before/after 值，包括 content 变更对比

# Task Dependencies
- [Task 2] depends on [Task 1] — 分支隔离需要快照包含 content 才能在合并时正确检测内容冲突
- [Task 4] depends on [Task 1] — 内容级冲突检测依赖 computeDiff 能检测 content 变更
- [Task 5] depends on [Task 1] — 前端展示依赖后端返回 content 字段
- [Task 6] depends on [Task 4] — 冲突展示依赖后端返回内容级冲突数据
- [Task 3] 独立于其他任务，可并行执行
