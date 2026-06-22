# Tasks

- [x] Task 1: 优化 batch_update_positions RPC 函数并接入服务层
  - [x] SubTask 1.1: 将 `batch_update_positions` RPC 从 PL/pgSQL LOOP 改为 `unnest` + 批量 UPDATE（修改 `supabase/migrations/14_functions.sql`）
  - [x] SubTask 1.2: 在 `nodesService.batchUpdatePositions` 中使用 RPC 优先模式，失败回退到逐条更新
  - [x] SubTask 1.3: 在 `graphNodeService.batchUpdatePositions` 中同步应用相同优化
  - [x] SubTask 1.4: 验证 RPC 授权（`supabase/migrations/16_grants.sql`）

- [x] Task 2: 创建 create_edge RPC 函数并接入 edgeService
  - [x] SubTask 2.1: 在 `14_functions.sql` 中创建 `create_edge` RPC 函数，合并源/目标节点验证、重复边检测、软删除边恢复、新边插入
  - [x] SubTask 2.2: 在 `16_grants.sql` 中授权 `create_edge` 函数
  - [x] SubTask 2.3: 修改 `edgeService.create` 使用 RPC 优先模式
  - [x] SubTask 2.4: 保留降级路径（现有逐条查询逻辑），确保 RPC 失败时行为一致

- [x] Task 3: 创建 get_user_graph_tags RPC 函数并接入 getTags
  - [x] SubTask 3.1: 在 `14_functions.sql` 中创建 `get_user_graph_tags` RPC 函数，使用 `jsonb_array_elements_text` + `GROUP BY` 完成标签聚合
  - [x] SubTask 3.2: 在 `16_grants.sql` 中授权
  - [x] SubTask 3.3: 修改 `graphCrudService.getTags` 使用 RPC 优先模式

- [x] Task 4: 创建 get_graph_map_data RPC 函数并接入 getGraphMap
  - [x] SubTask 4.1: 在 `14_functions.sql` 中创建 `get_graph_map_data` RPC 函数，聚合图谱列表+节点计数+图谱间关系
  - [x] SubTask 4.2: 在 `16_grants.sql` 中授权
  - [x] SubTask 4.3: 修改 `graphCrudService.getGraphMap` 使用 RPC 优先模式

- [x] Task 5: 创建 find_missing_connections RPC 函数并接入 graphService
  - [x] SubTask 5.1: 在 `14_functions.sql` 中创建 `find_missing_connections` RPC 函数，使用 NOT EXISTS 找出未连接节点对
  - [x] SubTask 5.2: 在 `16_grants.sql` 中授权
  - [x] SubTask 5.3: 修改 `graphService.findMissingConnections` 使用 RPC 优先模式

- [x] Task 6: 优化 getResearchProgress 使用 SQL JSONB 过滤
  - [x] SubTask 6.1: 修改 `graphCrudService.getResearchProgress`，将应用层 `filter(backboneModule)` 改为 SQL 查询条件 `knowledge_points.properties->>'backboneModule' = module_type`

- [x] Task 7: 优化 batchUpdateNodes 降级路径
  - [x] SubTask 7.1: 在 `nodesService.batchUpdateNodes` 的降级路径中，将 kp 和 gn 更新分开批量执行

# Task Dependencies
- [Task 2] depends on [Task 1] (共享 withRpcFallback 模式参考)
- [Task 3] depends on [Task 1] (共享 withRpcFallback 模式参考)
- [Task 4] depends on [Task 1] (共享 withRpcFallback 模式参考)
- [Task 5] depends on [Task 1] (共享 withRpcFallback 模式参考)
- [Task 6] independent
- [Task 7] independent
- Task 2-5 可并行实施（各自独立的 RPC 函数和服务方法）
