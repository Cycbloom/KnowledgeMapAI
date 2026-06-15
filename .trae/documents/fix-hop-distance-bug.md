# 图增强检索跳数显示为 0 的 Bug 修复

## 问题分析

### 现象
开启图增强检索后，来源卡片中所有节点（包括图谱扩展发现的节点）都显示 `[0跳]`，跳数不正确。

### 根因

**`buildContext` 方法返回的 `sources` 只包含种子节点，丢失了图谱扩展节点的信息。**

完整链路追踪：

1. **`graphAugmentedSearch`**（ragService.ts L196-279）正确返回了两类结果：
   - 种子节点：`hopDistance = 0`
   - 扩展节点：`hopDistance = 1/2`（来自图谱遍历）

2. **`buildContext`**（ragService.ts L281-369）将结果拆分：
   ```typescript
   searchResults = seedResults;       // 只有种子节点 → 传给 contextWindowManager
   graphSources = expandedResults;    // 扩展节点 → 作为单独参数传入
   ```

3. **`contextWindowManager.buildContext`** 返回的 `usedSources` 只包含从 `searchResults`（种子）中选取的节点。**图谱扩展节点被用于构建上下文文本，但没有被加入返回的 sources 数组。**

4. **`streamChat`** 返回 `sources.slice(0, 5)` — 这里只有种子节点，全部 `hopDistance=0`

5. 前端 `Source` 接口已有 `hopDistance` 和 `relationshipPath` 字段，`ChatMessage` 也已支持显示 `[N跳]` 标记 — **前端没问题，是后端没传这些数据。**

## 修改计划

### 文件：`d:\KnowledgeMap\api\services\ai\ragService.ts`

#### 修改 `buildContext` 方法的返回值

将返回类型改为包含图谱扩展来源，在 return 时合并两类 sources：

```typescript
// 当前代码（L368）
return { context, sources: usedSources };

// 修改为：
// 合并种子来源和图谱扩展来源
const allSources: GraphRAGSearchResult[] = [
  ...usedSources,
  ...(graphSources || []).map(gs => ({
    id: gs.id,
    title: gs.title,
    content: gs.content,
    similarity: 0,
    graphId: graphId || '',
    hopDistance: gs.hopDistance,
    relationshipPath: gs.relationshipPath,
    relationshipType: gs.relationshipType,
  })),
];
return { context, sources: allSources };
```

注意：`buildContext` 的当前返回类型是 `{ context: string; sources: RAGSearchResult[] }`，需要确认调用方是否兼容 `GraphRAGSearchResult`（因为它是 `RAGSearchResult` 的子类型，向上兼容，所以没问题）。

## 验证步骤

1. `npx tsc --noEmit` 类型检查通过
2. `npm run lint` 无新增错误
