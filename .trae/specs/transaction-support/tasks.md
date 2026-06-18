# Tasks

- [x] Task 1: 创建事务执行器基础设施
  - [x] SubTask 1.1: 在 `api/database/` 下创建 `transactionExecutor.ts`，基于 `pg` Pool 实现 `BEGIN/COMMIT/ROLLBACK` 事务
  - [x] SubTask 1.2: 实现连接池管理（复用 DATABASE_URL 环境变量，懒初始化）
  - [x] SubTask 1.3: 实现 pg 不可用时的降级逻辑（顺序执行 + warn 日志）
  - [x] SubTask 1.4: 修改 `SupabaseAdapter.transaction()` 调用事务执行器

- [x] Task 2: 创建 PostgreSQL 事务函数（P0 级：图谱删除）
  - [x] SubTask 2.1: 在 `supabase/migrations/14_functions.sql` 中创建 `permanent_delete_graph(p_graph_id uuid, p_user_id uuid)` 函数
  - [x] SubTask 2.2: 创建 `soft_delete_graph_with_branches(p_graph_id uuid, p_user_id uuid)` 函数
  - [x] SubTask 2.3: 创建 `batch_soft_delete_graphs(p_graph_ids uuid[], p_user_id uuid)` 函数
  - [x] SubTask 2.4: 创建 `batch_permanent_delete_graphs(p_graph_ids uuid[], p_user_id uuid)` 函数

- [x] Task 3: 迁移图谱删除操作到 RPC 函数
  - [x] SubTask 3.1: 修改 `graphService.permanentDeleteGraph()` 使用 `rpc('permanent_delete_graph')` 替代多步操作
  - [x] SubTask 3.2: 修改 `graphService.permanentDeleteGraphs()` 使用 `rpc('batch_permanent_delete_graphs')`
  - [x] SubTask 3.3: 修改 `graphService.deleteGraph()` 使用 `rpc('soft_delete_graph_with_branches')`
  - [x] SubTask 3.4: 修改 `graphService.deleteGraphs()` 使用 `rpc('batch_soft_delete_graphs')`

- [x] Task 4: 创建 PostgreSQL 事务函数（P1 级：节点操作）
  - [x] SubTask 4.1: 创建 `create_knowledge_point_with_node()` 函数（知识点+图谱节点原子创建）
  - [x] SubTask 4.2: 创建 `remove_node_with_edges()` 函数（节点+关联边原子软删除）
  - [x] SubTask 4.3: 创建 `batch_remove_nodes_with_edges()` 函数（批量节点+关联边原子软删除）

- [x] Task 5: 迁移节点操作到 RPC 函数
  - [ ] SubTask 5.1: 修改 `nodes.ts` POST `/nodes` 使用 `rpc('create_knowledge_point_with_node')`（延后：当前 createKnowledgePointWithGraphNode 已有手动回滚，优先级较低）
  - [x] SubTask 5.2: 修改 `graphNodeService.removeFromGraph()` 使用 `rpc('remove_node_with_edges')`
  - [x] SubTask 5.3: 修改 `graphNodeService.batchDelete()` 使用 `rpc('batch_remove_nodes_with_edges')`
  - [x] SubTask 5.4: 修改 `nodes.ts` POST `/nodes/batch-delete` 补充关联边的删除逻辑

- [x] Task 6: 迁移数据导入到事务
  - [ ] SubTask 6.1: 创建 `import_graph_data()` PostgreSQL 函数（延后：当前已通过增强回滚逻辑保证一致性，RPC 函数复杂度较高）
  - [x] SubTask 6.2: 修改 `routes/data.ts` POST `/import` 使用事务执行器或增强回滚
  - [x] SubTask 6.3: 修改 `routes/data.ts` POST `/import/markdown` 使用事务执行器或增强回滚
  - [x] SubTask 6.4: 修改 `routes/data.ts` POST `/reset` 使用事务执行器

- [x] Task 7: 迁移任务操作到事务
  - [x] SubTask 7.1: 创建 `start_task_with_execution()` PostgreSQL 函数
  - [x] SubTask 7.2: 创建 `complete_task_with_execution()` PostgreSQL 函数
  - [x] SubTask 7.3: 修改 `taskService.startTask()` 使用 RPC
  - [x] SubTask 7.4: 修改 `taskService.completeTask()` 使用 RPC
  - [x] SubTask 7.5: 修改 `taskService.reorderTasks()` 使用新 `reorder_tasks` RPC 函数

# Task Dependencies
- [Task 2] depends on [Task 1] -- RPC 函数需要事务执行器作为降级方案
- [Task 3] depends on [Task 2] -- 迁移代码依赖 RPC 函数已创建
- [Task 5] depends on [Task 4] -- 迁移代码依赖 RPC 函数已创建
- [Task 6] depends on [Task 1] -- 数据导入使用事务执行器
- [Task 7] depends on [Task 1] -- 任务操作使用事务执行器或 RPC
- [Task 4] 和 [Task 2] 可并行
- [Task 5] 和 [Task 3] 可并行
