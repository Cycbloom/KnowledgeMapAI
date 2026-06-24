# Tasks

- [x] Task 1: 扩展 rpcFallback.ts，新增 withThreeLevelFallback 工具函数
  - [x] SubTask 1.1: 定义 `ThreeLevelFallbackOptions<T>` 接口
  - [x] SubTask 1.2: 实现 `withThreeLevelFallback<T>` 函数
  - [x] SubTask 1.3: 每级降级时记录 warn 日志

- [x] Task 2: 重构 graphNodeService.ts 的 2 个三级降级方法
  - [x] SubTask 2.1: `removeFromGraph` 使用 `withThreeLevelFallback`
  - [x] SubTask 2.2: `batchDelete` 使用 `withThreeLevelFallback`

- [x] Task 3: 重构 graphService.ts 的 4 个降级方法
  - [x] SubTask 3.1: `deleteGraph` 使用 `withThreeLevelFallback`（三级降级）
  - [x] SubTask 3.2: `deleteGraphs` 使用 `withThreeLevelFallback`（二级降级，无 txFn）
  - [x] SubTask 3.3: `permanentDeleteGraph` 使用 `withThreeLevelFallback`（二级降级，无 txFn）
  - [x] SubTask 3.4: `permanentDeleteGraphs` 使用 `withThreeLevelFallback`（二级降级，无 txFn）

- [x] Task 4: 重构 nodesService.ts 的 2 个降级方法
  - [x] SubTask 4.1: `batchUpdatePositions` 使用 `withThreeLevelFallback`（二级降级）
  - [x] SubTask 4.2: `batchUpdateNodes` 使用 `withThreeLevelFallback`（事务→非事务降级），提取 `executeBatchUpdateFallback` 私有方法消除重复

- [x] Task 5: 类型检查验证
  - [x] SubTask 5.1: `npx tsc --noEmit` 零错误通过
  - [x] SubTask 5.2: 降级行为不变

# Task Dependencies
- [Task 2, Task 3, Task 4] depend on [Task 1]
- [Task 5] depends on [Task 2, Task 3, Task 4]
