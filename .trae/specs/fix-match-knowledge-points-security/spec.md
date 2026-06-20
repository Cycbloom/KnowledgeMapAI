# 修复 match_knowledge_points 函数签名冲突与数据越权 Spec

## Why
`match_knowledge_points` 存在两个签名冲突的数据库函数版本，其中 3 参数版本缺少用户权限过滤，可返回所有用户的知识点数据，构成数据越权安全漏洞。同时，后端有 3 处代码正在调用这个不安全的版本。

## What Changes
- 删除 `21_pgvector_search.sql` 中无 `p_user_id` 参数的 3 参数版 `match_knowledge_points` 函数
- 修改 `14_functions.sql` 中 4 参数版函数，增加 `match_threshold` 和 `match_count` 的默认值以保持向后兼容
- 修改 3 处后端调用（autoGraphService、conceptAggregationService、literatureApplyService），补充 `p_user_id` 参数
- 清理 `16_grants.sql` 中对已删除函数的 GRANT 语句
- 保留 `21_pgvector_search.sql` 中的 IVFFlat 索引创建逻辑（与函数无关）

## Impact
- Affected specs: 无
- Affected code:
  - `supabase/migrations/14_functions.sql` — 修改函数签名增加默认值
  - `supabase/migrations/21_pgvector_search.sql` — 删除不安全函数
  - `supabase/migrations/16_grants.sql` — 清理 GRANT
  - `api/services/graph/autoGraphService.ts` — 补充 p_user_id
  - `api/services/graph/conceptAggregationService.ts` — 补充 p_user_id
  - `api/services/literature/literatureApplyService.ts` — 补充 p_user_id

## ADDED Requirements

### Requirement: 统一安全的 match_knowledge_points 函数
系统 SHALL 仅保留一个 `match_knowledge_points` 函数版本，该版本 MUST 包含 `p_user_id` 参数并执行 `(visibility = 'public' OR owner_id = p_user_id)` 过滤，确保用户只能检索到自己或公开的知识点。

#### Scenario: 3 参数调用兼容
- **WHEN** 调用 `match_knowledge_points(query_embedding, match_threshold, match_count)` 不传 p_user_id
- **THEN** 函数使用默认参数值正常执行，但 p_user_id 默认为 NULL，仅返回 visibility='public' 的知识点

#### Scenario: 4 参数调用带用户过滤
- **WHEN** 调用 `match_knowledge_points(query_embedding, match_threshold, match_count, p_user_id)` 传入用户 ID
- **THEN** 函数返回该用户拥有的或公开的知识点

### Requirement: 后端调用必须传递用户 ID
所有后端对 `match_knowledge_points` 的 RPC 调用 MUST 传递当前请求用户的 ID 作为 `p_user_id` 参数，禁止使用无用户过滤的调用方式。

#### Scenario: autoGraphService 调用
- **WHEN** autoGraphService 执行知识合并搜索
- **THEN** 传递当前用户 ID，仅匹配该用户可见的知识点

#### Scenario: conceptAggregationService 调用
- **WHEN** conceptAggregationService 查找相似概念
- **THEN** 传递当前用户 ID，仅匹配该用户可见的知识点

#### Scenario: literatureApplyService 调用
- **WHEN** literatureApplyService 查找文献匹配的知识点
- **THEN** 传递当前用户 ID，仅匹配该用户可见的知识点

## MODIFIED Requirements

### Requirement: match_knowledge_points 函数签名
4 参数版函数增加 `match_threshold` 和 `match_count` 的默认值：
- `match_threshold float DEFAULT 0.85`
- `match_count int DEFAULT 10`
- `p_user_id uuid DEFAULT NULL`

当 `p_user_id` 为 NULL 时，仅返回 `visibility = 'public'` 的记录。

## REMOVED Requirements

### Requirement: 无权限过滤的 3 参数版 match_knowledge_points
**Reason**: 该函数缺少用户权限过滤，构成数据越权安全漏洞
**Migration**: 所有调用迁移到 4 参数版（含 p_user_id），函数参数有默认值保证向后兼容

### Requirement: 对 anon 角色的 GRANT 权限
**Reason**: 匹配函数不应暴露给匿名用户，仅 authenticated 角色可调用
**Migration**: 删除 `GRANT EXECUTE ON FUNCTION match_knowledge_points(vector, float, int) TO anon;`
