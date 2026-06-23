# 前端数据获取优化 Spec

## Why
打开图谱编辑器需要 2 次独立请求（节点数据 + 学习状态），乐观更新成功后仍通过事件触发全量 refetch 导致乐观更新被覆盖，批量状态查询存在 N+1 问题。这些冗余请求和不必要的刷新增加了页面加载时间和网络开销。

## What Changes
- 后端 `GET /graphs/:id/nodes` 增加 `includeStatus` 查询参数，认证用户可一次获取节点数据和学习状态
- 后端新增 `POST /graphs/batch-node-status` 批量状态查询接口
- 前端 `useGraphData` 合并节点状态数据，`GraphEditor` 和 `LearningMode` 不再单独调用 `useGraphNodeStatus`
- 前端乐观 mutation 的 `onSettled` 改为用服务端响应更新缓存，而非发布事件触发全量 refetch
- 前端 `useGraphNodeStatus` staleTime 从 30s 调整为 60s
- 前端 `useBatchGraphStatus` 改为调用批量 API

## Impact
- Affected specs: 无
- Affected code:
  - `api/routes/graphs/analysis.ts` — 增加 includeStatus 参数处理
  - `api/services/graph/graphService.ts` — getGraphNodes 方法增加 status 数据
  - `api/services/graph/graphCrudService.ts` — 可能需要调整查询
  - `src/hooks/queries/useGraphQueries.ts` — useGraphData 合并状态、useBatchGraphStatus 改用批量 API、staleTime 调整
  - `src/hooks/mutations/mutationFactory.ts` — createOptimisticMutation 增加 onSuccess 缓存更新
  - `src/hooks/mutations/useGraphMutations.ts` — 乐观 mutation 的 onSettled 改为 onSuccess
  - `src/services/FrontendEventSubscribers.ts` — graph_data_changed 订阅不再 invalidate graphData
  - `src/services/api/contracts/IGraphsApi.ts` — 新增 batchGetNodeStatus 方法签名
  - `src/services/api/graphs.ts` — 新增 batchGetNodeStatus 实现
  - `src/services/mobile/graphs.ts` — 适配新接口
  - `src/pages/GraphEditor.tsx` — 移除独立的 useGraphNodeStatus 调用
  - `src/pages/LearningMode.tsx` — 移除独立的 useGraphNodeStatus 调用
  - `src/pages/CombinedGraphView.tsx` — useBatchGraphStatus 改用批量 API

## ADDED Requirements

### Requirement: 合并图谱节点数据与学习状态查询
后端 `GET /graphs/:id/nodes` 接口 SHALL 支持 `includeStatus` 查询参数。当 `includeStatus=true` 且用户已认证时，响应 SHALL 在 `nodeStatus` 字段中包含各节点的学习状态数据（与 `GET /graphs/:id/node-status` 返回格式一致）。当用户未认证或 `includeStatus` 未设置时，SHALL 不返回状态数据。

#### Scenario: 认证用户请求含状态的节点数据
- **WHEN** 认证用户请求 `GET /graphs/:id/nodes?includeStatus=true`
- **THEN** 响应包含 `nodes`、`edges` 和 `nodeStatus` 三个字段
- **AND** `nodeStatus` 格式与 `GET /graphs/:id/node-status` 一致

#### Scenario: 未认证用户请求含状态的节点数据
- **WHEN** 未认证用户请求 `GET /graphs/:id/nodes?includeStatus=true`
- **THEN** 响应包含 `nodes` 和 `edges`，`nodeStatus` 为空对象 `{}`

#### Scenario: 不请求状态
- **WHEN** 请求 `GET /graphs/:id/nodes`（无 includeStatus 参数）
- **THEN** 响应仅包含 `nodes` 和 `edges`，行为与当前一致

### Requirement: 批量节点状态查询接口
后端 SHALL 提供 `POST /graphs/batch-node-status` 接口，接受 `{ graph_ids: string[] }` 请求体，返回 `Record<graphId, Record<knowledgePointId, NodeStatus>>` 格式的批量状态数据。

#### Scenario: 批量查询多个图谱的节点状态
- **WHEN** 认证用户 POST `/graphs/batch-node-status` with `{ graph_ids: ["id1", "id2"] }`
- **THEN** 响应包含每个图谱的节点状态映射
- **AND** 单次请求替代 N 次独立请求

#### Scenario: 空数组或无效输入
- **WHEN** 请求体 `graph_ids` 为空数组
- **THEN** 响应返回空对象 `{}`

### Requirement: 前端 useGraphData 合并节点状态
前端 `useGraphData` hook SHALL 在请求时携带 `includeStatus=true` 参数，并在返回数据中包含 `nodeStatus` 字段。调用方不再需要单独调用 `useGraphNodeStatus`。

#### Scenario: GraphEditor 打开图谱
- **WHEN** 用户打开图谱编辑器
- **THEN** 仅发 1 次请求获取节点数据和状态（而非当前的 2 次）

### Requirement: 乐观 mutation 缓存更新优化
`createOptimisticMutation` SHALL 在 `onSuccess` 回调中用服务端响应数据更新缓存，替代当前 `onSettled` 中发布事件触发全量 refetch 的模式。`onSettled` 中 SHALL 保留事件发布用于跨组件通知，但 `graph_data_changed` 事件订阅 SHALL 不再 invalidate `graphData` 查询键（因为缓存已通过 onSuccess 更新）。

#### Scenario: 乐观创建节点成功
- **WHEN** 用户创建节点，乐观更新已应用，服务端返回成功
- **THEN** 缓存用服务端响应数据替换乐观数据（而非触发全量 refetch）
- **AND** 不产生额外的网络请求来重新获取图谱数据

#### Scenario: 乐观创建节点失败
- **WHEN** 用户创建节点，乐观更新已应用，但服务端返回错误
- **THEN** 缓存回滚到乐观更新前的状态（现有行为不变）

### Requirement: useBatchGraphStatus 改用批量 API
`useBatchGraphStatus` hook SHALL 调用 `POST /graphs/batch-node-status` 批量接口，而非对每个 graphId 发起独立请求。

#### Scenario: 查询 2 个图谱的节点状态
- **WHEN** CombinedGraphView 查询 2 个图谱的节点状态
- **THEN** 仅发 1 次批量请求（而非当前的 2 次独立请求）

### Requirement: 节点状态 staleTime 调整
`useGraphNodeStatus` 的 staleTime SHALL 从 30 秒调整为 60 秒，减少不必要的后台 refetch。

## MODIFIED Requirements

### Requirement: graph_data_changed 事件订阅行为
`FrontendEventSubscribers` 中 `graph_data_changed` 事件订阅 SHALL 不再 invalidate `graphData` 查询键（该查询已由乐观 mutation 的 onSuccess 更新）。仍需 invalidate `graphNodeStatus`、`graphLearningPath`、`graph` 和 `graphs` 查询键，因为这些数据可能受节点变更影响且未被乐观更新覆盖。

## REMOVED Requirements
无
