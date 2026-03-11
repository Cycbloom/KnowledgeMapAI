# 修复学习路径自动排程只生成一个子任务的问题

## 问题分析

### 根本原因

在 `autoSchedulePath` 方法中，节点排序逻辑存在问题：

**当前代码** ([learningPathService.ts:1860-1864](file:///d:/KnowledgeMap/api/services/learningPathService.ts#L1860-L1864)):
```typescript
const sortedNodes = [...nodes].sort((a, b) => {
  const aHasDeps = (a.prerequisites?.length ?? 0) > 0 ? 1 : 0;
  const bHasDeps = (b.prerequisites?.length ?? 0) > 0 ? 1 : 0;
  return aHasDeps - bHasDeps;
});
```

这只是简单地按照"是否有依赖"排序，**不是拓扑排序**！

### 问题示例

假设学习路径有 3 个节点：
- 节点 C：无依赖
- 节点 B：依赖于 C
- 节点 A：依赖于 B

当前排序结果可能是：`C, A, B`（C 没有依赖排前面，A 和 B 都有依赖，相对顺序不确定）

处理流程：
1. C: 无依赖，调度成功 → `scheduledNodes = {C}`
2. A: 检查依赖 B → B 不在 scheduledNodes → **跳过**
3. B: 检查依赖 C → C 在 scheduledNodes → 调度成功 → `scheduledNodes = {C, B}`

**结果**：只有 C 和 B 被调度，A 被跳过！

### 正确的拓扑排序

正确的顺序应该是：`C, B, A`

处理流程：
1. C: 无依赖，调度成功
2. B: 依赖 C（已调度），调度成功
3. A: 依赖 B（已调度），调度成功

**结果**：所有节点都被正确调度

---

## 修复方案

### 修改文件

**文件**: `api/services/learningPathService.ts`

### 修改内容

将简单的"是否有依赖"排序替换为拓扑排序：

```typescript
const topologicalSort = (
  nodes: LearningPathNode[],
): LearningPathNode[] => {
  const result: LearningPathNode[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const visit = (nodeId: string): boolean => {
    if (visited.has(nodeId)) return true;
    if (visiting.has(nodeId)) return false; // 检测到循环依赖

    visiting.add(nodeId);
    const node = nodeMap.get(nodeId);
    if (node && node.prerequisites) {
      for (const depId of node.prerequisites) {
        if (!visit(depId)) return false;
      }
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    if (node) result.push(node);
    return true;
  };

  for (const node of nodes) {
    visit(node.id);
  }

  return result;
};

const sortedNodes = topologicalSort(nodes);
```

---

## 测试验证

修复后，所有具有依赖关系的节点都应被正确调度。

---

## 文件修改清单

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `api/services/learningPathService.ts` | 修改 | 替换排序逻辑为拓扑排序 |
