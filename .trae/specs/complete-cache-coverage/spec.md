# 缓存体系补全 Spec

## Why
当前 cacheService 基础设施完备但使用覆盖严重不足：14 个 CacheKeys 中仅 4 个被 `getOrSet` 实际使用，6 个高频/中频查询（`getGraphNodeStatus`、`getGraphMap`、`getTags`、`getDomains`、`getLiterature`、`searchSimilar`）完全没有缓存。其中 `getGraphNodeStatus` 最为严重——它是图谱编辑器着色的核心数据源，使用短轮询配置（staleTime=0），每次都执行 FSRS 聚合计算却无缓存。

## What Changes
- 为 `getGraphNodeStatus` 添加缓存（最高优先级）
- 为 `getGraphMap` 添加缓存
- 为 `getTags` 添加缓存
- 为 `getDomains` 添加缓存
- 为 `getLiterature` 添加缓存
- 为 `searchSimilar`（向量搜索）添加 embedding hash 缓存
- 新增对应的 CacheKeys 定义
- 为新增缓存添加配套的精细化失效策略（区分结构变更与状态变更）
- 优化 `getGraphNodeStatus` 的前端 staleTime 配置

## Impact
- Affected specs: 无
- Affected code:
  - `api/services/common/cacheService.ts` — CacheKeys 定义 + 失效方法
  - `api/services/graph/graphService.ts` — getGraphNodeStatus 缓存包装
  - `api/services/graph/graphCrudService.ts` — getGraphMap/getTags/getDomains/getLiterature 缓存包装
  - `api/services/graph/knowledgePointService.ts` — searchSimilar 缓存包装
  - `api/utils/similaritySearch.ts` — 向量搜索缓存包装
  - `api/services/core/subscribers/cacheInvalidationSubscriber.ts` — 新增失效事件处理
  - `src/hooks/queries/useGraphQueries.ts` — staleTime 调整

## ADDED Requirements

### Requirement: 热点查询缓存覆盖
系统 SHALL 为以下查询提供缓存：
- `getGraphNodeStatus` — TTL 60s，标签 `graph:${graphId}`, `status`
- `getGraphMap` — TTL 300s，标签 `user:${userId}`, `graphMap`
- `getTags` — TTL 300s，标签 `user:${userId}`, `tags`
- `getDomains` — TTL 300s，标签 `user:${userId}`, `domains`
- `getLiterature` — TTL 300s，标签 `graph:${graphId}`, `literature`
- `searchSimilar` — TTL 300s，标签 `search`，键含 embedding hash

#### Scenario: getGraphNodeStatus 缓存命中
- **WHEN** 同一用户对同一图谱在 60s 内再次请求节点状态
- **THEN** 直接返回缓存数据，不执行 FSRS 聚合计算

#### Scenario: getGraphNodeStatus 缓存失效 — 学习状态变更
- **WHEN** 用户完成一次学习卡片复习
- **THEN** 仅失效该图谱的 `GRAPH_NODE_STATUS` 缓存，不影响图谱结构缓存

#### Scenario: getGraphNodeStatus 缓存失效 — 结构变更
- **WHEN** 用户增删节点或边
- **THEN** 同时失效 `GRAPH_NODES` 和 `GRAPH_NODE_STATUS` 缓存

#### Scenario: getGraphMap 缓存命中
- **WHEN** 同一用户在 300s 内再次请求图谱地图数据
- **THEN** 直接返回缓存数据，不执行 3 次数据库查询

#### Scenario: searchSimilar 缓存命中
- **WHEN** 相同文本的 embedding 在 300s 内再次搜索
- **THEN** 直接返回缓存的搜索结果，不调用 AI API 生成 embedding 和数据库向量搜索

### Requirement: 精细化缓存失效策略
系统 SHALL 区分"结构变更"和"状态变更"的缓存失效范围：
- **结构变更**（增删节点/边、修改图谱元数据）：失效 `GRAPH_NODES` + `GRAPH_NODE_STATUS` + `GRAPH_MAP` + `TAGS` + `DOMAINS` + `LITERATURE`
- **状态变更**（学习进度更新、掌握度变化）：仅失效 `GRAPH_NODE_STATUS`
- **图谱删除/回滚**：仍使用 `invalidateAllGraphRelated` 全量失效

#### Scenario: 节点创建后缓存失效
- **WHEN** 用户创建新节点
- **THEN** 失效该图谱的 GRAPH_NODES、GRAPH_NODE_STATUS、GRAPH_MAP、TAGS、DOMAINS、LITERATURE 缓存
- **AND** 不失效用户其他图谱的缓存

#### Scenario: 学习复习后缓存失效
- **WHEN** 用户完成一次学习卡片复习
- **THEN** 仅失效该图谱的 GRAPH_NODE_STATUS 缓存
- **AND** 保留 GRAPH_NODES、GRAPH_MAP 等结构缓存

### Requirement: 前端 staleTime 优化
系统 SHALL 将 `useGraphNodeStatus` 的 staleTime 从 0 调整为 30s，配合后端缓存减少不必要的请求。

#### Scenario: 图谱编辑器中节点状态刷新
- **WHEN** 用户在图谱编辑器中停留超过 30s
- **THEN** 前端自动重新请求节点状态数据
- **AND** 后端缓存命中直接返回，响应时间 < 10ms

## MODIFIED Requirements
无

## REMOVED Requirements
无
