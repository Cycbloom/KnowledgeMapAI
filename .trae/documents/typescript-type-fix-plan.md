# TypeScript 类型错误修复计划

## 问题概述

项目中共有约 150 个 TypeScript 类型错误，主要分为以下几类：

## 问题分类与修复方案

### 1. 缺少 logger 导入 (2 个文件)

**问题文件：**
- `api/services/pdfService.ts`
- `api/services/templateService.ts`

**修复方案：**
```typescript
import { logger } from '../utils/logger.js';
```

---

### 2. GraphNodeWithKnowledgePoint 类型问题 (约 80 个错误)

**问题描述：**
类型定义中 `GraphNodeWithKnowledgePoint` 的属性结构为：
```typescript
interface GraphNodeWithKnowledgePoint extends GraphNode {
  knowledge_point: KnowledgePoint;
}
```
但代码中直接访问 `node.title`, `node.content`, `node.tags` 等，这些属性实际在 `knowledge_point` 内部。

**修复方案：**
在 `src/types/index.ts` 中扩展 `Node` 类型，添加便捷访问属性：

```typescript
export interface Node extends GraphNode {
  knowledge_point: KnowledgePoint;
  // 便捷访问属性
  title: string;
  content?: string;
  learning_material?: string;
  properties?: Record<string, any>;
}
```

或者修改 `GraphNodeWithKnowledgePoint` 定义，使其直接包含这些属性。

---

### 3. KnowledgePoint 类型缺少属性 (约 15 个错误)

**问题描述：**
代码访问 `knowledge_point.level`, `knowledge_point.is_accepted`，但这些属性在 `GraphNode` 上，不在 `KnowledgePoint` 上。

**修复方案：**
这些访问是错误的，应该访问 `node.level`, `node.is_accepted`（在 GraphNode 上）。

需要修复的文件：
- `src/hooks/graphAI/useContentGeneration.ts`
- `src/hooks/useGraphAIOperations.ts`
- `src/hooks/useGraphNodeOperations.ts`
- `src/hooks/useTutorOperations.ts`

---

### 4. Edge 类型字段名不一致 (约 10 个错误)

**问题描述：**
`src/lib/graph/analysis.ts` 使用 `edge.source_node_id`, `edge.target_node_id`，但类型定义使用 `source_knowledge_point_id`, `target_knowledge_point_id`。

**修复方案：**
修改 `src/lib/graph/analysis.ts` 使用正确的字段名：
```typescript
// 修改前
edge.source_node_id
edge.target_node_id

// 修改后
edge.source_knowledge_point_id
edge.target_knowledge_point_id
```

---

### 5. GraphRelation 类型问题 (约 6 个错误)

**问题描述：**
Supabase 关联查询返回的 `source_graph` 和 `target_graph` 是数组形式，但类型定义期望对象形式。

**修复方案：**
修改 `GraphRelation` 类型定义，使 `source_graph` 和 `target_graph` 可以为数组或对象：

```typescript
export interface GraphRelation {
  id: string;
  source_graph_id: string;
  target_graph_id: string;
  relation_type: GraphRelationType;
  context?: string;
  metadata?: Record<string, any>;
  created_at: string;
  source_graph?: Graph | Graph[];
  target_graph?: Graph | Graph[];
}
```

或者在 `graphRelationService.ts` 中处理数组转换。

---

### 6. GraphService 返回类型问题 (约 4 个错误)

**问题描述：**
`listGraphs` 和 `listTrash` 方法的 fallback 函数返回类型与 `GraphWithCount[]` 不匹配。

**修复方案：**
修改 `graphService.ts` 中的 fallback 函数，确保返回完整的 `GraphWithCount` 对象：
```typescript
return graphs?.map((g) => ({
  ...g,
  nodes_count: countMap.get(g.id) || 0,
  tags: Array.from(tagsMap.get(g.id) || [])
})) as GraphWithCount[] || [];
```

---

### 7. LayoutNode 类型问题 (约 5 个错误)

**问题描述：**
`LayoutNode` 继承自 `Node`，但组件中访问的属性仍然需要通过 `knowledge_point` 访问。

**修复方案：**
与问题 2 一起解决，确保 `Node` 类型包含便捷访问属性。

---

### 8. 其他路由层问题 (约 5 个错误)

**问题描述：**
- `api/routes/autoGraph.ts`: `getGraphNodesByGraph` 方法不存在
- `api/routes/knowledgePoints.ts`: `GraphService.get` 方法不存在，`UserProfile.role` 不存在
- `api/routes/backup.ts`: 参数数量不匹配

**修复方案：**
需要逐个检查并修复：
1. 检查 `GraphNodeService` 是否有 `getGraphNodesByGraph` 方法，或使用正确的方法名
2. 检查 `GraphService` 的方法签名
3. 检查 `UserProfile` 类型定义

---

## 实施步骤

### Phase 1: 核心类型定义修复
1. 修复 `src/types/index.ts` 中的类型定义
2. 添加 logger 导入到缺失的文件

### Phase 2: 后端服务修复
1. 修复 `api/services/graphRelationService.ts` 类型问题
2. 修复 `api/services/graphService.ts` 返回类型

### Phase 3: 前端组件修复
1. 修复 `src/lib/graph/analysis.ts` Edge 字段名
2. 修复 hooks 中对 KnowledgePoint 属性的错误访问

### Phase 4: 路由层修复
1. 修复路由文件中的方法调用和类型问题

### Phase 5: 验证
1. 运行 TypeScript 类型检查
2. 确保所有错误已修复

---

## 预期成果

- 所有 TypeScript 类型错误修复
- 代码类型安全性提高
- IDE 自动补全和类型提示正常工作
