# 路由层业务逻辑下沉（第二轮）Spec

## Why
第一轮重构已解决 `domains.ts` 和 `graphs/crud.ts` 的领域关联泄漏，但路由层仍有 39 个文件 313 次直接数据库调用。本轮聚焦第一梯队（极严重）的 3 个文件：`literature.ts`（814 行内联逻辑）、`graphs/expansion.ts`（600 行内联逻辑）、`backup.ts`（436 行 restore 函数 + 级联删除重复），合计约 1850 行业务逻辑滞留在路由层。

## What Changes
- **新增** `api/services/literature/literatureApplyService.ts` — 文献应用服务（从 `literature.ts` POST /apply 提取）
- **新增** `api/services/graph/domainExpansionService.ts` — 领域扩展服务（从 `graphs/expansion.ts` 提取）
- **修改** `api/services/common/backupService.ts` — 扩展恢复和级联删除逻辑（从 `backup.ts` 提取）
- **修改** `api/routes/literature.ts` — POST /apply 改为调用 literatureApplyService
- **修改** `api/routes/graphs/expansion.ts` — POST /domain/expand 和 /domain/batch-create 改为调用 domainExpansionService
- **修改** `api/routes/backup.ts` — restore/import 改为调用 backupService

## Impact
- Affected specs: 无破坏性变更，所有 API 接口保持不变
- Affected code:
  - `api/routes/literature.ts`（大幅精简 POST /apply）
  - `api/routes/graphs/expansion.ts`（精简 domain expand + batch-create）
  - `api/routes/backup.ts`（精简 restore + import）
  - `api/services/literature/literatureApplyService.ts`（新增）
  - `api/services/graph/domainExpansionService.ts`（新增）
  - `api/services/common/backupService.ts`（扩展）

## ADDED Requirements

### Requirement: 文献应用服务（literatureApplyService）
系统 SHALL 提供 `literatureApplyService` 封装文献提取结果应用到图谱的完整业务逻辑，包括去重、合并、挂载、属性更新。

#### Scenario: 应用文献提取结果
- **WHEN** 调用 `literatureApplyService.applyLiterature(supabase, userId, graphId, concepts, options)`
- **THEN** 执行完整的文献应用流程：查询已有节点 → 标题去重 → embedding 生成 → 相似度搜索 → 概念合并/升级 → 节点创建 → 骨干模块匹配 → 属性更新 → 边创建 → 参考文献更新 → literature_sources 保存

#### Scenario: 概念去重与合并
- **WHEN** 新概念与已有知识点标题匹配或 embedding 相似度超过阈值
- **THEN** 执行合并逻辑（升级已有节点属性而非创建重复节点）

### Requirement: 领域扩展服务（domainExpansionService）
系统 SHALL 提供 `domainExpansionService` 封装基于领域的图谱扩展业务逻辑。

#### Scenario: 领域扩展推荐
- **WHEN** 调用 `domainExpansionService.expandDomain(supabase, userId, options)`
- **THEN** 查询图谱 → 获取领域上下文 → 构建 AI prompt → 调用 AI → 解析推荐 → 过滤/排序 → 返回推荐列表

#### Scenario: 批量创建领域图谱
- **WHEN** 调用 `domainExpansionService.batchCreateDomainGraphs(supabase, userId, data)`
- **THEN** 解析领域 → 查询/创建领域 → 去重检查 → 创建图谱 → 创建关联 → 创建关系 → 返回结果（含错误分类）

### Requirement: 备份恢复服务扩展
系统 SHALL 扩展 `backupService` 添加恢复和级联删除能力。

#### Scenario: 恢复备份数据
- **WHEN** 调用 `backupService.restoreBackupData(supabase, userId, backupData)`
- **THEN** 执行 ID 映射 → 9 张表按序插入 → 失败时补偿回滚

#### Scenario: 级联删除图谱数据
- **WHEN** 调用 `backupService.cascadeDeleteGraph(supabase, graphId)`
- **THEN** 按 knowledge_graphs → graph_backbone_modules → study_cards → study_progress → edges → graph_nodes 顺序级联删除

#### Scenario: 消除重复代码
- **WHEN** restore 和 import 路由都需要级联删除
- **THEN** 两者都调用同一个 `backupService.cascadeDeleteGraph()` 方法，不再重复实现

## MODIFIED Requirements

### Requirement: literature.ts POST /apply 路由
原路由内 814 行业务逻辑修改为调用 `literatureApplyService.applyLiterature()`。

### Requirement: graphs/expansion.ts POST /domain/expand 路由
原路由内 267 行业务逻辑修改为调用 `domainExpansionService.expandDomain()`。

### Requirement: graphs/expansion.ts POST /domain/batch-create 路由
原路由内 332 行业务逻辑修改为调用 `domainExpansionService.batchCreateDomainGraphs()`。

### Requirement: backup.ts POST /restore/:id 和 POST /import 路由
原路由内级联删除逻辑和 restoreBackupData 函数修改为调用 `backupService.restoreBackupData()` 和 `backupService.cascadeDeleteGraph()`。

## REMOVED Requirements

无。所有 API 行为保持不变。
