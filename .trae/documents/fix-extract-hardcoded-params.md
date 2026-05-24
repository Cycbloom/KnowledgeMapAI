# 修复文献提取参数硬编码问题

## 🎯 问题总结

用户在前端设置了 **maxConcepts=50**，但实际只返回 **9-10 个概念**。原因是参数在传递链路中被 **4 处硬编码默认值** 层层覆盖。

### 硬编码链路

```
前端设置: maxConcepts=50, threshold=0.7
    ↓
❌ api/routes/literature.ts:471  →  || 10   → 变成 10
    ↓
❌ conceptExtractorService.ts:170 → || 10   → 还是 10
    ↓
❌ aiService.ts:1499           → || 5    → 变成 5！
    ↓
❌ promptService.ts 文献提取prompt → 没有使用动态值
```

## 📋 修改计划

### Step 1: 修复 API 路由层硬编码

**文件**: `api/routes/literature.ts` 第 471 行

**当前代码**:
```typescript
maxConcepts: parsedOptions?.maxConcepts || 10,  // ❌ 硬编码 10
```

**修改为**:
```typescript
maxConcepts: parsedOptions?.maxConcepts ?? 50,     // ✅ 使用前端值，fallback 50
similarityThreshold: parsedOptions?.similarityThreshold ?? 0.7,
```

> 注意：使用 `??` 而非 `||`，这样前端传 0 时不会被覆盖

---

### Step 2: 修复提取服务层硬编码

**文件**: `api/services/ai/conceptExtractorService.ts` 第 170 行

**当前代码**:
```typescript
const maxConcepts = options.maxConcepts || 10;  // ❌ 硬编码 10
```

**修改为**:
```typescript
const maxConcepts = options.maxConcepts ?? 20;  // ✅ 使用传入值，fallback 20
```

同时确认第 202 行的 prompt 模板已正确使用该变量（已确认：`${maxConcepts}` ✅）

---

### Step 3: 修复 AI 服务层硬编码

**文件**: `api/services/ai/aiService.ts` 第 1499 行

**当前代码**:
```typescript
maxConcepts: options.maxConcepts || 5,  // ❌ 硬编码 5！最严重
```

**修改为**:
```typescript
maxConcepts: options.maxConcepts ?? 20,  // ✅ 使用传入值
```

---

### Step 4: 增强文献提取 Prompt Schema

**文件**: `api/services/ai/promptService.ts` 第 209-227 行

**当前问题**: 文献提取 prompt (`literature_concept_extraction`) 是**静态字符串**，没有注入 `maxConcepts` 参数，也没有明确的数量约束指令。

**修改方案**: 在 prompt 末尾添加动态数量要求：

将第 209-227 行的静态 prompt 改为**函数**或在使用处动态拼接：

```typescript
// 方案A: 在 conceptExtractorService 的 buildExtractionPrompt 中追加
// (已有 `${maxConcepts} 个最重要的概念` 在第202行，✅ 已正确)
// 只需确保这个 prompt 被实际使用
```

**验证**: 确认 `conceptExtractorService.ts:323-324` 调用 `getRenderedPrompt("literature_concept_extraction", { maxConcepts })` 时，变量被正确传入。

如果 `literature_concept_extraction` 是静态模板不接收变量，需要改为：
- 在模板中添加 `{{maxConcepts}}` 占位符
- 或在 `buildExtractionPrompt` 追加一行：`\n\n请严格返回恰好 ${maxConcepts} 个概念，不要多也不要少。`

---

### Step 5: 前端新增"推荐数量"选项（可选增强）

**文件**: `src/components/LiteratureExtract/LiteratureExtractPanel.tsx`

在高级选项区域新增一个 **"推荐数量" (topK)** 滑块/输入框：

| 参数 | 说明 | 默认值 | 范围 |
|------|------|--------|------|
| `maxConcepts` | AI 提取的最大概念数 | 20 | 5-100 |
| `topK` | 最终展示的核心概念数 | 15 | 5-maxConcepts |

**UI 位置**: 在现有高级选项中，紧跟"最大概念数"之后

**传递方式**: 通过 API 的 `parsedOptions` 传给后端

---

## 🔧 具体修改清单

| # | 文件 | 行号 | 修改内容 |
|---|------|------|----------|
| 1 | `api/routes/literature.ts` | 471 | `\|\| 10` → `?? 50`，threshold 加 fallback |
| 2 | `api/services/ai/conceptExtractorService.ts` | 170 | `\|\| 10` → `?? 20` |
| 3 | `api/services/ai/aiService.ts` | 1499 | `\|\| 5` → `?? 20` |
| 4 | `api/services/ai/promptService.ts` | 209-227 | 确保 prompt 包含动态数量约束 |
| 5 | `src/components/LiteratureExtract/LiteratureExtractPanel.tsx` | 高级选项区 | 新增 topK 参数 UI |

## ⚠️ 注意事项

1. **使用 `??` 而非 `||`**：`||` 会把 `0`、`false`、`""` 视为 falsy 并覆盖
2. **Fallback 值要合理**：建议 fallback 到 20（不是 10 或 5）
3. **保持向后兼容**：如果不传参数，仍然有合理的默认行为
4. **Prompt 中明确数量**：让 AI 知道确切要返回多少个

## ✅ 验证方法

修改后测试：
1. 前端设置 maxConcepts=50 → 实际应返回接近 50 个概念
2. 前端设置 maxConcepts=10 → 应返回约 10 个
3. 不设置时 → 应返回 fallback 值（~20）个
4. threshold 参数同样应生效（过滤低置信度结果）
