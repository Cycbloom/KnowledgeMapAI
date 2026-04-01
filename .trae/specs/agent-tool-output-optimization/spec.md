# Agent工具输出数据精简优化规范

## Why

当前Agent工具返回的数据量过大（输入200万字符，输出仅几万字符），主要原因：
1. UUID字段占用大量空间（每个36字符）
2. `description` 和 `content` 字段可能很长
3. 不必要的字段如 `created_at`、`updated_at` 对AI分析无意义
4. 缺乏针对AI分析的精简模式

## What Changes

- 为所有Agent工具添加 `summarize` 参数（默认为true）
- 用索引（idx）代替UUID进行引用
- 截断长文本字段
- 移除不必要的元数据字段
- 添加 `domain` 字段替代完整描述

## Impact

- **Affected code**:
  - `api/services/agent/tools/graphTools.ts`
  - `api/services/agent/tools/analysisTools.ts`
  - `api/services/agent/tools/learningTools.ts`
  - `api/services/agent/tools/nodeTools.ts`

---

## ADDED Requirements

### Requirement: 工具输出精简模式

所有Agent工具 SHALL 支持 `summarize` 参数，用于控制输出数据的详细程度。

#### 精简模式规则

1. **索引代替UUID**：使用 `idx` (0, 1, 2...) 或简短引用（G1, G2...）
2. **文本截断**：
   - `description` → `summary`（最多50字）
   - `content` → 不返回，或只返回前30字
3. **移除不必要字段**：`created_at`, `updated_at`, `id`（用idx代替）
4. **添加领域标签**：用 `domain` 字段替代完整描述

#### Scenario: 精简模式输出
- **WHEN** 工具被调用且 `summarize=true`（默认）
- **THEN** 返回精简格式的数据
- **AND** 使用索引代替UUID
- **AND** 长文本被截断

#### Scenario: 完整模式输出
- **WHEN** 工具被调用且 `summarize=false`
- **THEN** 返回完整数据（用于调试或特殊需求）

---

## 数据格式对比

### get_graph_overview

**优化前：**
```json
{
  "graphCount": 50,
  "nodeCount": 500,
  "edgeCount": 800,
  "graphs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "机器学习基础",
      "description": "这是一个关于机器学习的基础知识图谱，包含了监督学习、非监督学习、强化学习等核心概念...",
      "created_at": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

**优化后（summarize=true）：**
```json
{
  "graphCount": 50,
  "nodeCount": 500,
  "edgeCount": 800,
  "graphs": [
    {
      "idx": 0,
      "title": "机器学习基础",
      "domain": "AI/机器学习",
      "nodes": 25
    }
  ]
}
```

### get_graph_details

**优化前：**
```json
{
  "graph": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "机器学习基础",
    "description": "很长的描述...",
    "created_at": "...",
    "updated_at": "..."
  },
  "nodes": [
    {
      "id": "...",
      "title": "监督学习",
      "content": "监督学习是机器学习的一种方法，使用标记数据进行训练...",
      "level": "core"
    }
  ],
  "edges": [
    {
      "id": "...",
      "source_id": "...",
      "target_id": "...",
      "relationship": "contains"
    }
  ]
}
```

**优化后（summarize=true）：**
```json
{
  "graph": {
    "idx": 0,
    "title": "机器学习基础",
    "domain": "AI"
  },
  "nodes": [
    {
      "idx": 0,
      "title": "监督学习",
      "level": "core",
      "summary": "监督学习是机器学习的一种方法..."
    }
  ],
  "edges": [
    {
      "from": 0,
      "to": 1,
      "type": "contains"
    }
  ]
}
```

### get_graph_relations

**优化后：**
```json
{
  "relations": [
    {
      "from": 0,
      "to": 1,
      "type": "prerequisite",
      "context": "学习路径"
    }
  ],
  "graphIndex": {
    "0": "机器学习基础",
    "1": "深度学习入门"
  }
}
```

---

## 预期效果

| 指标 | 优化前 | 优化后 | 提升 |
|-----|-------|-------|-----|
| 50个图谱数据量 | ~20,000字符 | ~2,000字符 | 减少90% |
| UUID占用 | 1,800字符 | 0字符 | 减少100% |
| 描述字段占用 | ~10,000字符 | ~2,500字符 | 减少75% |
| 总体输入大小 | 200万字符 | ~20万字符 | 减少90% |
