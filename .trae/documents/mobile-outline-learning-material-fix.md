# 移动端大纲视图点击项目后学习材料无法展示问题修复计划

## 问题分析

### 问题描述
在移动端项目中，用户在大纲视图中点击特定项目后，对应的学习材料内容无法正常展示。

### 代码流程分析

1. **大纲视图点击流程** ([LearningMode.tsx](file:///d:/KnowledgeMap/src/pages/LearningMode.tsx)):
   - 用户在 `GraphOutline` 组件中点击节点
   - 触发 `onNodeClick` 回调，导航到 `/learning?graph_id=${graphId}&node_id=${node.id}`
   - `LearningMode` 组件通过 `useSearchParams` 获取 `nodeId`
   - 触发 `useEffect` 加载节点数据

2. **学习材料加载流程** ([LearningMode.tsx:247-358](file:///d:/KnowledgeMap/src/pages/LearningMode.tsx#L247-L358)):
   ```typescript
   useEffect(() => {
     if (!nodeId) return;
     
     const loadData = async () => {
       const node = await api.nodes.get(nodeId);  // 获取节点
       setNodeTitle(node.title || "");
       setKeywords(node.keywords || []);
       
       if (node.learning_material) {
         setArticleContent(node.learning_material);  // 设置学习材料
       } else {
         // 生成学习材料...
       }
     };
     loadData();
   }, [nodeId]);
   ```

3. **API 适配器选择** ([adapter.ts](file:///d:/KnowledgeMap/src/services/api/adapter.ts)):
   - 通过 `isCapacitorMobile()` 判断是否为移动端
   - 移动端使用 `mobileNodesApi`，Web 端使用 `webApi.nodes`

### 问题根源定位

经过代码分析，发现以下潜在问题：

#### 问题 1: 后端 API 未返回 `keywords` 字段
- **位置**: [api/routes/nodes.ts:141-189](file:///d:/KnowledgeMap/api/routes/nodes.ts#L141-L189)
- **问题**: `GET /nodes/:id` 查询中未包含 `keywords` 字段
- **影响**: 关键词无法正确展示

#### 问题 2: 后端 `buildNodeFromGraphNode` 未处理 `keywords`
- **位置**: [api/utils/nodeHelpers.ts:25-55](file:///d:/KnowledgeMap/api/utils/nodeHelpers.ts#L25-L55)
- **问题**: 构建节点对象时未包含 `keywords` 字段
- **影响**: 返回的节点数据缺少关键词

#### 问题 3: 移动端 API 查询可能存在问题
- **位置**: [src/services/mobile/nodes.ts:128-159](file:///d:/KnowledgeMap/src/services/mobile/nodes.ts#L128-L159)
- **问题**: 虽然查询语句包含 `learning_material`，但需要验证实际返回数据
- **潜在风险**: `buildNodeFromGraphNode` 函数中的日志显示有 `learning_material`，但需要确认实际数据流

#### 问题 4: 移动端环境检测可能不准确
- **位置**: [src/config/mobileApiConfig.ts](file:///d:/KnowledgeMap/src/config/mobileApiConfig.ts)
- **问题**: 如果 `isCapacitorMobile()` 返回错误值，可能导致使用了错误的 API

## 修复方案

### 方案 A: 修复后端 API（推荐）

#### 步骤 1: 更新后端节点查询 SQL
修改 [api/routes/nodes.ts](file:///d:/KnowledgeMap/api/routes/nodes.ts) 中的 `GET /nodes/:id` 查询，添加 `keywords` 字段：

```typescript
// 修改前
knowledge_points (
  id,
  title,
  content,
  learning_material,
  properties,
  visibility,
  owner_id,
  created_at,
  updated_at
)

// 修改后
knowledge_points (
  id,
  title,
  content,
  learning_material,
  properties,
  visibility,
  owner_id,
  created_at,
  updated_at,
  keywords
)
```

#### 步骤 2: 更新 `buildNodeFromGraphNode` 函数
修改 [api/utils/nodeHelpers.ts](file:///d:/KnowledgeMap/api/utils/nodeHelpers.ts) 中的函数：

```typescript
return {
  // ... 现有字段
  learning_material: kp.learning_material || "",
  keywords: kp.keywords || [],  // 添加此行
  // ... 其他字段
} as Node;
```

#### 步骤 3: 更新 `GRAPH_NODES_SELECT` 常量
修改 [api/utils/nodeHelpers.ts](file:///d:/KnowledgeMap/api/utils/nodeHelpers.ts) 中的常量，添加 `keywords` 字段。

### 方案 B: 增强移动端 API 错误处理

#### 步骤 1: 添加详细日志
在 [src/services/mobile/nodes.ts](file:///d:/KnowledgeMap/src/services/mobile/nodes.ts) 中添加更详细的日志：

```typescript
get: async (id: string): Promise<Node> => {
  console.log("[mobileNodesApi.get] Called with id:", id);
  // ... 现有代码
  console.log("[mobileNodesApi.get] Raw data from DB:", data);
  console.log("[mobileNodesApi.get] knowledge_points:", data?.knowledge_points);
  // ... 现有代码
}
```

#### 步骤 2: 添加数据验证
在 `buildNodeFromGraphNode` 中添加数据验证：

```typescript
function buildNodeFromGraphNode(gn: GraphNodeRaw | null): Node | null {
  if (!gn) {
    console.warn("[buildNodeFromGraphNode] Input is null");
    return null;
  }
  
  const kp = gn.knowledge_point || getKnowledgePoint(gn.knowledge_points || null);
  
  if (!kp) {
    console.warn("[buildNodeFromGraphNode] No knowledge_point found for:", gn.knowledge_point_id);
    return null;
  }
  
  // 验证关键字段
  if (!kp.learning_material) {
    console.warn("[buildNodeFromGraphNode] No learning_material for:", kp.id);
  }
  
  // ... 构建节点
}
```

### 方案 C: 前端防御性编程

#### 步骤 1: 在 LearningMode 中添加错误处理
修改 [src/pages/LearningMode.tsx](file:///d:/KnowledgeMap/src/pages/LearningMode.tsx)：

```typescript
const loadData = async () => {
  try {
    setIsGenerating(true);
    const node = await api.nodes.get(nodeId);
    
    // 验证数据
    if (!node) {
      throw new Error("节点数据为空");
    }
    
    console.log("[LearningMode] Loaded node:", {
      id: node.id,
      title: node.title,
      hasLearningMaterial: !!node.learning_material,
      learningMaterialLength: node.learning_material?.length || 0
    });
    
    setNodeTitle(node.title || "");
    setKeywords(node.keywords || []);
    
    if (node.learning_material) {
      setArticleContent(node.learning_material);
    } else {
      // 生成学习材料...
    }
  } catch (error) {
    console.error("[LearningMode] Failed to load node:", error);
    addMessage({ type: "error", content: "加载节点失败" });
  } finally {
    setIsGenerating(false);
  }
};
```

## 实施步骤

### 第一阶段：诊断问题
1. 在移动端添加详细日志，确认 API 调用和数据返回
2. 验证 `isCapacitorMobile()` 返回值是否正确
3. 检查数据库中节点的 `learning_material` 字段是否有数据

### 第二阶段：修复后端
1. 更新后端 API 查询，添加 `keywords` 字段
2. 更新 `buildNodeFromGraphNode` 函数
3. 更新 `GRAPH_NODES_SELECT` 常量

### 第三阶段：增强前端
1. 在 `LearningMode` 中添加防御性编程
2. 添加错误处理和用户反馈
3. 添加加载状态指示

### 第四阶段：测试验证
1. 在移动端测试大纲视图点击
2. 验证学习材料正确展示
3. 验证关键词正确展示

## 文件修改清单

| 文件路径 | 修改内容 |
|---------|---------|
| `api/routes/nodes.ts` | 添加 `keywords` 到查询 |
| `api/utils/nodeHelpers.ts` | 更新 `buildNodeFromGraphNode` 和 `GRAPH_NODES_SELECT` |
| `src/services/mobile/nodes.ts` | 添加日志和数据验证 |
| `src/pages/LearningMode.tsx` | 添加错误处理和日志 |

## 风险评估

- **低风险**: 后端添加 `keywords` 字段，向后兼容
- **低风险**: 前端添加错误处理，不影响现有功能
- **中风险**: 如果问题不在上述位置，需要进一步调试

## 预期结果

修复后，移动端用户在大纲视图中点击项目时：
1. 学习材料内容能够正确展示
2. 关键词能够正确展示
3. 如果数据缺失，显示友好的错误提示
