# 边关系功能增强 Spec

## Why

知识图谱中的边关系功能已经实现了完整的数据结构和样式配置，但存在两个主要问题：
1. **AI 生成图谱时未充分利用关系类型**：目前 AI 生成时几乎全部使用 `contains` 或 `related`，没有利用丰富的语义关系类型（如 `depends_on`, `causes`, `similar_to` 等）
2. **边的样式渲染未完全根据关系类型差异化**：虽然前端已支持根据关系类型渲染不同样式，但 AI 生成时未正确设置关系类型，导致样式差异化效果不明显

## What Changes

### 1. AI 提示词优化
- 修改 `text_to_graph` 和 `document_to_graph` 的输出 Schema，让 AI 返回更丰富的关系类型
- 在 AI 生成图谱时，根据节点间的语义关系自动选择合适的关系类型
- 更新 `auto_graph_init`、`auto_graph_expand` 等提示词，引导 AI 正确使用关系类型

### 2. 边样式增强
- 确保前端渲染完全利用关系类型的样式配置
- 添加关系类型图例显示功能
- 优化边的标签显示逻辑

### 3. 关系类型使用优化
- 在 AI 生成时，根据节点内容和层级关系智能选择关系类型
- 支持用户手动修改关系类型时提供智能推荐

## Impact

- Affected code:
  - `api/services/ai/promptService.ts` - AI 提示词配置
  - `api/services/graph/autoGraphService.ts` - 自动图谱生成服务
  - `api/services/taskProcessors/recursiveGraphProcessor.ts` - 递归图谱生成处理器
  - `src/components/GraphEditor/canvas/MindMapLink.tsx` - 边渲染组件
  - `src/config/relationshipTypes.ts` - 关系类型配置

## ADDED Requirements

### Requirement: AI 生成图谱时智能选择关系类型

系统应在 AI 生成图谱时，根据节点间的语义关系自动选择合适的关系类型，而非统一使用 `contains` 或 `related`。

#### Scenario: 层级关系生成
- **WHEN** AI 生成父子节点关系
- **THEN** 应使用 `contains` 或 `has_subcategory` 等层级关系类型

#### Scenario: 依赖关系生成
- **WHEN** AI 识别到节点间存在依赖关系（如"学习 A 需要先学习 B"）
- **THEN** 应使用 `depends_on` 或 `prerequisite` 等依赖关系类型

#### Scenario: 语义关系生成
- **WHEN** AI 识别到节点间存在相似、对比、同义等语义关系
- **THEN** 应使用 `similar_to`、`contrasts_with`、`synonym_of` 等语义关系类型

#### Scenario: 因果关系生成
- **WHEN** AI 识别到节点间存在因果关系
- **THEN** 应使用 `causes`、`caused_by`、`enables` 等因果关系类型

### Requirement: 边样式根据关系类型差异化显示

系统应根据关系类型配置，在图谱中差异化显示边的样式。

#### Scenario: 颜色差异化
- **WHEN** 边具有不同的关系类型
- **THEN** 应根据关系类型的颜色配置显示不同颜色的边

#### Scenario: 线型差异化
- **WHEN** 边具有不同的关系类型
- **THEN** 应根据关系类型的线型配置显示不同线型（实线、虚线、点线、双线）

#### Scenario: 箭头差异化
- **WHEN** 边属于需要显示箭头的分类（dependency, causal, interaction）
- **THEN** 应显示箭头；否则不显示

### Requirement: 关系类型图例显示

系统应在图谱编辑器中提供关系类型图例，帮助用户理解不同边的含义。

#### Scenario: 显示图例
- **WHEN** 用户查看图谱
- **THEN** 应能在图谱中看到当前使用的关系类型图例

## MODIFIED Requirements

### Requirement: AI 提示词输出格式

原有的 `text_to_graph` 和 `document_to_graph` 输出 Schema 需要修改，支持更丰富的关系类型。

**修改前**：
```
- Edges: { "source": "parent_temp_id", "target": "child_temp_id", "relationship": "contains|related" }
```

**修改后**：
```
- Edges: { "source": "parent_temp_id", "target": "child_temp_id", "relationship_type": "contains|depends_on|causes|similar_to|..." }
```

## 现状分析

### 已实现的功能

#### 1. 数据库层面

**edges 表结构**：
```sql
CREATE TABLE edges (
  id UUID PRIMARY KEY,
  graph_id UUID,
  source_knowledge_point_id UUID,
  target_knowledge_point_id UUID,
  relationship_type VARCHAR(50) DEFAULT 'related',
  weight INTEGER DEFAULT 1,
  custom_label TEXT,
  custom_color TEXT,
  custom_line_style TEXT DEFAULT 'solid',
  show_arrow BOOLEAN,
  ...
);
```

**relationship_types 表**：存储预设和用户自定义的关系类型配置

#### 2. 关系类型配置（共 25 种预设类型）

| 分类 | 关系类型 | 颜色 | 线型 | 箭头 |
|------|----------|------|------|------|
| hierarchical | contains, part_of, parent_child, has_subcategory, instance_of | #3B82F6 | solid | auto |
| dependency | depends_on, prerequisite, requires, blocks | #F59E0B/#EF4444 | dashed | true |
| semantic | related_to, similar_to, contrasts_with, synonym_of, antonym_of | #10B981/#8B5CF6 | solid/dotted/double | false |
| temporal | precedes, follows, concurrent_with | #06B6D4 | solid/dotted | true/false |
| interaction | interacts_with, communicates_with, collaborates_with | #EC4899 | solid/dashed/dotted | auto |
| causal | causes, caused_by, enables, prevents | #EF4444/#22C55E | solid/dashed | true |

#### 3. 前端渲染（MindMapLink.tsx）

- ✅ 根据关系类型配置渲染颜色
- ✅ 根据关系类型配置渲染线型（solid, dashed, dotted, double）
- ✅ 根据关系类型配置和分类自动判断是否显示箭头
- ✅ 支持自定义覆盖（custom_color, custom_line_style, show_arrow）
- ✅ 支持边标签显示

#### 4. 边编辑功能（EdgeEditDialog.tsx）

- ✅ 支持选择关系类型
- ✅ 支持自定义颜色
- ✅ 支持自定义线型
- ✅ 支持箭头显示控制

### 存在的问题

#### 1. AI 生成时关系类型单一

当前 AI 生成图谱时，几乎所有边都使用 `contains` 或 `related`：

```typescript
// autoGraphService.ts
relationship_type: 'contains'  // 固定使用 contains

// promptService.ts 中的输出 Schema
"relationship": "contains|related"  // 只支持两种类型
```

#### 2. 提示词未引导 AI 使用丰富关系类型

`text_to_graph` 和 `document_to_graph` 的输出 Schema 只定义了 `contains|related` 两种关系类型，限制了 AI 的输出。

#### 3. 关系类型图例缺失

用户无法直观了解当前图谱中使用了哪些关系类型及其含义。
