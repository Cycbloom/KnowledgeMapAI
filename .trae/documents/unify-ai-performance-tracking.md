# 统一 AI 性能追踪器为单套 Plan

## 现状：三套并存的混乱局面

当前项目中存在 **3 套** AI 性能追踪包装函数：

| # | 函数名 | 定义位置 | 导出？ | 调用方数量 | 特点 |
|---|--------|----------|--------|------------|------|
| A | `withPerformanceTracking` | [aiService.ts:89](api/services/ai/aiService.ts#L89) | ❌ 内部 | **11 处**（均在 aiService.ts 内） | 完整版，使用结构化 `PerformanceTrackingOptions` 类型 |
| B | `withAIPerformanceTracking` | [performanceTracker.ts:6](api/services/ai/utils/performanceTracker.ts#L6) | ✅ 已导出 | **5 处**（conceptExtractorService ×3 + literatureMetadataService ×2） | 刚升级为完整版，使用泛型 `Record` metadata |
| C | `withLiteratureTracking` | [literature.ts:42](api/routes/literature.ts#L42) | ❌ 路由内部 | **1 处**（literature.ts `/extract`） | 特殊版：totalTokens=0 时跳过记录 |

### 功能对比（升级后）

| 能力 | A套 | B套 | C套 |
|------|:---:|:---:|:---:|
| `calculateDetailedCost` | ✅ | ✅ | ✅ |
| 传 `costBreakdown` | ✅ | ✅ | ✅ |
| 传 `cachedInputTokens` | ✅ | ✅ | ✅ |
| 传 `sessionId` | ✅ | ✅ | ✅ |
| 0 token 跳过记录 | ❌ | ❌ | ✅ |

**结论**：三套函数功能已等价（上次修改后），仅存在**代码重复和维护负担**。

## 统一方案

### 策略：保留 B 套为唯一标准，删除 A 套和 C 套

**选择 B 套的理由**：
1. 已导出，被多个服务共用
2. 位于独立的 utils 目录，职责清晰
3. metadata 使用 `Record<string, unknown>` 泛型类型，比 A 套的结构化接口更灵活

### Step 1: 升级 B 套的 Options 类型（可选增强）

将 B 套的 inline options 类型提取为导出的接口，方便复用和 IDE 提示：

**文件**: `api/services/ai/utils/performanceTracker.ts`

```typescript
export interface AIPerformanceTrackingOptions {
  operation: string;
  provider: AIProviderType;
  model: string;
  metadata?: Record<string, unknown>;
  sessionId?: string;
}
```

函数签名改为使用该接口。

### Step 2: 在 aiService.ts 中用 B 套替换 A 套

**文件**: `api/services/ai/aiService.ts`

1. 新增导入：
   ```typescript
   import { withAIPerformanceTracking } from "./utils";
   ```

2. 将内部 `withPerformanceTracking` 函数定义（第 89-165 行）**整体删除**

3. 将所有 11 处 `withPerformanceTracking(` 调用替换为 `withAIPerformanceTracking(`：
   - 行 391: chat 操作
   - 行 635: generateCards 操作
   - 行 819: generateGraph / auto_graph_init
   - 行 972: expandNode / auto_graph_expand
   - 行 1090: discover_relations
   - 行 1197: generate_content / generate_content_stream
   - 行 1315: text_to_graph / document_to_graph / image_to_graph
   - 行 1401: ai_action_execute
   - 行 1507: template_generation
   - 行 1639: recursive_graph_init / recursive_graph_expand
   - 行 1792: 其他操作

4. 同时删除不再需要的：
   - `PerformanceTrackingOptions` 接口定义（第 36-52 行）
   - `extractTokenUsage` 函数（第 54-87 行）— 已在 `tokenUtils.ts` 中有相同实现

### Step 3: 在 literature.ts 中用 B 套替换 C 套

**文件**: `api/routes/literature.ts`

1. 新增导入：
   ```typescript
   import { withAIPerformanceTracking } from "../services/ai/utils";
   ```

2. 删除 `withLiteratureTracking` 函数定义（第 42-129 行）

3. 将行 484 的调用从：
   ```typescript
   const extractionResult = await withLiteratureTracking(
     "literature_extract", ...,
     enrichMetadata(...),
     sessionId,
   );
   ```
   改为直接调用 `conceptExtractorService.extractConcepts()`（去掉包装器），因为现在 extractConcepts 内部已经通过 `withAIPerformanceTracking` 正确记录了完整数据，不需要外层再包一层。如果仍需要 session 汇总统计的"空壳记录"行为（0 token 跳过），则保留一个简化版的包装逻辑。

### Step 4: 清理冗余代码

- 确认 `extractTokenUsage` 在 `tokenUtils.ts` 中的实现与 A 套中的一致（应该一致，因为 B 套已经在用它了）
- 如果 aiService.ts 中没有其他地方引用 `PerformanceTrackingOptions` 或 `withPerformanceTracking`，确认清理干净

### Step 5: 验证

- 运行 `npm run check` — 类型检查通过
- 运行 `npm run lint` — 代码规范检查

## 影响范围

| 文件 | 变更类型 |
|------|----------|
| `api/services/ai/utils/performanceTracker.ts` | **改** — 提取导出 Options 接口 |
| `api/services/ai/aiService.ts` | **改** — 删除 A 套定义 + 11 处调用替换 + 删除冗余类型/函数 |
| `api/routes/literature.ts` | **改** — 删除 C 套定义 + 1 处调用替换 |
| `api/services/ai/conceptExtractorService.ts` | 不变（已在用 B 套） |
| `api/services/ai/literatureMetadataService.ts` | 不变（已在用 B 套） |

## 统一后的最终状态

```
唯一入口: withAIPerformanceTracking (performanceTracker.ts)
  ├── aiService.ts (11 处调用) ← 从 A 套迁移
  ├── conceptExtractorService.ts (3 处调用) ← 已经是 B 套
  ├── literatureMetadataService.ts (2 处调用) ← 已经是 B 套
  └── literature.ts (1 处调用) ← 从 C 套迁移
```

**收益**：
- 消除 ~120 行重复代码
- 未来修改追踪逻辑只需改一处
- 统一的定价计算和日志格式
