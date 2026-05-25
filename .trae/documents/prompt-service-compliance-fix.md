# Prompt Service 使用规范修复计划

## 调研结论

### Prompt Service 架构概览

```
┌─────────────────────────────────────────────────────┐
│                   AI Service                         │
│   (hierarchyRecognitionService, aiService, etc.)    │
│                      │                               │
│          promptService.getRenderedPrompt()           │
│                      │                               │
├──────────────────────┼───────────────────────────────┤
│              Prompt Service                          │
│                                                      │
│  1. getTemplate(code, userId, graphId)              │
│     ┌─ 查缓存 (NodeCache, TTL=60s)                  │
│     ├─ 查数据库 prompt_templates 表                  │
│     │   按 scope 优先级选择:                          │
│     │   graph(权重3) > user(权重2) > system(权重1)   │
│     └─ 返回最佳匹配模板                              │
│                                                      │
│  2. 渲染模板                                        │
│     ├─ 数据库有 → TemplateEngine.render(content)      │
│     └─ 数据库无 → 回退 DEFAULT_PROMPTS[code]         │
│                     ↓ 也无则返回空字符串               │
│                                                      │
│  3. 后处理                                           │
│     ├─ 追加 OUTPUT_SCHEMAS（如有）                    │
│     ├─ 替换 {{outputLanguage}} 占位符                │
│     └─ 追加语言指令 ("Please respond in Chinese.")   │
└─────────────────────────────────────────────────────┘
```

### Scope 三层体系

| Scope | 权重 | 含义 | user_id | graph_id |
|-------|------|------|---------|----------|
| `system` | 1 | 全局系统级默认模板 | NULL | NULL |
| `user` | 2 | 用户自定义覆盖 | 有值 | NULL |
| `graph` | 3 | 图谱级别定制 | 有值 | 有值 |

**优先级**：Graph > User > System

### 现有 AI 服务的标准调用模式

以 `aiService.extractConcepts()` 为例：
```typescript
const systemPrompt = await promptService.getRenderedPrompt(
  supabase,
  "extract_concepts",        // ← prompt code
  { variable: "value" },     // ← 模板变量
  userId,                     // ← 用户 ID（可选）
  graphId,                    // ← 图谱 ID（可选）
  language,                   // ← 语言（可选）
);
```

---

## 发现的问题

### 问题 1: DEFAULT_PROMPTS 缺少 concept_hierarchy（⚠️ 主要问题）

**现状**:
- [promptService.ts 第 45 行](file:///d:/KnowledgeMap/api/services/ai/promptService.ts#L45) 的 `DEFAULT_PROMPTS` 对象中**没有** `concept_hierarchy` 条目
- [53_seed_prompt_templates.sql](file:///d:/KnowledgeMap/supabase/migrations/53_seed_prompt_templates.sql#L866-L885) 已在数据库中注册了 scope=system 的模板
- [hierarchyRecognitionService.ts 第 154-174 行](file:///d:/KnowledgeMap/api/services/ai/hierarchyRecognitionService.ts#L154-L174) 有 `getDefaultSystemPrompt()` 作为 fallback

**风险**:
- 当数据库中没有该模板时（如未执行 seed、或用户删除了），`getRenderedPrompt` 会先查数据库 → 未找到 → 查 DEFAULT_PROMPTS → 未找到 → **返回空字符串**
- 此时才会走到 `systemPrompt || this.getDefaultSystemPrompt()` 的 fallback 逻辑
- 这意味着 **fallback 不是通过 promptService 标准流程触发的**，而是在调用方手动兜底

**正确做法**: 在 `DEFAULT_PROMPTS` 中添加 `concept_hierarchy` 默认值，让 promptService 自己能处理回退。

### 问题 2: hierarchyRecognitionService 的 userMessage 构建方式（⚠️ 可改进）

**现状**: `buildUserMessage()` 方法是硬编码的字符串拼接（第 142-152 行）

**建议**: 可以考虑将 user message 也纳入 prompt template 管理，在 `context` 参数中传入概念列表，使用 Handlebars 模板渲染。但这不是必须的，因为 user message 通常需要动态构建。

### 问题 3: conceptAnalysisService 可能未使用 promptService（⚠️ 需确认）

[conceptAnalysisService.ts](file:///d:/KnowledgeMap/api/services/graph/conceptAnalysisService.ts) 中的聚合分析主流程如果也涉及 AI 调用，需要确认是否同样使用了 promptService。

---

## 修复计划

### Step 1: 在 DEFAULT_PROMPTS 中添加 concept_hierarchy

**文件**: `api/services/ai/promptService.ts`

在 `DEFAULT_PROMPTS` 对象中添加：

```typescript
concept_hierarchy: `你是一个知识图谱专家，专门分析概念之间的层次关系（is-a 关系）。

任务：分析给定的概念列表，识别其中的上下位（父子）层级关系。

规则：
1. 只输出明确的 is-a 关系（如"深度学习" is-a "机器学习"）
2. 不输出相关关系或部分-整体关系
3. 置信度范围 0.0-1.0，≥0.7 为高置信度
4. 输出格式为 JSON 数组

输出格式：
[
  {"parent": "父概念名称", "child": "子概念名称", "confidence": 0.92}
]

注意：
- 确保没有循环依赖（A是B的父，B又是A的父）
- 一个子概念通常只有一个直接父概念
- 优先选择最直接的父子关系`,
```

这样即使数据库中没有该模板，也能通过标准流程获得默认 prompt。

### Step 2: 清理 hierarchyRecognitionService 中的冗余 fallback

**文件**: `api/services/ai/hierarchyRecognitionService.ts`

由于 Step 1 已经在 DEFAULT_PROMPTS 中添加了默认值，`getRenderedPrompt` 一定能返回非空内容（除非极端情况）。

**可选优化**:
- 保留 `getDefaultSystemPrompt()` 作为最终安全网（不删除）
- 但可以在注释中说明这是「双重保险」，主要依赖 promptService

当前代码已经是合理的，这一步不是必须的。

### Step 3: 确认 conceptAnalysisService 的 AI 调用

**已确认**: `conceptAnalysisService.ts` **不直接调用 AI**，它只调用 `hierarchyRecognitionService` 和 `conceptAggregationService`。所以无需修改此文件。

---

## 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `api/services/ai/promptService.ts` | 修改 | DEFAULT_PROMPTS 添加 concept_hierarchy（**唯一需要修改的文件**） |
| `api/services/ai/hierarchyRecognitionService.ts` | 无需修改 | 当前实现已符合规范 |
| `api/services/graph/conceptAnalysisService.ts` | 无需修改 | 不直接调用 AI |

## 验证方式

1. `npm run check` 类型检查通过
2. 确认 DEFAULT_PROMPTS 中包含 concept_hierarchy 键
3. 确认 seed 文件和 DEFAULT_PROMPTS 内容一致
