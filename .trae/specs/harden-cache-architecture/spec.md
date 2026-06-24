# 缓存架构短期加固 Spec

## Why
cacheService 存在 3 个实际问题：`getOrSet` 不缓存 falsy 值（0/false/空数组/空字符串/null 被跳过），`delByPrefix` 全量扫描 keys 性能差，NodeCache 无容量限制导致内存可无限增长。

## What Changes
- 修复 `getOrSet` 的 falsy 值缓存 bug（`if (cached)` → `if (cached !== undefined)`）
- 为 NodeCache 添加 `maxKeys` 容量限制（LRU 淘汰）
- 将 `delByPrefix` 的 2 处生产调用改为标签索引方式，然后废弃 `delByPrefix` 方法

## Impact
- Affected code: `api/services/common/cacheService.ts`、`api/routes/templates.ts`、`api/services/core/subscribers/cacheInvalidationSubscriber.ts`
- Affected tests: `api/__tests__/services/cache.test.ts`
- 无破坏性变更，`delByPrefix` 保留但标记为 deprecated

## ADDED Requirements

### Requirement: getOrSet 正确缓存 falsy 值
`getOrSet` SHALL 正确缓存和返回 falsy 值（0、false、空字符串、空数组、空对象、null）。

#### Scenario: 缓存空数组
- **WHEN** `getOrSet` 的 `fetchFn` 返回 `[]`
- **THEN** 后续调用 `getOrSet` 同一 key 直接返回 `[]`，不再调用 `fetchFn`

#### Scenario: 缓存数值 0
- **WHEN** `getOrSet` 的 `fetchFn` 返回 `0`
- **THEN** 后续调用 `getOrSet` 同一 key 直接返回 `0`，不再调用 `fetchFn`

### Requirement: 缓存容量限制
cacheService SHALL 设置最大 key 数量限制，超出时自动淘汰最久未使用的条目。

#### Scenario: 缓存条目超过上限
- **WHEN** 缓存中的 key 数量达到 maxKeys
- **THEN** 新写入的 key 导致最久未访问的 key 被淘汰

### Requirement: delByPrefix 废弃
`delByPrefix` SHALL 标记为 deprecated，生产代码改用标签索引方式删除。

#### Scenario: 按前缀删除 graph_literature 缓存
- **WHEN** 调用 `invalidateStructureCache` 需要删除 `graph_literature_{graphId}` 前缀的缓存
- **THEN** 通过标签索引（`graph:{graphId}`）删除，而非全量扫描 keys

## MODIFIED Requirements

### Requirement: getOrSet 缓存判断
`getOrSet` 使用 `cached !== undefined` 判断缓存命中，而非 `if (cached)` 真值判断。

### Requirement: NodeCache 初始化配置
NodeCache 初始化时添加 `maxKeys` 参数，默认值 1000。
