# 服务层重构与架构适配 Spec

## Why

当前后端代码存在以下问题：
1. **数据操作分散**：大量 Supabase 查询直接写在路由层，难以复用和测试
2. **架构未适配**：路由代码仍使用旧的 `nodes` 表概念，需要适配新的 `knowledge_points` + `graph_nodes` 架构
3. **职责不清**：路由层既处理请求响应，又包含业务逻辑

## What Changes

- 创建 `knowledgePointService.ts` 服务层，封装知识点相关数据操作
- 创建 `graphNodeService.ts` 服务层，封装图谱节点相关数据操作
- 创建 `edgeService.ts` 服务层，封装边相关数据操作
- 创建 `studyService.ts` 服务层，封装学习卡片相关数据操作
- 重构路由层，调用服务层方法而非直接操作数据库
- **BREAKING**: API 请求/响应字段名变更（`source_node_id` → `source_knowledge_point_id`）

## Impact

- Affected specs: decouple-knowledge-points
- Affected code:
  - `api/routes/nodes.ts` - 节点路由
  - `api/routes/study.ts` - 学习路由
  - `api/routes/graphs.ts` - 图谱路由
  - `api/services/` - 新建服务层文件
  - `api/schemas/index.ts` - 验证 Schema
  - `src/services/api/` - 前端 API 客户端

## ADDED Requirements

### Requirement: 服务层架构

系统 SHALL 提供清晰的服务层架构，将业务逻辑与路由层分离。

#### Scenario: 服务层职责
- **WHEN** 路由层需要执行数据操作
- **THEN** 路由层调用服务层方法
- **AND** 服务层封装所有 Supabase 查询
- **AND** 服务层返回类型化的结果

#### Scenario: 服务层可测试性
- **WHEN** 需要测试业务逻辑
- **THEN** 服务层可独立于路由层进行单元测试
- **AND** 可 mock Supabase 客户端进行隔离测试

### Requirement: 知识点服务层

系统 SHALL 提供 `knowledgePointService` 封装知识点数据操作。

#### Scenario: 创建知识点
- **WHEN** 调用 `knowledgePointService.create()`
- **THEN** 创建独立的 knowledge_point 记录
- **AND** 自动生成 embedding（如有内容）
- **AND** 返回创建的知识点对象

#### Scenario: 搜索相似知识点
- **WHEN** 调用 `knowledgePointService.searchSimilar()`
- **THEN** 使用向量相似度搜索已有知识点
- **AND** 返回相似度超过阈值的知识点列表

#### Scenario: 知识点可见性过滤
- **WHEN** 查询知识点列表
- **THEN** 仅返回公共知识点和用户自己的私有知识点
- **AND** 不返回其他用户的私有知识点

### Requirement: 图谱节点服务层

系统 SHALL 提供 `graphNodeService` 封装图谱节点数据操作。

#### Scenario: 添加知识点到图谱
- **WHEN** 调用 `graphNodeService.addToGraph()`
- **THEN** 创建 graph_nodes 关联记录
- **AND** 关联记录包含图谱特定属性（位置、层级）
- **AND** 返回完整的节点信息（包含知识点详情）

#### Scenario: 从图谱移除知识点
- **WHEN** 调用 `graphNodeService.removeFromGraph()`
- **THEN** 软删除 graph_nodes 关联记录
- **AND** 删除该图谱中相关的边
- **AND** 知识点本身不被删除

#### Scenario: 批量更新位置
- **WHEN** 调用 `graphNodeService.batchUpdatePositions()`
- **THEN** 更新多个节点在图谱中的位置
- **AND** 使用事务确保原子性

### Requirement: 边服务层

系统 SHALL 提供 `edgeService` 封装边数据操作。

#### Scenario: 创建边
- **WHEN** 调用 `edgeService.create()`
- **THEN** 使用 `source_knowledge_point_id` 和 `target_knowledge_point_id`
- **AND** 验证两个知识点都在同一图谱中
- **AND** 返回创建的边对象

#### Scenario: 删除边
- **WHEN** 调用 `edgeService.delete()`
- **THEN** 软删除边记录
- **AND** 验证用户有权限删除该边

### Requirement: 学习服务层

系统 SHALL 提供 `studyService` 封装学习卡片数据操作。

#### Scenario: 获取学习卡片
- **WHEN** 调用 `studyService.getCards()`
- **THEN** 使用 `knowledge_point_id` 查询卡片
- **AND** 支持按图谱筛选
- **AND** 支持按到期日期筛选

#### Scenario: 创建学习卡片
- **WHEN** 调用 `studyService.createCard()`
- **THEN** 关联到 `knowledge_point_id`
- **AND** 记录 `source_graph_id`

## MODIFIED Requirements

### Requirement: 路由层职责

路由层 SHALL 仅负责请求处理和响应，不包含业务逻辑。

**修改前**：
```typescript
// 路由层直接操作数据库
const { data, error } = await req.supabase
  .from('nodes')
  .insert({ ... });
```

**修改后**：
```typescript
// 路由层调用服务层
const result = await knowledgePointService.create(supabase, {
  title,
  content,
  owner_id: userId
});
```

### Requirement: API 字段名

API 请求/响应 SHALL 使用新的字段名。

**Edge 相关**：
- `source_node_id` → `source_knowledge_point_id`
- `target_node_id` → `target_knowledge_point_id`

**StudyCard 相关**：
- `node_id` → `knowledge_point_id`

## REMOVED Requirements

### Requirement: 路由层直接数据库操作

**Reason**: 违反单一职责原则，难以测试和复用
**Migration**: 将所有 Supabase 查询迁移到服务层
