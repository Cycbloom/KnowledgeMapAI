# Node 类型扁平化重构计划

## 一、目标

将 `Node` 类型从嵌套结构改为扁平化结构，消除 `knowledge_point` 嵌套层，简化数据访问。

## 二、当前问题

```typescript
// 当前设计（有问题）
export interface Node extends GraphNode {
  knowledge_point: KnowledgePoint;  // ❌ 嵌套
  title: string;                     // ❌ 冗余
  content?: string;                  // ❌ 冗余
  learning_material?: string;          // ❌ 冗余
  properties?: Record<string, any>;    // ❌ 冗余
  visibility?: KnowledgePointVisibility; // ❌ 冗余
  owner_id?: string;                 // ❌ 冗余
}
```

**问题：**
1. 数据冗余 - 同一字段在 `Node` 和 `knowledge_point` 中都存在
2. 访问混乱 - 有时用 `node.title`，有时用 `node.knowledge_point.title`
3. 同步负担 - 构建对象时需要同时设置两处
4. 语义不清 - `Node.id` 到底是什么？

## 三、新设计

```typescript
// 新设计（扁平化）
export type Node = GraphNode & Omit<KnowledgePoint, 'id'> & {
  // id 来自 GraphNode，实际设置为 knowledge_point_id
  // GraphNode 和 KnowledgePoint 的所有字段直接合并
};
```

**优势：**
1. 无冗余 - 所有字段只存在一处
2. 访问统一 - 始终使用 `node.title`、`node.content` 等
3. 无同步问题 - 不需要维护两份数据
4. 类型清晰 - `Node` 是完整的节点数据

## 四、实施步骤

### 阶段 1：修改类型定义

#### 1.1 修改 `src/types/index.ts`

**文件：** [src/types/index.ts](file:///d:\KnowledgeMap\src\types\index.ts#L97-L121)

**修改前：**
```typescript
export interface Node extends GraphNode {
  knowledge_point: KnowledgePoint;
  title: string;
  content?: string;
  learning_material?: string;
  properties?: Record<string, any>;
  tags?: string[];
  visibility?: KnowledgePointVisibility;
  owner_id?: string;
}
```

**修改后：**
```typescript
/**
 * 前端节点类型，用于图编辑器中的节点展示和操作
 * 
 * 扁平化设计：合并 GraphNode 和 KnowledgePoint 的所有字段
 * 
 * ID 字段说明：
 * - id: 设置为 knowledge_point_id，与 Edge 的关联方式兼容
 * - knowledge_point_id: 关联的知识点 ID（继承自 GraphNode）
 * 
 * 字段来源：
 * - 来自 GraphNode: id, graph_id, knowledge_point_id, x_position, y_position, level, is_accepted, deleted_at, created_at, updated_at
 * - 来自 KnowledgePoint: title, content, learning_material, properties, visibility, owner_id, embedding, level?, is_accepted?
 */
export type Node = GraphNode & Omit<KnowledgePoint, 'id'> & {
  tags?: string[];
};
```

### 阶段 2：修改 API 端

#### 2.1 修改 `api/utils/nodeHelpers.ts`

**文件：** [api/utils/nodeHelpers.ts](file:///d:\KnowledgeMap\api\utils\nodeHelpers.ts#L17-L50)

**修改前：**
```typescript
export function buildNodeFromGraphNode(gn: GraphNodeRaw | null): Node | null {
  if (!gn) return null;

  const kp = gn.knowledge_point || getKnowledgePoint(gn.knowledge_points || null);
  return {
    id: gn.knowledge_point_id,
    graph_id: gn.graph_id,
    knowledge_point_id: gn.knowledge_point_id,
    x_position: gn.x_position,
    y_position: gn.y_position,
    level: gn.level,
    is_accepted: gn.is_accepted,
    deleted_at: gn.deleted_at,
    created_at: gn.created_at,
    updated_at: gn.updated_at,
    title: kp?.title || '',
    content: kp?.content || '',
    learning_material: kp?.learning_material || '',
    properties: kp?.properties || {},
    visibility: kp?.visibility || 'private',
    owner_id: kp?.owner_id,
    knowledge_point: kp ? { ... } : { ... },  // ❌ 嵌套
  } as unknown as Node;
}
```

**修改后：**
```typescript
/**
 * 将数据库原始图节点数据转换为前端 Node 类型
 * 
 * 扁平化设计：直接合并 GraphNode 和 KnowledgePoint 的所有字段
 */
export function buildNodeFromGraphNode(gn: GraphNodeRaw | null): Node | null {
  if (!gn) return null;

  const kp = gn.knowledge_point || getKnowledgePoint(gn.knowledge_points || null);
  
  if (!kp) {
    return null;
  }

  return {
    // GraphNode 字段
    id: gn.knowledge_point_id,
    graph_id: gn.graph_id,
    knowledge_point_id: gn.knowledge_point_id,
    x_position: gn.x_position,
    y_position: gn.y_position,
    level: gn.level,
    is_accepted: gn.is_accepted,
    deleted_at: gn.deleted_at,
    created_at: gn.created_at,
    updated_at: gn.updated_at,
    
    // KnowledgePoint 字段（扁平化）
    title: kp.title || '',
    content: kp.content || '',
    learning_material: kp.learning_material || '',
    properties: kp.properties || {},
    visibility: kp.visibility || 'private',
    owner_id: kp.owner_id || '',
    embedding: kp.embedding,
  } as Node;
}
```

### 阶段 3：修改前端代码（62+ 处）

#### 3.1 修改 `src/hooks/useGraphAIOperations.ts`

**文件：** [src/hooks/useGraphAIOperations.ts](file:///d:\KnowledgeMap\src\hooks\useGraphAIOperations.ts)

**需要修改的位置（约20处）：**

| 行号 | 修改前 | 修改后 |
|------|--------|--------|
| 69 | `selectedNode.knowledge_point?.properties?.ai_prompt` | `selectedNode.properties?.ai_prompt` |
| 71 | `selectedNode.knowledge_point?.title` | `selectedNode.title` |
| 75 | `parentNode.knowledge_point?.content \|\| parentNode.knowledge_point?.title` | `parentNode.content \|\| parentNode.title` |
| 86 | `n.knowledge_point?.title: ${n.knowledge_point?.content` | `n.title: ${n.content` |
| 125 | `selectedNode.knowledge_point?.title \|\| selectedNode.title` | `selectedNode.title` |
| 136 | `n.knowledge_point?.title \|\| n.title` | `n.title` |
| 143 | `n.knowledge_point?.title \|\| n.title` | `n.title` |
| 153 | `selectedNode.knowledge_point?.content \|\| selectedNode.content` | `selectedNode.content` |
| 166 | `n.knowledge_point?.title === s.title` | `n.title === s.title` |
| 237-238 | `selectedNode.knowledge_point?.title`, `selectedNode.knowledge_point?.content` | `selectedNode.title`, `selectedNode.content` |
| 318-319 | `node.knowledge_point?.title`, `node.knowledge_point?.content` | `node.title`, `node.content` |
| 326 | `n.knowledge_point?.title` | `n.title` |
| 333 | `n.knowledge_point?.title` | `n.title` |
| 397 | `n.knowledge_point?.title` | `n.title` |
| 404 | `n.knowledge_point?.title` | `n.title` |
| 407-408 | `selectedNode.knowledge_point?.title`, `selectedNode.knowledge_point?.content` | `selectedNode.title`, `selectedNode.content` |
| 526 | `selectedNodeData.node.knowledge_point?.title` | `selectedNodeData.node.title` |
| 569 | `selectedNode.knowledge_point?.title` | `selectedNode.title` |

#### 3.2 修改 `src/hooks/graphAI/useContentGeneration.ts`

**文件：** [src/hooks/graphAI/useContentGeneration.ts](file:///d:\KnowledgeMap\src\hooks\graphAI\useContentGeneration.ts)

**需要修改的位置（约10处）：**

| 行号 | 修改前 | 修改后 |
|------|--------|--------|
| 39 | `selectedNode.knowledge_point?.properties?.ai_prompt` | `selectedNode.properties?.ai_prompt` |
| 41 | `selectedNode.knowledge_point?.title` | `selectedNode.title` |
| 45 | `parentNode.knowledge_point?.content \|\| parentNode.knowledge_point?.title` | `parentNode.content \|\| parentNode.title` |
| 56 | `n.knowledge_point?.title: ${n.knowledge_point?.content` | `n.title: ${n.content` |
| 98 | `selectedNode.knowledge_point?.title` | `selectedNode.title` |

#### 3.3 修改 `src/hooks/graphAI/useBranchOperations.ts`

**文件：** [src/hooks/graphAI/useBranchOperations.ts](file:///d:\KnowledgeMap\src\hooks\graphAI\useBranchOperations.ts)

**需要修改的位置（约5处）：**

| 行号 | 修改前 | 修改后 |
|------|--------|--------|
| 36 | `n.knowledge_point?.title` | `n.title` |
| 43 | `n.knowledge_point?.title` | `n.title` |
| 46-47 | `selectedNode.knowledge_point?.title`, `selectedNode.knowledge_point?.content` | `selectedNode.title`, `selectedNode.content` |
| 159 | `selectedNodeData.node.knowledge_point?.title` | `selectedNodeData.node.title` |

#### 3.4 修改 `src/hooks/useTutorOperations.ts`

**文件：** [src/hooks/useTutorOperations.ts](file:///d:\KnowledgeMap\src\hooks\useTutorOperations.ts)

**需要修改的位置（约3处）：**

| 行号 | 修改前 | 修改后 |
|------|--------|--------|
| 46 | `n.knowledge_point?.title` | `n.title` |
| 68 | `n.knowledge_point?.title` | `n.title` |
| 229 | `n.knowledge_point?.title` | `n.title` |

#### 3.5 修改 `src/hooks/useGraphNodeOperations.ts`

**文件：** [src/hooks/useGraphNodeOperations.ts](file:///d:\KnowledgeMap\src\hooks\useGraphNodeOperations.ts)

**需要修改的位置（约2处）：**

| 行号 | 修改前 | 修改后 |
|------|--------|--------|
| 198 | `nodeToDelete.knowledge_point?.title` | `nodeToDelete.title` |
| 199 | `nodeToDelete.knowledge_point?.title` | `nodeToDelete.title` |

#### 3.6 修改 `src/hooks/useCombinedView.ts`

**文件：** [src/hooks/useCombinedView.ts](file:///d:\KnowledgeMap\src\hooks\useCombinedView.ts)

**需要修改的位置（约2处）：**

| 行号 | 修改前 | 修改后 |
|------|--------|--------|
| 110 | `gn.knowledge_point.id` | `gn.knowledge_point_id` |
| 117 | `knowledgePoint: gn.knowledge_point` | 删除此行（已扁平化） |

#### 3.7 修改 `src/components/BlindSpotList.tsx`

**文件：** [src/components/BlindSpotList.tsx](file:///d:\KnowledgeMap\src\components\BlindSpotList.tsx)

**需要修改的位置（约1处）：**

| 行号 | 修改前 | 修改后 |
|------|--------|--------|
| 37 | `card.knowledge_points?.title` | `card.title` |

**注意：** 需要更新 `BlindSpot` 接口定义，添加 `title` 字段

#### 3.8 修改 `src/components/GraphEditor/GraphSidebarManager.tsx`

**文件：** [src/components/GraphEditor/GraphSidebarManager.tsx](file:///d:\KnowledgeMap\src\components\GraphEditor\GraphSidebarManager.tsx)

**需要修改的位置（约4处）：**

| 行号 | 修改前 | 修改后 |
|------|--------|--------|
| 147 | `selectedNode.knowledge_point?.title` | `selectedNode.title` |
| 148 | `selectedNode.knowledge_point?.content` | `selectedNode.content` |
| 151 | `selectedNode.knowledge_point?.properties?.tags` | `selectedNode.properties?.tags` |

#### 3.9 修改 `src/pages/LearningMode.tsx`

**文件：** [src/pages/LearningMode.tsx](file:///d:\KnowledgeMap\src\pages\LearningMode.tsx)

**需要修改的位置（约7处）：**

| 行号 | 修改前 | 修改后 |
|------|--------|--------|
| 174 | `node.knowledge_point?.title` | `node.title` |
| 177 | `node.knowledge_point?.learning_material` | `node.learning_material` |
| 184 | `node.knowledge_point?.title` | `node.title` |
| 193 | `node.knowledge_point?.title` | `node.title` |
| 194 | `node.knowledge_point?.content` | `node.content` |
| 195 | `node.knowledge_point?.level` | `node.level` |
| 1049 | `node.knowledge_point?.title` | `node.title` |

#### 3.10 修改 `src/three/PlanetView.tsx`

**文件：** [src/three/PlanetView.tsx](file:///d:\KnowledgeMap\src\three\PlanetView.tsx)

**需要修改的位置（约3处）：**

| 行号 | 修改前 | 修改后 |
|------|--------|--------|
| 82 | `node.data.knowledge_point?.properties?.tags` | `node.data.properties?.tags` |
| 83 | `node.data.knowledge_point?.properties?.tags` | `node.data.properties?.tags` |
| 144 | `node.data.knowledge_point?.title` | `node.data.title` |

#### 3.11 修改 `src/utils/exportUtils.ts`

**文件：** [src/utils/exportUtils.ts](file:///d:\KnowledgeMap\src\utils\exportUtils.ts)

**需要修改的位置（约4处）：**

| 行号 | 修改前 | 修改后 |
|------|--------|--------|
| 44 | `node.knowledge_point?.title` | `node.title` |
| 51 | `node.knowledge_point?.title` | `node.title` |
| 55 | `node.knowledge_point?.content` | `node.content` |
| 56 | `node.knowledge_point.content` | `node.content` |

#### 3.12 修改 `src/types/index.ts` 中的注释

**文件：** [src/types/index.ts](file:///d:\KnowledgeMap\src\types\index.ts#L112-L114)

**修改前：**
```typescript
 * @example
 * // 推荐的访问方式（数据源明确）
 * const title = node.knowledge_point.title;
 * 
 * // 便捷访问方式（向后兼容）
 * const title = node.title;
 */
```

**修改后：**
```typescript
 * @example
 * // 统一的访问方式
 * const title = node.title;
 * const content = node.content;
 * const properties = node.properties;
 */
```

### 阶段 4：更新其他相关类型

#### 4.1 检查并更新 `BlindSpot` 类型

**文件：** [api/services/dashboardService.ts](file:///d:\KnowledgeMap\api\services\dashboardService.ts#L10-L25)

**修改前：**
```typescript
export interface BlindSpot {
  // ...
  knowledge_points?: {
    title: string;
  } | null;
}
```

**修改后：**
```typescript
export interface BlindSpot {
  // ...
  title: string;  // 直接包含 title 字段
}
```

## 五、影响范围

### 需要修改的文件统计

| 类型 | 数量 |
|------|------|
| 类型定义文件 | 2 |
| API 端文件 | 2 |
| Hooks 文件 | 6 |
| 组件文件 | 4 |
| 工具文件 | 1 |
| **总计** | **15** |

### 代码修改统计

| 文件 | 修改处数 |
|------|----------|
| useGraphAIOperations.ts | ~20 |
| useContentGeneration.ts | ~10 |
| useBranchOperations.ts | ~5 |
| useTutorOperations.ts | ~3 |
| useGraphNodeOperations.ts | ~2 |
| useCombinedView.ts | ~2 |
| BlindSpotList.tsx | ~1 |
| GraphSidebarManager.tsx | ~4 |
| LearningMode.tsx | ~7 |
| PlanetView.tsx | ~3 |
| exportUtils.ts | ~4 |
| **总计** | **~61** |

## 六、验证步骤

1. 运行 `npx tsc --noEmit` 确保无类型错误
2. 检查所有 `node.knowledge_point` 是否已全部替换
3. 测试以下功能：
   - 节点展开
   - AI 内容生成
   - 分支建议
   - 学习模式
   - 3D 视图
   - 导出功能

## 七、回滚计划

如果出现问题，可以回滚到修改前的状态：
1. 恢复 `src/types/index.ts` 中的 `Node` 定义
2. 恢复 `api/utils/nodeHelpers.ts` 中的 `buildNodeFromGraphNode` 函数
3. 恢复所有前端文件中的 `node.knowledge_point` 访问
