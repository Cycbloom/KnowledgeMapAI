# 知识图谱版本控制 Checklist

## Phase 1: 数据库基础与事件记录

### graph_events 表
- [x] `graph_events` 表已创建，包含 id、graph_id、event_type、event_data、operator_id、batch_id、snapshot_id、created_at 字段
- [x] `graph_event_type` 枚举类型已创建，包含所有事件类型
- [x] `graph_events` 表的索引已创建（graph_id+created_at、event_type、batch_id、operator_id）

### graph_snapshots 表
- [x] `graph_snapshots` 表已创建，包含 id、graph_id、snapshot_data、description、snapshot_type、node_count、edge_count、operator_id、created_at 字段
- [x] `graph_snapshots` 表的索引已创建（graph_id+created_at、snapshot_type）

### knowledge_graphs 表扩展
- [x] `knowledge_graphs` 表已新增 branch_name、branch_source_snapshot_id、is_branch 字段
- [x] 分支相关索引已创建

### TypeScript 类型
- [x] `shared/types/graphVersion.ts` 已创建，定义了 GraphEvent、GraphSnapshot、GraphDiff、DiffResult、SnapshotData 等类型
- [x] `shared/types/events.ts` 中 GraphEventType 的 payload 类型已补全

## Phase 2: 版本控制核心服务

### graphVersionService
- [x] `recordEvent()` 方法已实现，事件正确写入 `graph_events` 表
- [x] `createSnapshot()` 方法已实现，快照包含所有未删除节点和边的完整数据
- [x] `autoSnapshot()` 方法已实现，根据 snapshot_type 自动生成描述
- [x] `listSnapshots()` 方法已实现，支持分页查询
- [x] `getSnapshot()` 方法已实现，返回单个快照详情
- [x] `diffSnapshots()` 方法已实现，正确计算节点/边的增删改差异
- [x] `diffWithCurrent()` 方法已实现，正确对比快照与当前状态
- [x] `rollbackToSnapshot()` 方法已实现，回滚前创建当前状态快照，回滚后图谱状态正确
- [x] `listEvents()` 方法已实现，支持按 batch_id 和 event_type 筛选

## Phase 3: 集成事件记录到现有服务

### graphNodeService 集成
- [x] `addToGraph()` 创建节点后记录 `node_created` 事件
- [x] `removeFromGraph()` 删除节点后记录 `node_deleted` 事件
- [x] `updatePosition()`/`batchUpdatePositions()` 更新位置后记录 `node_updated` 事件
- [x] `updateLevel()` 更新层级后记录 `node_updated` 事件
- [x] `batchDelete()` 批量删除后每个节点记录 `node_deleted` 事件，共享 batch_id

### edgeService 集成
- [x] `create()` 创建边后记录 `edge_created` 事件
- [x] `delete()` 删除边后记录 `edge_deleted` 事件
- [x] `update()` 更新边后记录 `edge_updated` 事件

### graphService 集成
- [x] `updateGraph()` 更新图谱属性后记录 `graph_updated` 事件
- [x] AI 扩展前自动创建 `pre_ai_expand` 快照
- [x] 批量删除（≥3 个节点）前自动创建 `pre_batch_delete` 快照

## Phase 4: 分支与合并

### 分支功能
- [x] `createBranch()` 方法已实现，创建分支图谱并复制所有节点和边
- [x] 分支图谱的 is_branch=true，parent_graph_id 和 branch_source_snapshot_id 正确设置
- [x] `listBranches()` 方法已实现，返回指定图谱的所有分支

### 合并功能
- [x] `mergeBranch()` 方法已实现，返回分支与主线的 Diff
- [x] `applyMerge()` 方法已实现，根据用户选择应用变更到主线
- [x] 合并冲突检测已实现，同一实体被双方修改时标记为冲突

## Phase 5: API 路由

### 版本控制 API
- [x] `GET /api/graphs/:id/snapshots` 端点已实现，返回快照列表
- [x] `POST /api/graphs/:id/snapshots` 端点已实现，手动创建快照
- [x] `GET /api/graphs/:id/snapshots/:snapshotId` 端点已实现，返回快照详情
- [x] `GET /api/graphs/:id/diff` 端点已实现，返回 Diff 结果
- [x] `POST /api/graphs/:id/rollback` 端点已实现，执行回滚
- [x] `POST /api/graphs/:id/branches` 端点已实现，创建分支
- [x] `GET /api/graphs/:id/branches` 端点已实现，获取分支列表
- [x] `POST /api/graphs/:id/merge` 端点已实现，合并分支
- [x] `GET /api/graphs/:id/events` 端点已实现，获取事件列表
- [x] 路由已在 graphs/index.ts 中注册
- [x] 请求验证 Schema 已定义

## Phase 6: 前端 UI

### 版本历史面板
- [x] `VersionHistoryPanel.tsx` 组件已实现，展示快照时间线
- [x] 自动/手动快照有区分标识
- [x] 快照操作菜单已实现（查看 Diff、回滚、创建分支）
- [x] 手动创建快照对话框已实现

### Diff 可视化
- [x] Diff 可视化组件已实现（`DiffDetailPanel.tsx`），颜色标识差异（绿=新增、红=删除、黄=修改）
- [x] `DiffDetailPanel.tsx` 组件已实现，展示字段级对比
- [x] Diff 筛选功能已实现（按变更类型和实体类型的筛选 chips）

### 分支管理 UI
- [x] 分支列表展示已实现（集成在 VersionHistoryPanel 的"分支"标签页中）
- [x] 创建分支对话框已实现
- [x] 合并对话框已实现，支持选择性合并和冲突解决

### 图谱编辑器集成
- [x] 图谱编辑器工具栏已添加"版本历史"入口
- [x] React Query hooks 已创建（useSnapshots, useDiff, useRollback, useBranches, useMerge）
- [x] API 调用函数已创建
