# RAG Chat 跳数(hopDistance)始终为0的Bug修复计划

## Bug描述
RAG Chat 中，图增强检索返回的参考来源(source)的跳数(hopDistance)始终显示为0，导致"[N跳]"标签永远不出现，跳数信息完全无效。

## 根因分析

### 核心问题：`buildContext()` 无条件将所有 `usedSources` 的 `hopDistance` 覆写为 0

**文件**: `api/services/ai/ragService.ts` 第290-311行

```typescript
const allSources: GraphRAGSearchResult[] = [
  ...usedSources.map((s) => ({
    ...s,
    hopDistance: 0,           // ← BUG: 无条件覆写为0！
    relationshipPath: "",
    relationshipType: "",
  })),
  ...(graphSources || []).map((gs) => ({
    ...gs,
    hopDistance: gs.hopDistance,  // 只有 graphSources 保留了真实跳数
    ...
  })),
];
```

问题链路：
1. `contextWindowManager.buildContext()` 接收 `searchResults` 作为种子节点，返回 `usedSources`（类型为 `ContextSource[]`，不含 `hopDistance` 字段）
2. 当 `useGraphContext=false` 时，`hybridSearch` 仍然会执行图遍历（因为 `graphId` 存在），返回的结果中包含 `hopDistance > 0` 的图扩展节点
3. 但这些图扩展节点被放入 `searchResults` → `usedSources`，然后在构建 `allSources` 时被强制设为 `hopDistance: 0`
4. 只有 `useGraphContext=true` 时，才会将图扩展节点分离到 `graphSources`，保留真实跳数
5. 即使 `useGraphContext=true`，图扩展节点排在种子节点之后，`sources.slice(0, 5)` 可能将它们截断

### 次要问题：`sources.slice(0, 5)` 可能截断图扩展来源
- `allSources` 中种子节点在前（hopDistance=0），图扩展节点在后（hopDistance>0）
- 当种子节点 ≥5 个时，`slice(0, 5)` 只返回种子节点，图扩展节点被完全截断

### 类型不匹配：前端 `rag.ts` 的 `Source` 类型缺少 `hopDistance`
- `src/services/api/rag.ts` 的 `Source` 接口只有 `{ id, title, content, similarity }`
- `src/components/RAGChat/hooks/useChatState.ts` 的 `Source` 接口有 `hopDistance?: number`
- 虽然运行时数据不受影响（JSON序列化保留所有字段），但类型声明不一致

---

## 修改方案

### 1. `api/services/ai/ragService.ts` — 保留原始 hopDistance

**核心修改**：在构建 `allSources` 时，从原始搜索结果中查找 `hopDistance`，而非无条件设为0。

修改 `buildContext()` 方法：

**步骤1**: 在 `contextWindowManager.buildContext()` 调用前，建立 `sourceId → GraphRAGSearchResult` 的查找映射：

```typescript
// 保留所有搜索结果的原始图关联信息（hopDistance、relationshipPath等）
const originalResultMap = new Map<string, GraphRAGSearchResult>();
if (effectiveSearchMode === "keyword") {
  // keywordSearch 返回 RAGSearchResult[]，不含图信息
} else {
  // semanticSearch/hybridSearch/graphAugmentedSearch 返回 GraphRAGSearchResult[]
  const graphResults = (effectiveSearchMode === "semantic" && !useGraphContext)
    ? await this.semanticSearch(...)  // RAGSearchResult[]
    : ...; // 其他情况
  // 对有图信息的搜索结果建立映射
}
```

实际上，最简洁的做法是：不管搜索模式如何，都保留一份完整的搜索结果映射，在构建 `allSources` 时从中查找原始 `hopDistance`。

**步骤2**: 修改 `allSources` 构建，从映射中查找原始值：

```typescript
const allSources: GraphRAGSearchResult[] = [
  ...usedSources.map((s) => {
    const original = originalResultMap.get(s.id);
    return {
      id: s.id,
      title: s.title,
      content: s.content,
      similarity: s.similarity,
      graphId: s.graphId,
      hopDistance: original?.hopDistance ?? 0,
      relationshipPath: original?.relationshipPath ?? "",
      relationshipType: original?.relationshipType ?? "",
    };
  }),
  ...(graphSources || []).map((gs) => ({
    id: gs.id,
    title: gs.title,
    content: gs.content,
    similarity: 0,
    graphId: graphId || "",
    hopDistance: gs.hopDistance,
    relationshipPath: gs.relationshipPath,
    relationshipType: gs.relationshipType,
  })),
];
```

**步骤3**: 确保所有搜索路径（semantic/keyword/hybrid）的结果都被纳入映射。具体做法是在各分支中统一收集到 `allSearchResults: GraphRAGSearchResult[]` 变量，然后建立映射。

### 2. `api/services/ai/ragService.ts` — 确保图扩展来源不被截断

修改 `allSources` 的排序逻辑，让图扩展来源不完全排在种子节点后面。改为：**种子节点按相似度排序，图扩展节点按跳数排序，合并后取前5**。

或者更简单的方案：**将 `sources.slice(0, 5)` 改为 `sources.slice(0, 8)`**，增加展示数量，确保图扩展来源也能显示。

同时在 `ragChatService.ts` 中，`chat()` 方法的 `sources.slice(0, 5)` 和 `streamChat()` 方法的 `sources.slice(0, 5)` 也要同步调整。

### 3. `src/services/api/rag.ts` — 修复 Source 类型

在 `Source` 接口中添加 `hopDistance`、`relationshipPath`、`relationshipType` 字段：

```typescript
interface Source {
  id: string;
  title: string;
  content: string;
  similarity: number;
  hopDistance?: number;
  relationshipPath?: string;
  relationshipType?: string;
}
```

---

## 涉及文件清单

| 文件 | 修改内容 |
|------|----------|
| `api/services/ai/ragService.ts` | 1) 建立原始搜索结果映射，保留 hopDistance；2) 修改 allSources 构建逻辑 |
| `api/services/ai/ragChatService.ts` | 将 `sources.slice(0, 5)` 改为 `sources.slice(0, 8)` |
| `src/services/api/rag.ts` | Source 接口添加 hopDistance、relationshipPath、relationshipType |

## 验证步骤

1. `npm run check` — 类型检查通过
2. `npm run lint` — 代码规范检查通过
3. 手动测试：
   - 在知识图谱中选中一个有连接边的节点
   - 打开 RAG Chat，发送相关问题
   - 确认参考来源中出现 `[1跳]`、`[2跳]` 等标签（而非全部为0或不显示）
   - 确认关系路径正确显示
