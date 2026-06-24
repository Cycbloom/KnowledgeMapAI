# 重构三级降级模式减少代码重复 Spec

## Why

graphService/graphNodeService/nodesService 中存在 8 处 RPC→事务→非事务三级降级模式，每处都重复 try/catch 结构、降级日志和 TransactionExecutor 可用性检查。graphNodeService 的 removeFromGraph/batchDelete 和 graphService 的 deleteGraphs/permanentDeleteGraphs 的非事务 fallback 代码几乎完全相同。已有 `withRpcFallback` 工具仅支持二级降级，无法覆盖三级场景。

## What Changes

- 扩展 `rpcFallback.ts`，新增 `withThreeLevelFallback<T>` 工具函数，封装 RPC→事务→非事务三级降级的 try/catch 样板
- 重构 `graphService.ts` 中 4 个降级方法使用新工具
- 重构 `graphNodeService.ts` 中 2 个完整三级降级方法使用新工具
- 重构 `nodesService.ts` 中 2 个二级降级方法使用 `withRpcFallback` 或新工具

## Impact

- Affected code:
  - `api/utils/rpcFallback.ts` — 新增 `withThreeLevelFallback` 函数
  - `api/services/graph/graphService.ts` — 4 个方法重构
  - `api/services/graph/graphNodeService.ts` — 2 个方法重构
  - `api/services/graph/nodesService.ts` — 2 个方法重构

## ADDED Requirements

### Requirement: withThreeLevelFallback 工具函数

系统 SHALL 提供 `withThreeLevelFallback<T>` 工具函数，封装 RPC→事务→非事务三级降级的完整 try/catch 样板。

#### Scenario: RPC 成功
- **WHEN** RPC 调用成功
- **THEN** 直接返回 RPC 结果，不执行事务和非事务 fallback

#### Scenario: RPC 失败、事务成功
- **WHEN** RPC 调用失败且 TransactionExecutor 可用
- **THEN** 执行事务 fallback，成功则返回结果

#### Scenario: RPC 失败、事务失败或不可用
- **WHEN** RPC 调用失败且事务也失败或 TransactionExecutor 不可用
- **THEN** 执行非事务 fallback，记录降级原因日志

#### Scenario: 降级日志
- **WHEN** 发生降级
- **THEN** SHALL 记录 warn 级别日志，包含降级原因（RPC 错误/事务错误/事务不可用）

## MODIFIED Requirements

### Requirement: graphService 降级方法

graphService 的 deleteGraph、deleteGraphs、permanentDeleteGraph、permanentDeleteGraphs SHALL 使用 `withThreeLevelFallback` 或 `withRpcFallback` 替代内联 try/catch 降级逻辑。

### Requirement: graphNodeService 降级方法

graphNodeService 的 removeFromGraph、batchDelete SHALL 使用 `withThreeLevelFallback` 替代内联 try/catch 降级逻辑。

### Requirement: nodesService 降级方法

nodesService 的 batchUpdatePositions、batchUpdateNodes SHALL 使用 `withRpcFallback` 或 `withThreeLevelFallback` 替代内联 try/catch 降级逻辑。

## REMOVED Requirements

（无移除）
