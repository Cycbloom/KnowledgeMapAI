# 图谱节点分页加载评估 Spec

## Why
评估 `getGraphNodes` 全量加载是否需要分页优化。经分析，当前架构对知识图谱场景已有充分缓解措施，分页优化的收益不足以支撑其极高的实施复杂度。

## What Changes
- 不实施分页加载，但增加数据量监控能力
- 为 `includeEmbedding` 路径添加缓存支持（当前跳过缓存是更大的性能问题）

## Impact
- Affected code: `api/services/graph/graphService.ts`
- 无破坏性变更

## ADDED Requirements

### Requirement: includeEmbedding 路径缓存支持
`getGraphNodes` 的 `includeEmbedding` 路径 SHALL 支持缓存（使用独立缓存键和较短 TTL），避免每次语义布局/AI 操作都全量查询数据库。

#### Scenario: 语义布局二次加载
- **WHEN** 用户在短时间内两次打开语义布局视图
- **THEN** 第二次从缓存获取数据，不重新查询数据库

### Requirement: 图谱节点数量日志
`getGraphNodes` SHALL 记录返回的节点和边数量，用于监控大图谱场景。

#### Scenario: 大图谱加载
- **WHEN** `getGraphNodes` 返回超过 500 个节点
- **THEN** 记录 warn 级别日志，包含节点数和图谱 ID

## REMOVED Requirements

### Requirement: 图谱节点分页加载
**Reason**: 图谱是图结构（节点+边），分页节点后边不完整导致图谱显示断裂。前端空间虚拟化（useSpatialGrid）需要所有节点坐标才能计算视口。当前知识图谱场景（百级节点）已有缓存+渲染虚拟化双重缓解，分页收益不足以支撑其极高复杂度。
**Migration**: 保持现有全量加载+缓存架构，通过 includeEmbedding 缓存和监控日志进行渐进优化。
