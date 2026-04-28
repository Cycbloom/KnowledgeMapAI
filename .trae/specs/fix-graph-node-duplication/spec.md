# AI 图谱节点去重 Spec

## Why

在 AI 自动生成图谱节点的过程中，不同层级可能会生成相同名称的节点，导致图谱中出现重复节点。例如，根节点下有"基础概念"，核心节点下也可能生成"基础概念"，造成知识结构混乱和用户困惑。

问题根源：
1. `recursiveGraphProcessor.ts` 和 `utils.ts` 中的节点生成逻辑没有检查图谱中是否已存在同名节点
2. `nodeMap` 只存储当前生成过程中的节点，无法防止跨层级的重复
3. prompt 模板虽然有 `hasExistingChildren` 条件，但调用时未传递已存在的节点信息

## What Changes

- 在节点生成前检查图谱中是否已存在同名节点
- 在 AI prompt 中提供已存在的节点列表，引导 AI 避免生成重复节点
- 如果 AI 仍生成重复节点，在创建时自动跳过或重命名
- 添加节点去重的日志记录，便于调试和监控

## Impact

- Affected specs: 图谱自动生成、图谱扩展
- Affected code:
  - `api/services/taskProcessors/recursiveGraphProcessor.ts` — 递归图谱生成处理器
  - `api/services/taskProcessors/utils.ts` — 节点生成工具函数
  - `api/services/taskProcessors/infiniteExpansionProcessor.ts` — 无限扩展处理器
  - `supabase/migrations/53_seed_prompt_templates.sql` — prompt 模板（可选优化）

---

## ADDED Requirements

### Requirement: 节点名称唯一性检查

系统 SHALL 在创建新节点前检查图谱中是否已存在同名节点。

#### Scenario: 检查同名节点

- **WHEN** AI 生成一个新节点
- **THEN** 系统检查该图谱中是否已存在相同标题的节点
- **AND** 如果存在，跳过创建并记录日志

#### Scenario: 跨层级去重

- **WHEN** AI 在不同层级生成相同名称的节点
- **THEN** 系统只保留第一个创建的节点
- **AND** 后续同名节点被跳过，不创建重复记录

---

### Requirement: Prompt 中提供已存在节点信息

系统 SHALL 在调用 AI 生成节点时，提供图谱中已存在的节点列表。

#### Scenario: 初始化图谱时提供空列表

- **WHEN** 初始化新图谱（无已存在节点）
- **THEN** prompt 中 `existingChildren` 为空数组

#### Scenario: 扩展节点时提供已存在子节点

- **WHEN** 扩展一个已有子节点的节点
- **THEN** prompt 中 `existingChildren` 包含已存在的子节点标题列表
- **AND** AI 被引导生成不同的新节点

#### Scenario: 提供全图谱节点列表

- **WHEN** 在递归生成过程中
- **THEN** prompt 中包含当前图谱所有已存在节点的标题列表
- **AND** AI 被明确要求避免生成重复节点

---

### Requirement: 节点去重日志记录

系统 SHALL 记录节点去重事件，便于调试和监控。

#### Scenario: 记录跳过的重复节点

- **WHEN** 系统跳过一个重复节点
- **THEN** 记录日志：节点标题、父节点、跳过原因
- **AND** 日志级别为 `info` 或 `debug`

---

## MODIFIED Requirements

### Requirement: recursiveGraphProcessor 节点生成逻辑

`api/services/taskProcessors/recursiveGraphProcessor.ts` 需修改：

1. 在生成节点前，查询图谱中已存在的所有节点标题
2. 将已存在节点列表传递给 prompt
3. 在创建节点前检查 `nodeMap` 和数据库中是否已存在同名节点
4. 跳过重复节点并记录日志

#### 修改点

| 位置 | 修改内容 |
|------|----------|
| 第 66 行 | 扩展 `nodeMap` 用途，或新增 `existingNodeTitles` Set |
| 第 68-79 行 | 在 `getAutoGraphPrompt` 调用中传递已存在节点列表 |
| 第 157-183 行 | 核心节点创建前检查重复 |
| 第 293-318 行 | 子节点创建前检查重复 |
| 第 423-448 行 | 叶子节点创建前检查重复 |

### Requirement: utils.ts 节点生成工具函数

`api/services/taskProcessors/utils.ts` 需修改：

1. `generateNodesForGraph` 函数：在生成前查询已存在节点
2. `expandNodeForGraph` 函数：传递已存在子节点信息给 prompt
3. 创建节点前检查重复

#### 修改点

| 位置 | 修改内容 |
|------|----------|
| 第 27-190 行 | `generateNodesForGraph` 添加已存在节点查询和去重逻辑 |
| 第 192-339 行 | `expandNodeForGraph` 添加已存在子节点查询和去重逻辑 |

### Requirement: Prompt 模板优化（可选）

`supabase/migrations/53_seed_prompt_templates.sql` 中的 `auto_graph_expand` 模板可优化：

```sql
-- 当前模板（第 306-309 行）
{{#if hasExistingChildren}}
## Existing Children
The following child nodes already exist: {{existingChildren}}
Generate NEW, DIFFERENT child nodes.
{{/if}}

-- 优化后
{{#if existingNodesInGraph}}
## Existing Nodes in Graph
The following nodes already exist in this graph: {{existingNodesInGraph}}
**IMPORTANT**: Do NOT generate nodes with these titles. Create NEW, UNIQUE nodes.
{{/if}}
```

---

## REMOVED Requirements

无删除的需求。此变更仅为增强去重逻辑，不删除任何功能。
