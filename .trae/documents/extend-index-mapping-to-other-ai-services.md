# 扩展索引映射基础设施到其他AI服务

## 背景

当前已实现的索引映射基础设施主要服务于 Agent 工具系统，实现了：
- **图谱索引映射** (graphIndexMap): idx ↔ graph UUID
- **节点索引映射** (nodeIndexMap): idx ↔ knowledge_point UUID

用户希望将此基础设施扩展到其他AI服务，使其也能享受索引映射带来的好处：
1. 减少AI输入token消耗（索引比UUID短很多）
2. 统一的ID转换逻辑
3. 类似操作系统页表的虚拟地址转换

## 数据库中涉及UUID的关键表

| 表名 | UUID字段 | 当前支持 |
|------|----------|----------|
| knowledge_graphs | id | ✅ 已支持 |
| knowledge_points | id | ✅ 已支持 |
| graph_nodes | id, graph_id, knowledge_point_id | ⚠️ 部分支持 |
| edges | graph_id, source/target_knowledge_point_id | ❌ 未支持 |
| graph_relations | source_graph_id, target_graph_id | ✅ 已支持 |
| study_cards | knowledge_point_id, graph_id, source_graph_id | ❌ 未支持 |
| learning_paths | source_graph_id | ❌ 未支持 |
| learning_path_nodes | knowledge_point_id | ❌ 未支持 |
| scheduled_tasks | knowledge_point_id | ❌ 未支持 |

## 其他AI服务分析

### 1. RelationDiscoveryService (关系发现服务)
- **位置**: `api/services/graph/relationDiscoveryService.ts`
- **涉及ID**: `source_graph_id`, `target_graph_id`, `related_graph_ids`
- **当前状态**: 输出真实UUID
- **改进空间**: 可输出索引版本，减少AI输入

### 2. AIActionService (AI动作服务)
- **位置**: `api/services/ai/aiActionService.ts`
- **涉及ID**: `nodeId`, `graphId`, `actionId`
- **当前状态**: 输入输出都是UUID
- **改进空间**: 可支持索引输入，输出索引版本

### 3. RAGService (RAG检索服务)
- **位置**: `api/services/ai/ragService.ts`
- **涉及ID**: `graphId`, `nodeId`, 返回结果中的`id`
- **当前状态**: 输入输出都是UUID
- **改进空间**: 输出结果可包含索引

### 4. AutoGraphService (自动图谱生成)
- **位置**: `api/services/graph/autoGraphService.ts`
- **涉及ID**: `graphId`, `knowledge_point_id`, `graphNodeId`
- **当前状态**: 输出真实UUID
- **改进空间**: 返回结果可包含索引映射

### 5. 移动端AI服务
- **位置**: `src/services/mobile/aiService.ts`
- **涉及ID**: 可能涉及图谱和知识点ID
- **改进空间**: 可复用前端索引映射服务

## 扩展方案

### Phase 1: 增强现有共享工具

扩展现有的 `shared/utils/indexMapping.ts`：

```typescript
// 新增：批量构建多种类型的映射
export const buildMultiTypeIndexMaps = <T extends Record<string, { id: string }>>(
  itemsByType: T
): Record<keyof T, Map<number, string>> => {
  const result: Record<string, Map<number, string>> = {};
  for (const [type, items] of Object.entries(itemsByType)) {
    result[type] = buildIndexMap(items);
  }
  return result;
};

// 新增：构建复合映射（图谱+节点）
export const buildCompositeIndexMap = (
  graphs: { id: string; title: string }[],
  nodesByGraph: Record<string, { id: string; title: string }[]>
): {
  graphIndexMap: Map<number, string>;
  graphTitleMap: Record<string, string>;
  nodeIndexMapsByGraph: Record<string, Map<number, string>>;
} => {
  // 实现...
};
```

### Phase 2: 扩展后端IndexMappingService

在 `api/services/indexMapping/IndexMappingService.ts` 中添加：

```typescript
// 新增方法
async buildStudyCardIndexMap(userId: string, supabase: SupabaseClient): Promise<Map<number, string>>
async buildLearningPathIndexMap(userId: string, supabase: SupabaseClient): Promise<Map<number, string>>
async buildTaskIndexMap(userId: string, supabase: SupabaseClient): Promise<Map<number, string>>

// 新增：复合上下文构建
async createFullIndexContext(userId: string, supabase: SupabaseClient): Promise<FullIndexContext>
```

### Phase 3: 更新其他AI服务

#### 3.1 RelationDiscoveryService
- 添加 `summarize` 参数支持
- 输出图谱索引而非UUID
- 返回 `graphIndex` 映射表

#### 3.2 AIActionService
- 支持索引输入（自动转换）
- 输出结果包含索引映射

#### 3.3 RAGService
- 输出结果添加索引版本
- 支持 `summarize` 参数

#### 3.4 AutoGraphService
- 返回结果包含节点索引映射
- 支持 `summarize` 参数

### Phase 4: 更新前端服务

扩展 `src/services/indexMapping.ts`：
- 添加更多实体类型的映射支持
- 与后端保持一致的API

### Phase 5: 创建统一的索引上下文提供者

创建一个可以在整个应用中共享的索引上下文：

```typescript
// api/services/indexMapping/IndexContextProvider.ts
export class IndexContextProvider {
  async getContextForUser(userId: string): Promise<FullIndexContext>
  async refreshContext(userId: string): Promise<void>
  async getContextForGraph(userId: string, graphId: string): Promise<GraphIndexContext>
}
```

## 实施优先级

### 高优先级（立即实施）
1. **RelationDiscoveryService** - 与Agent工具类似，直接受益
2. **RAGService** - 搜索结果输出索引可大幅减少token

### 中优先级（后续实施）
3. **AIActionService** - 动作执行结果输出
4. **AutoGraphService** - 自动生成结果输出

### 低优先级（按需实施）
5. **移动端AI服务** - 复用前端服务
6. **学习路径服务** - 特定场景使用

## 预期收益

1. **Token节省**: 索引比UUID短约90%
2. **代码复用**: 统一的转换逻辑
3. **一致性**: 所有AI服务使用相同的映射机制
4. **可维护性**: 修改映射逻辑只需修改一处

## 风险与注意事项

1. **缓存一致性**: 需要确保缓存失效机制正确
2. **跨服务一致性**: 不同服务使用相同的映射表
3. **向后兼容**: 需要保持现有API的兼容性
