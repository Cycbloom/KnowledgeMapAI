# Tasks

- [x] Task 1: 后端 — `/graphs/:id/nodes` 增加 `includeStatus` 参数
  - [x] SubTask 1.1: 修改 `graphService.getGraphNodes` 方法，当 `includeStatus=true` 且 userId 存在时，调用 `getGraphNodeStatus` 并将结果附加到响应的 `nodeStatus` 字段
  - [x] SubTask 1.2: 修改 `api/routes/graphs/analysis.ts` 中 `/:id/nodes` 路由，解析 `includeStatus` 查询参数并传递给 service
  - [x] SubTask 1.3: 验证：未认证用户或 `includeStatus` 未设置时行为不变

- [x] Task 2: 后端 — 新增 `POST /graphs/batch-node-status` 接口
  - [x] SubTask 2.1: 在 `graphService` 中新增 `batchGetGraphNodeStatus` 方法，接受 graphIds 数组，并行查询各图谱状态
  - [x] SubTask 2.2: 在 `api/routes/graphs/analysis.ts` 中新增路由，使用 `requireAuth` 中间件
  - [x] SubTask 2.3: 添加请求体校验 schema（graph_ids: z.array(z.string().uuid()).min(1).max(20)）

- [x] Task 3: 前端 API 层 — 适配新接口
  - [x] SubTask 3.1: `IGraphsApi` 接口新增 `batchGetNodeStatus(graphIds: string[]): Promise<Record<string, Record<string, NodeStatus>>>` 方法签名
  - [x] SubTask 3.2: `src/services/api/graphs.ts` 中 `getNodes` 方法增加 `includeStatus` 参数传递
  - [x] SubTask 3.3: `src/services/api/graphs.ts` 中新增 `batchGetNodeStatus` 实现
  - [x] SubTask 3.4: `src/services/mobile/graphs.ts` 中适配 `getNodes` 的 `includeStatus` 参数和 `batchGetNodeStatus` 方法

- [x] Task 4: 前端 Query 层 — 合并查询与 staleTime 调整
  - [x] SubTask 4.1: 修改 `useGraphData` hook，请求时携带 `includeStatus=true`，返回数据增加 `nodeStatus` 字段
  - [x] SubTask 4.2: 修改 `useGraphNodeStatus` 的 staleTime 从 30_000 改为 60_000
  - [x] SubTask 4.3: 修改 `useBatchGraphStatus`，改用 `api.graphs.batchGetNodeStatus` 单次请求
  - [x] SubTask 4.4: 修改 `useGraphDataWithEmbedding`，同样携带 `includeStatus=true`

- [x] Task 5: 前端页面 — 移除冗余的 useGraphNodeStatus 调用
  - [x] SubTask 5.1: 修改 `GraphEditor.tsx`，从 `useGraphData` 返回值中获取 `nodeStatus`，移除独立的 `useGraphNodeStatus` 调用
  - [x] SubTask 5.2: 修改 `LearningMode.tsx`，从 `useGraphData` 返回值中获取 `nodeStatus`，移除独立的 `useGraphNodeStatus` 调用

- [x] Task 6: 前端 — 乐观 mutation 缓存更新优化
  - [x] SubTask 6.1: 修改 `createOptimisticMutation`，增加 `onSuccess` 回调用服务端响应数据更新缓存（替代乐观数据）
  - [x] SubTask 6.2: 修改 `useGraphMutations.ts` 中各乐观 mutation 的 `onSettled`，移除 `graph_data_changed` 事件发布（改为由 onSuccess 更新缓存）
  - [x] SubTask 6.3: 修改 `FrontendEventSubscribers.ts` 中 `graph_data_changed` 订阅，不再 invalidate `graphData` 查询键
  - [x] SubTask 6.4: 保留非乐观 mutation（如 `useUpdateNodeMutation`、`useDeleteEdgeMutation`）的事件发布行为不变

# Task Dependencies
- Task 3 depends on Task 1, Task 2
- Task 4 depends on Task 3
- Task 5 depends on Task 4
- Task 6 is independent of Task 1-5 (can be done in parallel)
