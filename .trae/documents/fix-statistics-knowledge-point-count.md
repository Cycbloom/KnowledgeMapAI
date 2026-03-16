# 统计中心知识点总数显示为0的问题分析与修复计划

## 问题分析

### 现象
统计中心的"知识点总数"显示为0，但用户的图谱中已经有知识点。

### 根本原因

在 `LearningStatsCenter.tsx` 中，知识点总数的计算逻辑如下：

```tsx
const allNodes = useMemo(() => {
  if (!graphsData) return [];
  return graphsData.flatMap((g: any) => 
    (g.nodes || []).map((n: any) => ({ ...n, graphTitle: g.title }))
  );
}, [graphsData]);

<QuickStatsCards 
  totalNodes={allNodes.length}  // 这里显示知识点总数
  ...
/>
```

**问题在于**：`graphsData` 来自 `useGraphs()` hook，它调用的是 `api.graphs.list` 接口。

查看 `graphService.listGraphs` 的返回数据结构：
- RPC 函数 `get_user_graphs_with_counts` 只返回 `nodes_count`（节点数量）
- fallback 函数 `listGraphsFallback` 也只返回 `nodes_count`，**不包含具体的 `nodes` 数组**

因此 `g.nodes` 始终是 `undefined`，导致 `allNodes` 为空数组，知识点总数显示为0。

### 数据流对比

| 统计项 | 数据来源 | 问题 |
|--------|----------|------|
| 知识点总数 | `useGraphs()` → `graphsData.flatMap(g => g.nodes)` | `g.nodes` 不存在，返回空数组 |
| 总卡片数 | `useStatistics()` → `study_cards` 表 | 正常工作 |
| 已掌握/今日待复习 | 同上，依赖 `allNodes` | 同样显示为0 |

## 修复方案

### 方案选择

有两种修复方案：

**方案A：修改前端统计逻辑**
- 直接使用 `nodes_count` 求和计算知识点总数
- 优点：简单快速，不需要额外API调用
- 缺点：无法获取详细的节点状态（已掌握、待复习等）

**方案B：添加专门的统计API**
- 创建新的后端API，一次性返回所有图谱的统计数据
- 优点：数据准确，性能更好
- 缺点：需要修改前后端

**推荐方案A**，因为：
1. 改动最小
2. 现有的 `useStatistics()` 已经提供了学习卡片相关的详细统计
3. `nodes_count` 已经可以满足"知识点总数"的显示需求

### 具体修改步骤

1. **修改 `LearningStatsCenter.tsx`**
   - 使用 `nodes_count` 计算知识点总数
   - 从 `useStatistics()` 获取已掌握/待复习数据

2. **修改 `Statistics.tsx`**（如果存在同样问题）
   - 同样的修复逻辑

## 实施步骤

### Step 1: 修改 LearningStatsCenter.tsx

修改知识点总数的计算方式：

```tsx
// 修改前
const allNodes = useMemo(() => {
  if (!graphsData) return [];
  return graphsData.flatMap((g: any) => 
    (g.nodes || []).map((n: any) => ({ ...n, graphTitle: g.title }))
  );
}, [graphsData]);

// 修改后
const totalNodesCount = useMemo(() => {
  if (!graphsData) return 0;
  return graphsData.reduce((sum: number, g: any) => sum + (g.nodes_count || 0), 0);
}, [graphsData]);
```

### Step 2: 更新 QuickStatsCards 调用

使用 `useStatistics()` 返回的数据来显示已掌握和今日待复习：

```tsx
<QuickStatsCards 
  totalNodes={totalNodesCount}
  masteredNodes={stats.metrics.learning}  // 从统计API获取
  dueToday={stats.metrics.dueToday}       // 从统计API获取
  streak={userData?.user?.profile?.study_streak || 0}
/>
```

### Step 3: 检查并修复 Statistics.tsx

如果 `Statistics.tsx` 存在同样的问题，进行相同的修复。

## 文件修改清单

1. `src/pages/LearningStatsCenter.tsx` - 修改知识点统计逻辑
2. `src/pages/Statistics.tsx` - 检查并修复（如需要）
