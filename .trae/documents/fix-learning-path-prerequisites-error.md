# 学习路径创建错误修复计划

## 问题分析

### 错误信息
```
"message": "invalid input syntax for type uuid: \"人工智能基础概述\""
```

### 根本原因

数据库 `learning_path_nodes` 表的 `prerequisites` 字段定义为 `UUID[]` 类型：
```sql
prerequisites UUID[] DEFAULT '{}',
```

但在 AI 生成学习路径时（[learningPaths.ts:774](file:///d:/KnowledgeMap/api/routes/learningPaths.ts#L774)），直接使用了 AI 返回的 `item.prerequisites`：

```typescript
stages.push({
  // ...
  prerequisites: item.prerequisites || [],  // AI 返回的可能是节点标题，而非 UUID
  // ...
});
```

AI 返回的 JSON 中，`prerequisites` 字段是节点标题（如 "人工智能基础概述"），而不是 UUID。这导致在保存到数据库时，PostgreSQL 拒绝了这个非法的 UUID 格式。

### 问题位置

1. **AI 响应处理** - [learningPaths.ts:739-781](file:///d:/KnowledgeMap/api/routes/learningPaths.ts#L739-L781)
   - AI 返回的 `item.prerequisites` 可能是节点标题数组
   - 没有将标题转换回对应的 UUID

2. **数据保存** - [learningPaths.ts:606-614](file:///d:/KnowledgeMap/api/routes/learningPaths.ts#L606-L614)
   - `validStages` 的 `prerequisites` 直接传递给数据库
   - 没有验证 `prerequisites` 是否为有效的 UUID 格式

## 解决方案

### 方案一：在 AI 响应处理时转换 prerequisites（推荐）

在 `generateAIPath` 函数中，将 AI 返回的节点标题映射为 UUID：

```typescript
// 在 generateAIPath 函数中添加标题到 UUID 的映射
const titleToNodeId = new Map(nodes.map((n) => [n.title.toLowerCase(), n.id]));

// 处理每个 stage 的 prerequisites
const mappedPrerequisites = (item.prerequisites || []).map((prereq: string) => {
  // 如果已经是 UUID 格式，直接返回
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(prereq)) {
    return prereq;
  }
  // 否则尝试通过标题查找 UUID
  return titleToNodeId.get(prereq.toLowerCase()) || null;
}).filter((id): id is string => id !== null);
```

### 方案二：在保存前过滤无效的 prerequisites

在保存 `validStages` 时，过滤掉非 UUID 格式的 prerequisites：

```typescript
nodes: validStages.map((stage, index) => ({
  // ...
  prerequisites: stage.prerequisites.filter(id => 
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  ),
})),
```

## 实施步骤

1. **修改 `generateAIPath` 函数**
   - 创建节点标题到 UUID 的映射
   - 处理 AI 返回的 `prerequisites`，将标题转换为 UUID
   - 过滤掉无法匹配的 prerequisites

2. **添加防御性检查**
   - 在保存前验证 `prerequisites` 数组中的每个元素都是有效的 UUID

3. **测试验证**
   - 运行现有的学习路径生成测试
   - 验证 AI 生成的路径可以正确保存

## 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `api/routes/learningPaths.ts` | 修改 `generateAIPath` 函数，处理 prerequisites 转换 |
