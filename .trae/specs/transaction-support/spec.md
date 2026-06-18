# 事务支持实现 Spec

## Why
当前 Supabase Adapter 的 `transaction()` 是空壳实现（仅顺序执行函数），多表操作（图谱删除、节点创建/删除、数据导入等）不具备原子性，存在数据丢失和不一致风险。已有 `pg.Pool` 基础设施和部分 RPC 事务函数可复用。

## What Changes
- 实现基于 `pg` 直连的真正事务执行器，作为 `SupabaseAdapter.transaction()` 的底层实现
- 将关键多表操作迁移到 PostgreSQL RPC 函数（优先）或 pg 事务（次选）
- 修复 `SupabaseAdapter.transaction()` 空壳实现
- 为 P0 级操作创建新的 PostgreSQL 事务函数

## Impact
- Affected code: `api/database/adapters/supabase.ts`, `api/services/graph/graphService.ts`, `api/services/graph/graphNodeService.ts`, `api/routes/data.ts`, `api/routes/nodes.ts`, `api/services/scheduler/taskService.ts`, `supabase/migrations/14_functions.sql`
- Affected specs: 无破坏性变更，所有 API 接口保持不变

## ADDED Requirements

### Requirement: 真正的事务执行器
系统 SHALL 提供基于 `pg` 直连的真正事务执行器，支持 `BEGIN/COMMIT/ROLLBACK` 语义。

#### Scenario: 事务成功提交
- **WHEN** 在事务中执行多个数据库操作且全部成功
- **THEN** 所有操作原子性提交

#### Scenario: 事务失败回滚
- **WHEN** 在事务中执行多个数据库操作且任一操作抛出异常
- **THEN** 所有已执行操作自动回滚

#### Scenario: pg 连接不可用时降级
- **WHEN** pg 连接不可用或未配置
- **THEN** 降级为当前的非事务顺序执行模式，并记录 warn 日志

### Requirement: 图谱删除事务安全
系统 SHALL 确保图谱永久删除操作的原子性，包括主图谱、分支图谱及所有级联数据的删除。

#### Scenario: 永久删除图谱成功
- **WHEN** 调用 `permanentDeleteGraph` 删除图谱
- **THEN** 主图谱、分支图谱及所有级联数据（graph_nodes, edges, study_cards 等）在同一事务中删除

#### Scenario: 永久删除图谱失败
- **WHEN** 删除过程中任一步骤失败
- **THEN** 所有已删除数据回滚，图谱保持完整

#### Scenario: 批量永久删除图谱
- **WHEN** 调用 `permanentDeleteGraphs` 批量删除
- **THEN** 所有图谱及其分支、级联数据在同一事务中原子性删除

### Requirement: 图谱软删除事务安全
系统 SHALL 确保图谱软删除（含分支）操作的原子性。

#### Scenario: 软删除图谱含分支成功
- **WHEN** 调用 `deleteGraph` 软删除含有分支的图谱
- **THEN** 主图谱和所有分支的 `deleted_at` 在同一事务中更新

#### Scenario: 批量软删除图谱
- **WHEN** 调用 `deleteGraphs` 批量软删除
- **THEN** 所有图谱及其分支的软删除在同一事务中完成

### Requirement: 节点操作事务安全
系统 SHALL 确保节点创建和删除操作的多表一致性。

#### Scenario: 创建节点（知识点+图谱节点）成功
- **WHEN** 创建节点时知识点和图谱节点同时创建
- **THEN** 两者在同一事务中创建，任一失败则全部回滚

#### Scenario: 删除节点级联删除边
- **WHEN** 从图谱移除节点时关联边也需要删除
- **THEN** 边的软删除和节点的软删除在同一事务中完成

#### Scenario: 批量删除节点
- **WHEN** 批量删除节点时
- **THEN** 所有关联边的删除和节点的删除在同一事务中完成

### Requirement: 数据导入事务安全
系统 SHALL 确保数据导入操作的原子性。

#### Scenario: 导入数据成功
- **WHEN** 通过 `/import` 或 `/import/markdown` 导入数据
- **THEN** 图谱、知识点、图谱节点、边的创建在同一事务中完成

#### Scenario: 导入数据失败
- **WHEN** 导入过程中任一步骤失败
- **THEN** 所有已创建数据回滚，不产生孤立数据

### Requirement: 任务操作事务安全
系统 SHALL 确保任务状态变更和执行记录的原子性。

#### Scenario: 启动任务
- **WHEN** 调用 `startTask` 启动任务
- **THEN** 任务状态更新和执行记录创建在同一事务中完成

#### Scenario: 完成任务
- **WHEN** 调用 `completeTask` 完成任务
- **THEN** 执行记录更新和任务状态更新在同一事务中完成

#### Scenario: 任务重排序
- **WHEN** 调用 `reorderTasks` 重排序任务
- **THEN** 所有任务的 position 更新在同一事务中完成

### Requirement: 数据重置事务安全
系统 SHALL 确保数据重置操作的原子性。

#### Scenario: 重置数据成功
- **WHEN** 调用 `/reset` 重置用户数据
- **THEN** 所有表的清理在同一事务中完成

#### Scenario: 重置数据失败
- **WHEN** 重置过程中任一步骤失败
- **THEN** 所有已删除数据回滚，系统保持一致状态

## MODIFIED Requirements

### Requirement: SupabaseAdapter.transaction()
原空壳实现 SHALL 替换为基于 pg 直连的真正事务实现。当 pg 不可用时降级为顺序执行并记录 warn 日志。
