# AI图谱生成领域属性关联修复 Spec

## Why

当前项目中，领域（Domain）属性是后来新增的功能，支持树形层级结构（通过 `domains` 表和 `graph_domains` 关联表实现）。但在AI生成图谱的过程中，存在以下问题：

1. **无限扩展功能**（`infiniteExpansionProcessor.ts`）创建新图谱时完全没有设置领域属性
2. **批量创建领域图谱**（`batchCreateDomainGraphs`）只设置了旧的 `domain` 字符串字段，没有在 `graph_domains` 表中创建关联
3. **AI Prompt** 没有包含领域上下文信息，无法让AI理解当前领域的层级关系

这导致通过AI生成的图谱无法正确关联到领域体系，影响知识地图的领域筛选和分区展示功能。

## What Changes

### 1. 修复无限扩展处理器（`infiniteExpansionProcessor.ts`）
- 创建图谱时需要传递源图谱的领域信息
- 在 `graph_domains` 表中创建正确的关联
- 利用 `domainContextService` 获取领域上下文，增强AI生成质量

### 2. 修复批量创建领域图谱API（`graphs.ts`）
- 创建图谱后需要在 `graph_domains` 表中创建关联
- 支持领域ID（UUID）而非仅领域名称

### 3. 增强AI Prompt
- `infinite_graph_expansion` prompt 需要包含领域上下文
- AI生成的新图谱建议中应包含领域归属建议

## Impact

- Affected specs: `domain-multi-association-hierarchy`
- Affected code:
  - `api/services/taskProcessors/infiniteExpansionProcessor.ts` — 核心修复点
  - `api/routes/graphs.ts` — 批量创建API修复
  - `api/services/ai/promptService.ts` — Prompt增强
  - `api/services/ai/domainContextService.ts` — 可能需要扩展

## ADDED Requirements

### Requirement: 无限扩展时正确关联领域

系统 SHALL 在无限扩展功能创建新图谱时，正确处理领域属性。

#### Scenario: 从有领域的图谱扩展时，新图谱应继承领域关系

- **WHEN** 用户从属于「机器学习」领域的图谱发起无限扩展
- **AND** AI建议创建「深度学习」作为扩展知识
- **THEN** 新创建的「深度学习」图谱应关联到「机器学习」领域
- **AND** 在 `graph_domains` 表中应创建正确的关联记录

#### Scenario: 扩展时AI应理解领域层级关系

- **WHEN** 用户从属于「计算机科学 > 人工智能」领域的图谱发起无限扩展
- **AND** AI分析相关领域
- **THEN** AI应理解「人工智能」是「计算机科学」的子领域
- **AND** AI建议的新领域应考虑层级关系（如建议父领域或兄弟领域）

#### Scenario: 源图谱无领域时，新图谱不强制设置领域

- **WHEN** 用户从未设置领域的图谱发起无限扩展
- **THEN** 新创建的图谱可以不设置领域
- **OR** AI可以根据图谱内容推荐合适的领域

### Requirement: 批量创建图谱时正确关联领域

系统 SHALL 在批量创建领域图谱时，同时在 `graph_domains` 表中创建关联。

#### Scenario: 批量创建图谱时关联到指定领域

- **WHEN** 用户通过领域图谱生成器批量创建图谱
- **AND** 用户选择了目标领域（如「前端开发」）
- **THEN** 所有新创建的图谱应在 `graph_domains` 表中关联到该领域
- **AND** 第一个图谱应标记为 `is_primary: true`

#### Scenario: 支持通过领域ID关联

- **WHEN** 前端传递领域ID（UUID）而非领域名称
- **THEN** 系统应正确使用领域ID创建关联
- **AND** 同时更新旧的 `domain` 字符串字段以保持向后兼容

### Requirement: AI Prompt包含领域上下文

系统 SHALL 在AI生成图谱时提供领域上下文信息。

#### Scenario: 无限扩展Prompt包含领域上下文

- **WHEN** 调用 `infinite_graph_expansion` prompt
- **AND** 源图谱有领域归属
- **THEN** prompt应包含该领域的已有知识体系上下文
- **AND** AI应能理解领域层级关系

#### Scenario: AI建议包含领域归属

- **WHEN** AI生成新图谱建议
- **THEN** 建议中应包含推荐的领域归属
- **AND** 推荐应基于领域层级关系（如子领域、相关领域）

## MODIFIED Requirements

无

## REMOVED Requirements

无

## 技术方案

### 1. `infiniteExpansionProcessor.ts` 修改

```typescript
// 1. 获取源图谱的领域信息
const { data: sourceGraphDomains } = await supabase
  .from('graph_domains')
  .select('domain_id, domains(id, name, parent_id)')
  .eq('graph_id', source_graph_id);

// 2. 获取领域上下文
if (sourceGraphDomains && sourceGraphDomains.length > 0) {
  const domainContext = await domainContextService.getDomainContext(
    supabase,
    sourceGraphDomains[0].domain_id,
    userId
  );
  // 将 domainContext 传递给 prompt
}

// 3. 创建图谱时设置领域
const { data: newGraph } = await supabase
  .from('knowledge_graphs')
  .insert({
    user_id: userId,
    title: suggestion.title,
    description: suggestion.description || '',
    domain: primaryDomainName, // 设置旧字段
    embedding: embedding ?? undefined,
  })
  .select('id')
  .single();

// 4. 创建 graph_domains 关联
if (newGraph && sourceGraphDomains && sourceGraphDomains.length > 0) {
  await supabase.from('graph_domains').insert({
    graph_id: newGraph.id,
    domain_id: sourceGraphDomains[0].domain_id,
    is_primary: true,
  });
}
```

### 2. `batchCreateDomainGraphs` API 修改

```typescript
// 创建图谱后，同时创建 graph_domains 关联
if (domain) {
  // 先查找或创建领域
  let domainId: string;
  const { data: existingDomain } = await supabase
    .from('domains')
    .select('id')
    .eq('name', domain)
    .eq('user_id', userId)
    .maybeSingle();
  
  if (existingDomain) {
    domainId = existingDomain.id;
  } else {
    // 创建新领域
    const { data: newDomain } = await supabase
      .from('domains')
      .insert({ name: domain, user_id: userId })
      .select('id')
      .single();
    domainId = newDomain.id;
  }
  
  // 创建关联
  await supabase.from('graph_domains').insert({
    graph_id: newGraph.id,
    domain_id: domainId,
    is_primary: true,
  });
}
```

### 3. Prompt 增强

修改 `infinite_graph_expansion` 的 OUTPUT_SCHEMAS，增加领域字段：

```typescript
infinite_graph_expansion: `
Return a JSON object with the following structure:
{
  "prerequisite": [
    { 
      "title": "领域名称", 
      "description": "该领域的简要描述", 
      "reason": "为什么是前置知识",
      "suggested_domain": "建议归属的领域名称（可选）"
    }
  ],
  // ... 其他字段
}
`
```

## 数据迁移

对于已存在的通过AI生成的图谱，需要执行数据迁移：

1. 查找所有 `domain` 字段有值但 `graph_domains` 中没有记录的图谱
2. 根据 `domain` 字段值查找或创建对应的 `domains` 记录
3. 在 `graph_domains` 表中创建关联

迁移脚本可以复用现有的 `migrateGraphDomainIfNeeded` 函数。
