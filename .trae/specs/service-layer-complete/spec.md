# 服务层分离完善 Spec

## Why

当前后端代码仍存在以下问题：
1. **health.ts 直接操作数据库**：约 500 行代码几乎全部直接操作数据库，无服务层封装
2. **knowledgePoints.ts 未充分使用服务层**：已有 `knowledgePointService.ts` 但路由中仍有直接数据库操作
3. **auth.ts 直接操作 users 表**：认证相关操作无服务层封装
4. **dashboard.ts 统计逻辑在路由中**：仪表盘统计直接写在路由层
5. **prompts.ts CRUD 操作直接操作数据库**：`promptService` 仅用于渲染，CRUD 操作直接操作数据库
6. **search.ts 搜索逻辑直接操作数据库**：搜索功能无服务层封装
7. **learningPath.ts 混合使用**：学习路径生成逻辑混合了服务层调用和直接数据库操作
8. **autoGraph.ts 直接操作多个表**：自动图谱生成逻辑直接操作 `graph_nodes`、`knowledge_points`、`edges` 等表

## What Changes

- 创建 `healthService.ts` - 封装健康检查、统计概览
- 创建 `dashboardService.ts` - 封装仪表盘统计数据
- 创建 `authService.ts` - 封装用户认证、资料管理
- 创建 `searchService.ts` - 封装搜索功能
- 扩展 `promptService.ts` - 添加 CRUD 方法
- 重构 `knowledgePoints.ts` - 完全使用服务层
- 重构 `learningPath.ts` - 将数据库操作迁移到服务层
- 重构 `autoGraph.ts` - 创建 `autoGraphService.ts` 或扩展现有服务

## Impact

- Affected specs: service-layer-refactor
- Affected code:
  - `api/routes/health.ts` - 健康检查路由
  - `api/routes/knowledgePoints.ts` - 知识点路由
  - `api/routes/auth.ts` - 认证路由
  - `api/routes/dashboard.ts` - 仪表盘路由
  - `api/routes/prompts.ts` - 提示词模板路由
  - `api/routes/search.ts` - 搜索路由
  - `api/routes/learningPath.ts` - 学习路径路由
  - `api/routes/autoGraph.ts` - 自动图谱路由
  - `api/services/` - 新建/扩展服务层文件

## ADDED Requirements

### Requirement: 健康检查服务层

系统 SHALL 提供 `healthService` 封装健康检查相关数据操作。

#### Scenario: 获取统计概览
- **WHEN** 调用 `healthService.getOverview()`
- **THEN** 返回用户的学习统计概览
- **AND** 包括已掌握节点数、学习中节点数、新节点数

#### Scenario: 获取热力图数据
- **WHEN** 调用 `healthService.getHeatmap()`
- **THEN** 返回知识点掌握度热力图数据
- **AND** 使用 `study_cards` 表的 FSRS 字段计算掌握度

#### Scenario: 获取薄弱知识点
- **WHEN** 调用 `healthService.getWeakPoints()`
- **THEN** 返回掌握度低于阈值的知识点列表
- **AND** 包含复习建议

#### Scenario: 获取预测数据
- **WHEN** 调用 `healthService.getPredictions()`
- **THEN** 返回未来 7 天的复习预测
- **AND** 基于 FSRS 算法计算

### Requirement: 仪表盘服务层

系统 SHALL 提供 `dashboardService` 封装仪表盘统计数据。

#### Scenario: 获取仪表盘数据
- **WHEN** 调用 `dashboardService.getDashboard()`
- **THEN** 返回仪表盘所需的统计数据
- **AND** 使用 `study_cards` 表获取学习进度

### Requirement: 认证服务层

系统 SHALL 提供 `authService` 封装用户认证相关操作。

#### Scenario: 获取用户资料
- **WHEN** 调用 `authService.getProfile()`
- **THEN** 返回用户资料信息

#### Scenario: 更新用户资料
- **WHEN** 调用 `authService.updateProfile()`
- **THEN** 更新用户资料
- **AND** 验证用户权限

### Requirement: 搜索服务层

系统 SHALL 提供 `searchService` 封装搜索功能。

#### Scenario: 关键词搜索
- **WHEN** 调用 `searchService.search()`
- **THEN** 返回匹配的知识点和图谱
- **AND** 支持按类型筛选

#### Scenario: 语义搜索
- **WHEN** 调用 `searchService.semanticSearch()`
- **THEN** 使用向量相似度搜索
- **AND** 返回语义相关的知识点

### Requirement: 提示词模板服务层扩展

系统 SHALL 扩展 `promptService` 提供 CRUD 方法。

#### Scenario: 创建提示词模板
- **WHEN** 调用 `promptService.create()`
- **THEN** 创建新的提示词模板
- **AND** 验证用户权限

#### Scenario: 更新提示词模板
- **WHEN** 调用 `promptService.update()`
- **THEN** 更新提示词模板内容

#### Scenario: 删除提示词模板
- **WHEN** 调用 `promptService.delete()`
- **THEN** 删除提示词模板
- **AND** 验证用户权限

### Requirement: 自动图谱服务层

系统 SHALL 提供 `autoGraphService` 封装自动图谱生成逻辑。

#### Scenario: 创建图谱节点
- **WHEN** 调用 `autoGraphService.createGraphNode()`
- **THEN** 创建知识点并关联到图谱
- **AND** 复用已存在的知识点

#### Scenario: 创建图谱边
- **WHEN** 调用 `autoGraphService.createEdge()`
- **THEN** 使用 `source_knowledge_point_id` 和 `target_knowledge_point_id`
- **AND** 验证知识点在同一图谱中

## MODIFIED Requirements

### Requirement: 路由层职责（完善）

路由层 SHALL 仅负责请求处理和响应，不包含任何直接的数据库操作。

**修改前**：
```typescript
// health.ts 直接操作数据库
const { data: studyCards } = await supabase
  .from('study_cards')
  .select('knowledge_point_id, fsrs_stability, fsrs_difficulty')
  .eq('user_id', userId);
```

**修改后**：
```typescript
// health.ts 调用服务层
const overview = await healthService.getOverview(supabase, userId);
```

### Requirement: 知识点路由完善

`knowledgePoints.ts` SHALL 完全使用 `knowledgePointService`。

**修改前**：
```typescript
// 部分操作直接操作数据库
const { data, error } = await supabase
  .from('knowledge_points')
  .select('*')
  .eq('id', id);
```

**修改后**：
```typescript
// 完全使用服务层
const knowledgePoint = await knowledgePointService.get(supabase, id, userId);
```

## REMOVED Requirements

### Requirement: 路由层直接数据库操作（完善）

**Reason**: 违反单一职责原则，难以测试和复用
**Migration**: 将所有剩余的 Supabase 查询迁移到服务层
