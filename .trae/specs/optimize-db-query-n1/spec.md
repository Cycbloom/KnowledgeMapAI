# 数据库查询优化 — 消除 N+1 和应用层聚合 Spec

## Why
后端服务层存在多处 N+1 查询模式和应用层聚合，导致不必要的网络往返和数据传输。部分场景已有数据库 RPC 函数但未被调用（如 `batch_update_positions`），部分场景缺少 RPC 函数（如 `create_edge`、标签聚合）。优化后可减少 60-80% 的数据库查询次数，API 响应时间降低 50%+。

## What Changes
- `batchUpdatePositions` 改用已有的 `batch_update_positions` RPC，将 N 次 HTTP 请求降为 1 次
- `edgeService.create` 创建 `create_edge` RPC，将 3-4 次验证+插入查询合并为 1 次数据库函数调用
- `getTags` 创建 `get_user_graph_tags` RPC，将 2 次查询+应用层聚合降为 1 次 SQL 聚合
- `getGraphMap` 创建 `get_graph_map_data` RPC，将 3 次查询+应用层聚合降为 1 次
- `findMissingConnections` 创建 `find_missing_connections` RPC，将全量加载+O(n²) 比较下推到数据库
- `getResearchProgress` 使用 JSONB 查询条件在 SQL 层按模块过滤，避免全量加载
- `batchUpdateNodes` 降级路径优化，减少逐条 HTTP 请求
- **BREAKING**: `batch_update_positions` RPC 函数将用 `unnest` 批量 UPDATE 替代 PL/pgSQL LOOP，提升数据库侧性能

## Impact
- Affected specs: 无直接关联 spec
- Affected code:
  - `api/services/graph/nodesService.ts` — batchUpdatePositions、batchUpdateNodes
  - `api/services/graph/graphNodeService.ts` — batchUpdatePositions
  - `api/services/graph/edgeService.ts` — create
  - `api/services/graph/graphCrudService.ts` — getTags、getDomains、getGraphMap、getResearchProgress、getLiterature
  - `api/services/graph/graphService.ts` — findMissingConnections、listGraphsFallback
  - `supabase/migrations/14_functions.sql` — 新增/修改 RPC 函数
  - `supabase/migrations/16_grants.sql` — 新增 RPC 函数授权

## ADDED Requirements

### Requirement: batchUpdatePositions 使用 RPC
系统 SHALL 在 `batchUpdatePositions` 方法中优先调用 `batch_update_positions` RPC 函数，仅在 RPC 调用失败时回退到逐条更新路径。

#### Scenario: RPC 调用成功
- **WHEN** 用户整理图谱布局触发批量位置更新
- **THEN** 系统调用 `batch_update_positions` RPC 一次性更新所有节点位置，HTTP 往返从 N 次降为 1 次

#### Scenario: RPC 调用失败
- **WHEN** `batch_update_positions` RPC 调用返回错误
- **THEN** 系统回退到现有的逐条 `Promise.all` 更新路径，并记录 warn 日志

### Requirement: batch_update_positions RPC 性能优化
系统 SHALL 将 `batch_update_positions` RPC 函数从 PL/pgSQL LOOP 逐条更新改为 `unnest` + 批量 UPDATE，减少数据库内部循环开销。

#### Scenario: 批量位置更新
- **WHEN** 调用 `batch_update_positions` RPC 传入 100 个节点位置
- **THEN** 数据库使用 `unnest` 展开数组并执行单条 UPDATE ... FROM 语句完成批量更新

### Requirement: edgeService.create 使用 RPC
系统 SHALL 创建 `create_edge` RPC 函数，将源/目标节点验证、重复边检测、软删除边恢复、新边插入合并为单次数据库函数调用。

#### Scenario: 创建新边（无冲突）
- **WHEN** 用户在图谱中创建一条新边
- **THEN** 系统调用 `create_edge` RPC 一次性完成验证+插入，HTTP 往返从 3-4 次降为 1 次

#### Scenario: 创建边时源/目标节点不存在
- **WHEN** 创建边的源节点或目标节点不在当前图谱中
- **THEN** RPC 函数返回错误信息，服务层抛出 NOT_FOUND 错误

#### Scenario: 创建边时已存在已软删除的边
- **WHEN** 同方向同类型的边已被软删除
- **THEN** RPC 函数自动恢复该边（设置 deleted_at = NULL），而非创建新边

### Requirement: getTags 使用 RPC 聚合
系统 SHALL 创建 `get_user_graph_tags` RPC 函数，在数据库层完成标签提取和计数聚合，避免将所有节点的 properties 传输到应用层。

#### Scenario: 获取用户标签列表
- **WHEN** 前端请求用户标签列表
- **THEN** 系统调用 `get_user_graph_tags` RPC，数据库层完成 JSONB 标签提取 + GROUP BY 计数，返回 `{ name, count }[]`

### Requirement: getGraphMap 使用 RPC 聚合
系统 SHALL 创建 `get_graph_map_data` RPC 函数，在数据库层完成图谱列表+节点计数+图谱间关系的聚合查询。

#### Scenario: 获取图谱地图数据
- **WHEN** 前端请求图谱地图视图
- **THEN** 系统调用 `get_graph_map_data` RPC，数据库层完成 3 表 JOIN + 聚合，返回图谱列表（含 node_count）和关系列表

### Requirement: findMissingConnections 使用 RPC
系统 SHALL 创建 `find_missing_connections` RPC 函数，在数据库层通过 CROSS JOIN + LEFT JOIN edges 找出未连接的节点对，避免全量加载到应用层做 O(n²) 比较。

#### Scenario: 查找缺失连接
- **WHEN** 用户请求图谱缺失连接分析
- **THEN** 系统调用 `find_missing_connections` RPC，数据库层完成节点对枚举+已有连接排除，返回建议列表（限制 maxSuggestions 条）

### Requirement: getResearchProgress 使用 SQL 过滤
系统 SHALL 在 `getResearchProgress` 方法中使用 JSONB 查询条件（`properties->>'backboneModule' = mod.module_type`）在 SQL 层按模块过滤节点，避免全量加载后在应用层过滤。

#### Scenario: 获取研究进度
- **WHEN** 前端请求图谱研究进度
- **THEN** 系统按模块分别查询，每次查询仅在 SQL 层返回该模块的节点，而非全量加载

### Requirement: batchUpdateNodes 降级路径优化
系统 SHALL 在 `batchUpdateNodes` 的降级路径中，将逐条 HTTP 请求改为先批量查询再批量更新，减少网络往返。

#### Scenario: 事务执行器不可用时的批量更新
- **WHEN** transactionExecutor 不可用，需要走降级路径
- **THEN** 系统批量执行 knowledge_point 更新和 graph_node 更新，而非逐条循环

## MODIFIED Requirements

### Requirement: withRpcFallback 模式扩展
现有 `withRpcFallback` 模式仅用于 2 处（listGraphs、listTrash），扩展到 getTags、getGraphMap、batchUpdatePositions 等方法，统一 RPC 优先+降级回退的调用模式。

## REMOVED Requirements
无移除的需求。
