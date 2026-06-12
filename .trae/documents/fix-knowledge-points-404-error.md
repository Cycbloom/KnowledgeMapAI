# 修复 KnowledgePointAssociation 组件 404 错误

## 问题分析

终端日志中的错误：
```
GET /api/knowledge-points {"status":404,"duration":"1ms"}
Frontend error: "Failed to load knowledge points: NotFoundError - API not found"
```

### 根因

[KnowledgePointAssociation.tsx](file:///d:/KnowledgeMap/src/components/Scheduler/TaskWorkbench/KnowledgePointAssociation.tsx#L59-L61) 第 59-61 行使用原生 `fetch` 调用 `/api/knowledge-points?search=...&limit=10`，存在以下问题：

1. **API 路径错误**：后端路由 `GET /knowledge-points` 挂载在 `/api/knowledge-points` 下，实际完整路径为 `/api/knowledge-points/knowledge-points`（路由文件中路径包含了资源名前缀），而前端调用的是 `/api/knowledge-points`
2. **缺少认证信息**：原生 `fetch` 不携带 Authorization header 和 CSRF token，项目统一使用 `request` 函数（基于 axios）处理认证
3. **`search` 参数不支持**：后端 `GET /knowledge-points` 路由只支持 `visibility` 参数，不支持 `search` 参数（见 [knowledgePoints.ts](file:///d:/KnowledgeMap/api/routes/knowledgePoints.ts#L80)）

### 正确的搜索方式

项目中已有 `api.knowledgePoints.searchSimilar` 方法（[knowledgePoints.ts](file:///d:/KnowledgeMap/src/services/api/knowledgePoints.ts#L51-L58)），调用 `POST /knowledge-points/search-similar`，支持语义搜索。

### 类型兼容性（已确认）

- `searchResults` state 类型为 `any[]`（第 31 行），无类型约束
- 组件使用 `kp.id`、`kp.title`、`kp.content` 三个字段（第 215-229 行）
- `SimilarKnowledgePoint` 类型包含 `id`、`title`、`content` 字段，完全兼容

## 修改方案

### 修改：修复 KnowledgePointAssociation.tsx 的搜索逻辑

**文件**：[KnowledgePointAssociation.tsx](file:///d:/KnowledgeMap/src/components/Scheduler/TaskWorkbench/KnowledgePointAssociation.tsx)

将第 57-70 行的 `handleSearchKnowledgePoints` 函数体从原生 `fetch` 改为使用 `api.knowledgePoints.searchSimilar`：

```typescript
// 修改前（第 57-70 行）：
setIsSearching(true);
try {
  const response = await fetch(
    `/api/knowledge-points?search=${encodeURIComponent(query)}&limit=10`,
  );
  const data = await response.json();
  if (data.success) {
    setSearchResults(data.data || []);
  }
} catch (error) {
  console.error("Search error:", error);
} finally {
  setIsSearching(false);
}

// 修改后：
setIsSearching(true);
try {
  const data = await api.knowledgePoints.searchSimilar({ query, limit: 10 });
  setSearchResults(data || []);
} catch (error) {
  console.error("Search error:", error);
} finally {
  setIsSearching(false);
}
```

无需额外 import，因为文件第 13 行已导入 `api`。

## 验证步骤

1. 启动开发服务器，进入调度器任务详情页
2. 在知识点关联区域点击"添加"，输入搜索关键词
3. 确认不再出现 404 错误，搜索结果正常显示
4. 确认点击搜索结果可以成功添加知识点关联
