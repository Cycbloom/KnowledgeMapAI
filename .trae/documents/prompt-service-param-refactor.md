# Prompt Service 参数化改造计划：概念数量约束

## 问题分析

### 当前架构（两层结构）

Prompt Service 分为两个部分：

| 层级 | 存储位置 | 可编辑性 | 用途 |
|------|----------|----------|------|
| **提示词模板 (Template)** | 数据库 `prompt_templates` 表 / `DEFAULT_PROMPTS` 备用 | ✅ 用户可编辑 | 任务描述、提取原则、行为指导 |
| **输出格式 (Schema)** | 代码中 `OUTPUT_SCHEMAS` 常量 | ❌ 固定不可编辑 | JSON 结构定义、字段约束、数量限制 |

调用链：
```
promptService.getRenderedPrompt(code, context)
  → 1. 从 DB 获取模板（Graph > User > System 优先级）
  → 2. 用 Handlebars 渲染 {{变量}}
  → 3. 自动追加 OUTPUT_SCHEMAS[code]（固定 schema）
```

### 当前文献提取的问题

**问题1：Schema 重复拼接**

[conceptExtractorService.ts:355-357](../api/services/ai/conceptExtractorService.ts#L355-L357) 中：
```typescript
const systemPrompt = await promptService.getRenderedPrompt(...);  // ← 内部已追加 OUTPUT_SCHEMAS
const schema = buildExtractionSchema(maxConcepts);                // ← 又生成一个 schema

const finalSystemPrompt = systemPrompt
    ? `${systemPrompt}\n\n${schema}`     // ← schema 被拼接了两次！
    : `${fallbackPrompt}\n\n${schema}`;
```

当使用 DB 模板时，AI 收到 **两份 JSON schema**，可能造成混乱。

**问题2：数量约束硬编码在 4 个地方**

| 位置 | 内容 | 是否使用变量 |
|------|------|-------------|
| [OUTPUT_SCHEMAS](../api/services/ai/promptService.ts#L723-L746) | `"Extract 5-15 concepts"` | ❌ 硬编码 |
| [buildExtractionSchema()](../api/services/ai/conceptExtractorService.ts#L277) | `"恰好包含 ${maxConcepts} 个"` | ⚠️ 只有硬上限 |
| [buildExtractionPrompt()](../api/services/ai/conceptExtractorService.ts#L202) | `"约 ${preferredCount} 个（不超过 ${maxConcepts}）"` | ✅ 刚加的（仅 fallback 路径） |
| [DB Seed 模板](../supabase/migrations/53_seed_prompt_templates.sql#L761-L809) | 无数量相关文字 | ❌ 完全没有 |

**问题3：preferredCount 变量传递了但没被使用**

[conceptExtractorService.ts:331](../api/services/ai/conceptExtractorService.ts#L331) 把 `preferredCount` 传给了 promptService 的 context，但：
- DB 模板中没有 `{{preferredCount}}` 占位符
- OUTPUT_SCHEMAS 中也没有 `{{preferredCount}}`
- **只有走 fallback 路径时才生效**

---

## 改造方案

### 核心思路

将数量约束参数统一通过 Prompt Service 的 **模板变量机制** 管理：

- **提示词模板层**：负责「怎么提取」（行为指导），不涉及具体数字
- **输出格式 Schema 层**：负责「返回什么格式 + 多少个」（数据约束），使用 `{{变量}}`

### 改造步骤

#### Step 1：修改 OUTPUT_SCHEMAS — 使用模板变量替换硬编码

**文件**: [promptService.ts](../api/services/ai/promptService.ts) 的 `OUTPUT_SCHEMAS.literature_concept_extraction`

当前（硬编码）：
```
Important:
- Extract 5-15 concepts from the literature
```

改为（使用模板变量）：
```
重要约束：
- concepts 数组推荐包含约 {{preferredCount}} 个核心概念（软上限）
- concepts 数组绝对不超过 {{maxConcepts}} 个概念（硬上限）
- 按 importance 降序排列，最重要的概念排在前面
- 只提取文献中明确提到的概念
```

同时更新整个 schema 结构使其与 `buildExtractionSchema()` 保持一致（包含 relations 部分）。

#### Step 2：去掉重复的 buildExtractionSchema 拼接

**文件**: [conceptExtractorService.ts](../api/services/ai/conceptExtractorService.ts)

当前逻辑：
```typescript
const systemPrompt = await promptService.getRenderedPrompt(...);  // 已含 schema
const schema = buildExtractionSchema(maxConcepts);                // 额外 schema
finalSystemPrompt = systemPrompt ? systemPrompt + schema : fallback + schema;
```

改为：
```typescript
const systemPrompt = await promptService.getRenderedPrompt(...);  // 已含完整 schema（含变量渲染后的数量约束）

const finalSystemPrompt = systemPrompt
    ? systemPrompt          // 直接使用，不再额外拼 schema
    : `${fallbackPrompt}\n\n${buildExtractionSchema(maxConcepts, preferredCount)}`;  // fallback 路径保持原样
```

> `buildExtractionSchema()` 函数保留作为 fallback 路径专用，也同步加上 `preferredCount` 参数。

#### Step 3：同步更新 buildExtractionSchema（fallback 路径）

**文件**: [conceptExtractorService.ts](../api/services/ai/conceptExtractorService.ts)

函数签名改为：
```typescript
function buildExtractionSchema(maxConcepts: number = 20, preferredCount: number = 10): string {
```

schema 内部约束改为：
```
**重要约束**：
- concepts 数组推荐包含约 ${preferredCount} 个核心概念
- concepts 数组绝对不超过 ${maxConcepts} 个概念
- 按重要性从高到低排序
```

#### Step 4：（可选）DB Seed 模板增加数量指引

**文件**: [53_seed_prompt_templates.sql](../supabase/migrations/53_seed_prompt_templates.sql)

在 `literature_concept_extraction` 模板的「提取原则」部分后面增加一行：
```
## 数量要求
- 推荐提取约 {{preferredCount}} 个最核心的概念
- 最多不超过 {{maxConcepts}} 个概念
```

这样用户在 Supabase Studio 里编辑模板时也能看到和调整这些参数的含义。

---

## 改造后的数据流

```
前端 UI                    后端 API                  conceptExtractorService           Prompt Service
─────────                  ────────                  ──────────────────────           ─────────────
preferredCount=10  ──→  extractOptions  ──→  options.preferredCount=10
maxConcepts=50     ──→  .preferredCount  ──→  .maxConcepts=50
                                              │
                                              ▼
                                   getRenderedPrompt("literature_concept_extraction", {
                                     maxConcepts: 50,        ──→  渲染 {{maxConcepts}}
                                     preferredCount: 10,      ──→  渲染 {{preferredCount}}
                                     extractTypes: "..."
                                   })
                                              │
                                              ▼
                                   返回完整 prompt（已包含 schema + 渲染后的数量约束）
                                              │
                                              ▼
                                   finalSystemPrompt = systemPrompt（直接用，不再重复拼 schema）
```

---

## 影响范围

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `api/services/ai/promptService.ts` | 修改 | OUTPUT_SCHEMAS.literature_concept_extraction 使用 `{{preferredCount}}`/`{{maxConcepts}}` 变量 |
| `api/services/ai/conceptExtractorService.ts` | 修改 | 去掉重复 schema 拼接；`buildExtractionSchema` 增加 preferredCount 参数 |
| `supabase/migrations/53_seed_prompt_templates.sql` | 修改 | DB 模板可选增加数量要求段落 |

不需要改动的：
- ✅ 前端 `LiteratureExtractPanel.tsx` — 已完成
- ✅ API 路由 `api/routes/literature.ts` — 已完成
- ✅ 共享类型 `shared/types/graph.ts` — 已完成
- ✅ i18n 翻译文件 — 已完成
