# 移除 AI 提示词中的 ID 字段

## Why

在智能关系分析和其他 AI 功能中，`graph_id`、`node_id` 等 ID 字段被发送给 AI，但这些 ID 对 AI 来说没有实际意义，只是无意义的 UUID 字符串。应该只发送标题，然后本地软件用标题来匹配对应的 ID。

## What Changes

### 1. 代码层面 - 移除发送给 AI 的 ID

- **`learningPaths.ts` 和 `learningPath.ts`**：`nodesInfo` 和 `edgesInfo` 中移除 ID 字段
- **`promptService.ts`**：修改 `recommend_connections` 和 `learning_path_generate` 的 OUTPUT_SCHEMA
- **其他可能存在类似问题的文件**

### 2. 数据库层面 - 更新云端 prompt 模板

- 云端数据库中的 `prompt_templates` 表存储了系统级模板
- 需要更新或删除这些模板，让代码中的默认模板生效
- **BREAKING**：需要手动在 Supabase Dashboard 执行 SQL

## Impact

- Affected code: 
  - `api/routes/learningPaths.ts`
  - `api/routes/learningPath.ts`
  - `api/services/ai/promptService.ts`
- Affected database: `prompt_templates` 表中的系统模板

## ADDED Requirements

### Requirement: AI 提示词不应包含无意义的 ID

系统 SHALL 在发送给 AI 的提示词中只包含有意义的信息（如标题、描述），而不包含 UUID 等 ID 字段。

#### Scenario: 学习路径生成
- **WHEN** 用户请求生成学习路径
- **THEN** 发送给 AI 的节点信息只包含标题、等级、掌握度，不包含节点 ID
- **AND** 边信息只包含源节点标题和目标节点标题，不包含 ID
- **AND** AI 返回节点标题，本地用标题匹配对应的 ID

#### Scenario: 智能关系分析
- **WHEN** 用户请求智能分析图谱关系
- **THEN** 发送给 AI 的图谱信息只包含标题、描述、领域等，不包含图谱 ID
- **AND** AI 返回图谱标题，本地用标题匹配对应的 ID

#### Scenario: 节点推荐连接
- **WHEN** 用户请求推荐节点连接
- **THEN** AI 返回节点标题，不返回节点 ID
- **AND** 本地用标题匹配对应的节点

## MODIFIED Requirements

### Requirement: OUTPUT_SCHEMAS 更新

修改 `promptService.ts` 中的 OUTPUT_SCHEMAS：

1. **`recommend_connections`**：
   - 移除 `node_id` 字段
   - 只保留 `node_title` 和 `reason`

2. **`learning_path_generate`**：
   - 将 `nodeId` 改为 `nodeTitle`
   - 将 `prerequisites` 从 ID 数组改为标题数组

### Requirement: 数据库模板处理

云端数据库 `prompt_templates` 表中可能存储了旧版本的系统模板，需要：
1. 删除旧的系统模板记录，让代码中的默认模板生效
2. 或者在代码中确保默认模板优先级高于数据库模板

## REMOVED Requirements

### Requirement: 旧的 ID 返回格式

**Reason**: ID 对 AI 无意义，增加 token 消耗，且可能导致匹配错误

**Migration**: 
- AI 返回标题而非 ID
- 本地通过标题匹配来获取对应的 ID
