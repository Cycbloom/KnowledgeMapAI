# 计划：移除智能关系分析中发送给 AI 的 ID

## 问题分析

用户发现在智能关系分析功能中，把 `graph_id` 和 `node_id` 发给了 AI，但这些 ID 对 AI 来说没有实际意义。应该只发送标题，然后本地软件用标题来匹配节点。

### 问题位置

#### 1. `relationDiscoveryService.ts` - `discoverRelations` 方法

**第 136-143 行**：发送给 AI 的 `graphSummaries` 包含了 `id`
```typescript
const graphSummaries = graphs.map(g => ({
  id: g.id,  // <-- 问题：发送了 graph_id
  title: g.title,
  ...
}));
```

**第 150-154 行**：`existing_relations` 也发送了 ID
```typescript
existing_relations: existingRelations.map(r => ({
  from: r.source_graph_id,  // <-- 问题：发送了 graph id
  to: r.target_graph_id,    // <-- 问题：发送了 graph id
  type: r.relation_type,
})),
```

#### 2. `aiService.ts` - `analyzeCrossGraphConnections` 方法

**第 1121-1139 行**：节点信息包含了 ID
```typescript
const graph1NodesText = graph1.nodes
  .map((n) => `- ID: ${n.id}, Title: ${n.title}...`)  // <-- 问题：发送了 node id
```

#### 3. `promptService.ts` - prompt 模板

**第 40-47 行**：模板中显示了 ID
```
{{#each graphs}}
### 图谱：{{title}}
- ID: {{id}}   <-- 问题：把 ID 发给了 AI
```

**第 377-419 行**：OUTPUT_SCHEMAS 中的 `discover_graph_relations` schema 要求 AI 返回 ID

## 解决方案

### 核心思路
1. **不要把 ID 发送给 AI** - ID 对 AI 来说是无意义的字符串
2. **只发送标题** - AI 可以理解标题，并用标题来标识关系
3. **本地用标题匹配** - 收到 AI 响应后，本地用标题来匹配对应的 ID

## 实施步骤

### 步骤 1：修改 `relationDiscoveryService.ts`

1. **移除 `graphSummaries` 中的 `id` 字段**（第 136-143 行）
   - 只保留 `title`, `description`, `domain`, `core_concepts`, `node_count`

2. **修改 `existing_relations` 的格式**（第 150-154 行）
   - 改为发送图谱标题而不是 ID
   - 格式：`{ from_title: string, to_title: string, type: string }`

3. **修改 AI 响应解析逻辑**（第 193-202 行）
   - AI 返回的是标题，本地用标题匹配对应的图谱 ID
   - 当前已有标题匹配逻辑，需要确保只用标题匹配

### 步骤 2：修改 `aiService.ts`

1. **移除节点 ID**（第 1121-1139 行）
   - 节点文本格式改为：`- Title: ${n.title}, Content: ...`
   - 不再发送 `ID: ${n.id}`

### 步骤 3：修改 `promptService.ts`

1. **修改默认 prompt 模板**（第 40-47 行）
   - 移除 `- ID: {{id}}` 行
   - 只保留标题和其他有意义的信息

2. **修改 OUTPUT_SCHEMAS 中的 `discover_graph_relations`**（第 377-419 行）
   - 将 `source_graph_id` 和 `target_graph_id` 改为 `source_graph_title` 和 `target_graph_title`
   - AI 返回标题，本地用标题匹配

3. **修改 OUTPUT_SCHEMAS 中的 `cross_graph_connection_analysis`**（第 312-348 行）
   - 将 `node1_id` 和 `node2_id` 改为只用标题
   - AI 返回节点标题，本地用标题匹配

### 步骤 4：验证修改

1. 运行类型检查 `npm run check`
2. 运行代码检查 `npm run lint`
3. 测试智能关系分析功能

## 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `api/services/graph/relationDiscoveryService.ts` | 移除发送给 AI 的 ID，改用标题 |
| `api/services/ai/aiService.ts` | 移除节点 ID，只发送标题 |
| `api/services/ai/promptService.ts` | 修改 prompt 模板和 OUTPUT_SCHEMAS |

## 预期效果

1. AI 收到的信息更加简洁、有意义
2. AI 返回的是图谱/节点标题，而不是无意义的 ID
3. 本地软件用标题来匹配对应的 ID，建立关系
4. 减少 token 消耗（ID 字符串通常很长）
