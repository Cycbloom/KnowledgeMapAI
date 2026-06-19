# 路由层业务逻辑下沉 Spec

## Why
路由层存在严重的业务逻辑泄漏：40 个路由文件中有 340 次直接数据库调用（`.from()`），最严重的 `domains.ts`（558 行）完全没有 service 层，所有 CRUD + AI 逻辑全在路由文件中。这导致代码无法复用、无法单元测试、职责不清。本 spec 聚焦最严重的 3 个路由文件，将业务逻辑下沉到 service 层。

## What Changes
- **新增** `api/services/graph/domainService.ts` — 领域服务（从 `domains.ts` 提取）
- **新增** `api/services/graph/graphDomainService.ts` — 图谱-领域关联服务（从 `graphs/crud.ts` 提取）
- **修改** `api/routes/domains.ts` — 路由层仅保留参数校验 + 调用 service + 格式化响应
- **修改** `api/routes/graphs/crud.ts` — 移除 `migrateGraphDomainIfNeeded`、`getGraphDomains`、`updateGraphDomains` 及路由内直接 DB 操作，改为调用 service
- **修改** `api/routes/graphs/expansion.ts` — 将路由内的图谱创建+领域关联+关系创建逻辑提取到 service

## Impact
- Affected specs: 无破坏性变更，所有 API 接口保持不变
- Affected code:
  - `api/routes/domains.ts`（大幅精简）
  - `api/routes/graphs/crud.ts`（精简，移除 3 个辅助函数 + 多个路由内 DB 操作）
  - `api/routes/graphs/expansion.ts`（精简，移除路由内业务逻辑）
  - `api/services/graph/domainService.ts`（新增）
  - `api/services/graph/graphDomainService.ts`（新增）
  - `api/services/graph/index.ts`（新增导出）

## ADDED Requirements

### Requirement: 领域服务（domainService）
系统 SHALL 提供 `domainService` 封装所有领域相关的业务逻辑，包括 CRUD、树构建、排序、循环检测、AI 颜色生成和 AI 推荐。

#### Scenario: 列出领域树
- **WHEN** 调用 `domainService.listDomainsTree(supabase, userId)`
- **THEN** 返回包含"未分类"领域的完整树结构，自动创建缺失的"未分类"领域

#### Scenario: 获取领域详情
- **WHEN** 调用 `domainService.getDomain(supabase, id, userId)`
- **THEN** 返回领域详情含图谱数量和子领域列表，校验访问权限

#### Scenario: 创建领域
- **WHEN** 调用 `domainService.createDomain(supabase, userId, data)`
- **THEN** 校验父领域存在性和权限后创建领域，重复名称返回 409 错误

#### Scenario: 更新领域
- **WHEN** 调用 `domainService.updateDomain(supabase, id, userId, data)`
- **THEN** 校验所有者权限、系统领域不可修改、父领域有效性后更新

#### Scenario: 删除领域
- **WHEN** 调用 `domainService.deleteDomain(supabase, id, userId)`
- **THEN** 校验所有者权限和系统领域不可删除后软删除

#### Scenario: 重排序领域
- **WHEN** 调用 `domainService.reorderDomains(supabase, userId, items)`
- **THEN** 校验领域存在性、权限、循环引用后批量更新排序

#### Scenario: AI 生成颜色
- **WHEN** 调用 `domainService.generateColor(supabase, userId, name, description)`
- **THEN** 调用 AI 生成领域颜色，AI 不可用时返回默认颜色

#### Scenario: AI 推荐领域
- **WHEN** 调用 `domainService.recommendDomains(supabase, userId, title, description)`
- **THEN** 获取用户领域列表后调用 AI 推荐，返回匹配的领域列表

### Requirement: 图谱-领域关联服务（graphDomainService）
系统 SHALL 提供 `graphDomainService` 封装图谱与领域关联的业务逻辑。

#### Scenario: 懒迁移图谱领域
- **WHEN** 调用 `graphDomainService.migrateGraphDomainIfNeeded(supabase, graphId, userId)`
- **THEN** 检查图谱的 `domain` 字段，如 `graph_domains` 表无对应记录则自动迁移

#### Scenario: 获取图谱领域
- **WHEN** 调用 `graphDomainService.getGraphDomains(supabase, graphId)`
- **THEN** 返回图谱关联的领域列表（含领域详情和 is_primary 标记）

#### Scenario: 更新图谱领域
- **WHEN** 调用 `graphDomainService.updateGraphDomains(supabase, graphId, domains)`
- **THEN** 规范化 is_primary 后先删除旧关联再插入新关联

#### Scenario: 按领域筛选图谱
- **WHEN** 调用 `graphDomainService.listGraphsByDomains(supabase, userId, domainIds)`
- **THEN** 返回属于指定领域的图谱列表（含节点数量）

### Requirement: 路由层职责约束
路由层 SHALL 仅负责参数校验、调用 service、格式化响应，不直接操作数据库。

#### Scenario: domains.ts 路由精简
- **WHEN** 查看 `api/routes/domains.ts`
- **THEN** 所有路由处理器仅包含参数提取 → service 调用 → 响应格式化，无直接 `.from()` 调用

#### Scenario: graphs/crud.ts 路由精简
- **WHEN** 查看 `api/routes/graphs/crud.ts`
- **THEN** 无 `migrateGraphDomainIfNeeded`、`getGraphDomains`、`updateGraphDomains` 辅助函数，无路由内直接 DB 操作

## MODIFIED Requirements

### Requirement: graphs/crud.ts GET / 路由
原路由内直接操作数据库按领域筛选图谱，修改为调用 `graphDomainService.listGraphsByDomains()`。

### Requirement: graphs/crud.ts GET /:id 路由
原路由内调用 `migrateGraphDomainIfNeeded` 和 `getGraphDomains` 辅助函数，修改为调用 `graphDomainService.migrateGraphDomainIfNeeded()` 和 `graphDomainService.getGraphDomains()`。

### Requirement: graphs/crud.ts POST / 和 PUT /:id 路由
原路由内调用 `updateGraphDomains` 辅助函数，修改为调用 `graphDomainService.updateGraphDomains()`。

## REMOVED Requirements

无。所有 API 行为保持不变，仅内部实现从路由层移至 service 层。
