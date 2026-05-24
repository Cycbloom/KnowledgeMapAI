# Embedding 操作排除于默认统计之外 Plan

## 问题诊断

### 当前行为

审计面板顶部有 4 个 **StatCard**（总请求数 / 总 tokens / 总费用 / 平均耗时），它们的数据来源是：

```tsx
// PerformanceTab.tsx 第 935-968 行
{stats && (
  <StatCard value={String(stats.totalRequests)} />   // ← 来自后端 fetchStats()
  <StatCard value={formatTokens(stats.totalTokens)} />
  <StatCard value={formatCost(stats.totalCost)} />
  <StatCard value={formatDuration(stats.avgDuration)} />
)}
```

而 `stats` 是通过 `useAIPerformanceStore.fetchStats()` 从后端获取的，后端 `performanceMonitor.getStats()` 基于**所有日志**（包括 embedding）计算。

### 过滤的不一致性

| 区域 | 数据来源 | 是否过滤 Embedding |
|------|----------|:---:|
| Session 组列表 | `filteredLogs` | ✅ 正确过滤 |
| 独立请求列表 | `filteredLogs` | ✅ 正确过滤 |
| 操作筛选下拉框 | `filteredUniqueOperations` | ✅ 正确过滤 |
| **StatCard 统计卡片** | **后端 `stats`** | ❌ **未过滤！** |

### 用户期望

当用户**未勾选**"显示 Embedding 操作"时：
- 列表区域：不显示 embedding ✅（已实现）
- **StatCard 统计**：也不应包含 embedding 的请求数/tokens/费用 ❌（当前缺失）
- 当用户**勾选**显示 embedding 时：统计应包含 embedding

## 实施方案

### 策略：前端基于 `filteredLogs` 计算本地统计

不修改后端，在前端从 `filteredLogs` 中实时计算出统计值，替换后端返回的 `stats`。

### Step 1: 新增前端本地统计计算

**文件**: `src/components/Console/PerformanceTab.tsx`

在 `filteredLogs` 定义之后（约第 753 行），新增一个 `useMemo` 计算 `displayStats`：

```typescript
const displayStats = useMemo(() => {
  const total = filteredLogs.length;
  const successCount = filteredLogs.filter((l) => l.success).length;
  const failedCount = total - successCount;
  const totalTokens = filteredLogs.reduce((sum, l) => sum + l.totalTokens, 0);
  const totalCost = filteredLogs.reduce((sum, l) => sum + l.estimatedCost, 0);
  const totalDuration = filteredLogs.reduce((sum, l) => sum + l.duration, 0);
  const nonEmbeddingFiltered = filteredLogs.filter(
    (l) => !isEmbeddingOperation(l.operation),
  );
  const avgDuration =
    nonEmbeddingFiltered.length > 0
      ? nonEmbeddingFiltered.reduce((sum, l) => sum + l.duration, 0) /
        nonEmbeddingFiltered.length
      : 0;

  return { total, successCount, failedCount, totalTokens, totalCost, avgDuration };
}, [filteredLogs]);
```

**设计要点**：
- `avgDuration` 排除 embedding 操作（与后端 `getStats()` 中的 `nonEmbeddingLogs` 逻辑一致）
- 所有其他指标均基于 `filteredLogs`，自动响应 `showEmbeddingOps` 开关

### Step 2: 替换 StatCard 数据源

将 StatCard 区域的数据源从 `stats`（后端）改为 `displayStats`（前端本地）：

```tsx
{stats && (
  <div className="grid grid-cols-4 ...">
    <StatCard
      label={t('console.performance.stats.totalRequests')}
      value={String(displayStats.total)}
      subValue={`${displayStats.successCount}/${displayStats.failedCount}`}
      ...
    />
    <StatCard
      label={t('console.performance.stats.tokens')}
      value={formatTokens(displayStats.totalTokens)}
      ...
    />
    <StatCard
      label={t('console.performance.stats.cost')}
      value={formatCost(displayStats.totalCost)}
      ...
    />
    <StatCard
      label={t('console.performance.stats.duration')}
      value={formatDuration(displayStats.avgDuration)}
      ...
    />
  </div>
)}
```

注意：保留 `{stats && (` 外层条件判断不变（用于控制整个 StatCard 区域的显隐）。

### Step 3: 验证

- 运行 `npm run check` — 类型检查通过
- 运行 `npm run lint` — 代码规范检查

## 影响范围

仅修改 **1 个文件**：`src/components/Console/PerformanceTab.tsx`

| 变更 | 说明 |
|------|------|
| 新增 `displayStats` useMemo | 基于 filteredLogs 计算本地统计 |
| 替换 4 个 StatCard 的数据源 | stats → displayStats |

## 预期效果

**未勾选"显示 Embedding"时**：
```
┌──────────┬──────────┬──────────┬──────────┐
│ 📊 12请求 │ ⚡ 45K tokens │ 💰 ¥0.028 │ ⏱️ 8.5s   │  ← 不含 embedding
└──────────┴──────────┴──────────┴──────────┘
```

**勾选"显示 Embedding"后**：
```
┌──────────┬──────────┬──────────┬──────────┐
│ 📊 156请求│ ⚡ 320K tokens│ 💰 ¥0.185 │ ⏱️ 3.2s   │  ← 包含 embedding
└──────────┴──────────┴──────────┴──────────┘
```
