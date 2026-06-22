# 关键操作事务保障完善 Spec

## Why
当前项目中大量多表/多行操作缺乏事务保障，中途失败会导致数据不一致甚至永久丢失。已有 `transaction-support` spec 完成了图谱删除、节点删除、任务操作等基础事务保障，但版本控制（回滚/分支/合并）、数据导入、自动建图、测验卡片等高风险操作仍未覆盖。此外，已有 RPC 保障的操作在降级路径中仍无事务安全。

## What Changes
- 为图谱版本控制三操作（rollbackToSnapshot、createBranch、applyMerge）添加事务保障
- 修复数据导入的手动回滚缺陷（遗漏 knowledge_points 清理）
- 为自动建图 processAINodes 添加事务保障
- 为测验卡片 regenerateCard 添加事务保障
- 补全节点创建 createNode 的 RPC 调用（已有 `create_knowledge_point_with_node` 函数但未使用）
- 为已有 RPC 操作的降级路径添加 transactionExecutor 兜底
- 为中等风险操作（学习路径、成就系统、Agent 写工具）添加事务保障

## Impact
- Affected code: `api/services/graph/graphVersionService.ts`, `api/services/graph/dataService.ts`, `api/services/graph/autoGraphService.ts`, `api/services/quiz/quizSetsService.ts`, `api/services/graph/nodesService.ts`, `api/services/study/learningPathService.ts`, `api/services/achievements/achievementService.ts`, `api/services/agent/tools/writeTools.ts`, `api/services/ai/aiActionService.ts`, `supabase/migrations/14_functions.sql`
- Affected specs: 扩展 `transaction-support` spec 的覆盖范围，无破坏性变更

## ADDED Requirements

### Requirement: 图谱版本回滚事务安全
系统 SHALL 确保图谱版本回滚操作的原子性，包括创建回滚前快照、软删除当前数据、恢复目标快照数据。

#### Scenario: 回滚成功
- **WHEN** 调用 `rollbackToSnapshot` 回滚到指定快照
- **THEN** pre_rollback 快照创建、当前节点/边软删除、目标快照数据恢复在同一事务中完成

#### Scenario: 回滚失败
- **WHEN** 回滚过程中任一步骤失败
- **THEN** 所有已执行操作回滚，图谱保持回滚前状态

### Requirement: 图谱分支创建事务安全
系统 SHALL 确保分支创建操作的原子性，包括新图谱创建、节点复制、边复制。

#### Scenario: 分支创建成功
- **WHEN** 调用 `createBranch` 创建分支
- **THEN** 新图谱、复制的节点和边在同一事务中创建

#### Scenario: 分支创建失败
- **WHEN** 分支创建过程中任一步骤失败
- **THEN** 所有已创建数据回滚，不产生空壳图谱

### Requirement: 图谱分支合并事务安全
系统 SHALL 确保分支合并操作的原子性，包括变更应用和冲突解决。

#### Scenario: 合并成功
- **WHEN** 调用 `applyMerge` 应用合并结果
- **THEN** 所有变更和冲突解决在同一事务中完成，并自动创建 post_merge 快照

#### Scenario: 合并失败
- **WHEN** 合并过程中任一步骤失败
- **THEN** 所有已应用的变更回滚，主图谱保持合并前状态

### Requirement: 数据导入事务安全
系统 SHALL 确保数据导入操作的原子性，包括图谱、知识点、图谱节点、边的创建。

#### Scenario: 导入成功
- **WHEN** 通过 `/import` 或 `/import/markdown` 导入数据
- **THEN** 所有数据在同一事务中创建

#### Scenario: 导入失败
- **WHEN** 导入过程中任一步骤失败
- **THEN** 所有已创建数据（含 knowledge_points）回滚，不产生孤立数据

### Requirement: 自动建图事务安全
系统 SHALL 确保自动建图 processAINodes 操作的原子性。

#### Scenario: 自动建图成功
- **WHEN** AI 生成的节点批量入库
- **THEN** knowledge_points、graph_nodes、edges 在同一事务中创建

#### Scenario: 自动建图部分失败
- **WHEN** 部分节点创建失败
- **THEN** 整批操作回滚，不产生不完整的图谱结构

### Requirement: 测验卡片重新生成事务安全
系统 SHALL 确保测验卡片重新生成操作的原子性。

#### Scenario: 重新生成成功
- **WHEN** 调用 `regenerateCard` 重新生成测验卡片
- **THEN** 新卡片创建、旧卡片删除、关联更新在同一事务中完成

#### Scenario: 重新生成失败
- **WHEN** 重新生成过程中任一步骤失败
- **THEN** 旧卡片保持不变，不产生重复或丢失

### Requirement: 节点创建使用已有 RPC
系统 SHALL 使用已创建的 `create_knowledge_point_with_node` RPC 函数实现节点原子创建。

#### Scenario: 节点创建成功
- **WHEN** 通过 POST `/nodes` 创建节点
- **THEN** 使用 `create_knowledge_point_with_node` RPC 原子创建知识点和图谱节点

#### Scenario: 节点创建失败
- **WHEN** 创建过程中失败
- **THEN** 不产生孤立知识点

### Requirement: RPC 降级路径事务保障
系统 SHALL 为已有 RPC 操作的降级路径提供 transactionExecutor 兜底。

#### Scenario: RPC 不可用时降级
- **WHEN** RPC 调用失败退化为顺序操作
- **THEN** 顺序操作使用 transactionExecutor 包裹，确保降级路径也有事务保障

### Requirement: 学习路径操作事务安全
系统 SHALL 确保学习路径关键操作（创建路径、更新节点状态、自动调度）的原子性。

#### Scenario: 创建学习路径成功
- **WHEN** 创建学习路径并添加节点
- **THEN** 路径和节点在同一事务中创建

#### Scenario: 更新节点状态成功
- **WHEN** 更新学习路径节点状态
- **THEN** 节点状态更新、进度记录、路径完成检查在同一事务中完成

### Requirement: 成就解锁事务安全
系统 SHALL 确保成就解锁和 XP 奖励的原子性。

#### Scenario: 成就解锁成功
- **WHEN** 解锁成就并增加 XP
- **THEN** 成就记录和 XP 更新在同一事务中完成

### Requirement: Agent 写工具事务安全
系统 SHALL 确保 Agent 写操作（创建节点、生成子节点）的原子性。

#### Scenario: Agent 创建节点成功
- **WHEN** Agent 通过 create_node 工具创建节点
- **THEN** 知识点和图谱节点原子创建，失败时不产生孤立数据

## MODIFIED Requirements

### Requirement: SupabaseAdapter.transaction()
原空壳实现已替换为基于 pg 直连的真正事务实现。当 pg 不可用时降级为顺序执行并记录 warn 日志。（已在 transaction-support spec 中完成，无需修改）

### Requirement: 数据导入回滚
原手动回滚逻辑 SHALL 替换为事务执行器或 RPC，确保 knowledge_points 也被正确回滚。
