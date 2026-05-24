# 文献提取审计面板三档定价显示修复 Plan

## 问题诊断

### 根因：`withAIPerformanceTracking` 是"精简版"，缺少完整定价数据

当前存在**两套** AI 性能追踪包装函数：

| 函数 | 位置 | 使用 `calculateDetailedCost`? | 传 `costBreakdown`? | 传 `cachedInputTokens`? |
|------|------|:---:|:---:|:---:|
| `withPerformanceTracking` | [aiService.ts:89](api/services/ai/aiService.ts#L89) | ✅ | ✅ | ✅ |
| `withAIPerformanceTracking` | [performanceTracker.ts:6](api/services/ai/utils/performanceTracker.ts#L6) | ❌ 用 `calculateCost` | ❌ | ❌ |

**文献提取的子步骤**（extractMetadata、extractConcepts、classifyConcept、locateBackboneModule）使用的是**精简版** `withAIPerformanceTracking`，导致：

1. **`costBreakdown` 为 undefined** — 前端 LogDetailModal 中的"📊 Token 详细分析（三档定价）"区块**不渲染**
2. **`cachedInputTokens` 等字段缺失** — 缓存命中率、缓存节省等数据全部丢失
3. **用户点击子请求详情时看不到三档定价**：缓存输入费 / 非缓存输入费 / 输出费

### 预期效果 vs 当前效果

用户点击文献提取 session 中某个子请求（如"提取概念"）后，应看到：
```
📊 Token 详细分析（三档定价）
  缓存输入    500 tokens     ¥0.0001
  非缓存输入  3,000 tokens   ¥0.0060
  输出        800 tokens     ¥0.0024
  ──────────────────────────────
  缓存命中率  14.3%    ████████░░░░
  缓存节省              -¥0.0010
```

但当前因为 `costBreakdown=undefined` 且 `cachedInputTokens=undefined`，整个区块**完全不显示**。

## 实施步骤

### Step 1: 升级 `withAIPerformanceTracking` 为完整版

**文件**: `api/services/ai/utils/performanceTracker.ts`

将 `withAIPerformanceTracking` 从精简版升级为与 `withPerformanceTracking`（aiService.ts）等价的完整版：

1. 新增变量声明：`cachedInputTokens`、`uncachedInputTokens`、`reasoningTokens`
2. 在 try 块中调用 `extractTokenUsage(usage)` 获取完整的 token 信息（而不是只取 inputTokens/outputTokens）
3. 将 `pricingService.calculateCost()` 替换为 `pricingService.calculateDetailedCost()`
4. 计算 `cacheHitRate`
5. 在 `performanceMonitor.recordLog()` 调用中补充以下字段：
   - `cachedInputTokens`
   - `uncachedInputTokens`
   - `reasoningTokens`
   - `cacheHitRate`
   - `costBreakdown`

修改后的 finally 块逻辑应与 [aiService.ts:130-163](api/services/ai/aiService.ts#L130-L163) 一致。

### Step 2: 验证

- 运行 `npm run check` 确认类型检查通过
- 运行 `npm run lint` 确认代码规范

## 影响范围

- 仅修改 1 个文件：`api/services/ai/utils/performanceTracker.ts`
- 所有使用 `withAIPerformanceTracking` 的地方自动受益：
  - `literatureMetadataService.extractMetadata` ✅
  - `conceptExtractorService.extractConcepts` ✅
  - `conceptExtractorService.classifyConcept` ✅
  - `conceptExtractorService.locateBackboneModule` ✅
  - 以及未来任何使用该工具函数的地方
