# 迁移脚本 + 提示词集成计划

## 问题 1：远程数据库迁移脚本

远程 Supabase 数据库需要以下变更：

### Schema 变更
1. `templates` 表添加 `template_type` 列
2. `templates` 表 `category` CHECK 约束更新（旧值 → 新值）
3. 新增索引 `idx_templates_template_type`
4. 列注释更新

### 数据变更
1. 更新现有模板的 `category` 和 `template_type`
2. 插入新的系统模板（5 个）
3. 更新 `template_generation` 提示词模板（添加 `templateType` 变量）

---

## 问题 2：模板类型未集成到提示词系统 ⚠️ 严重

### 发现的问题

`templateGeneratorService.ts` 的 `buildSystemPrompt` 方法虽然向 `promptService.getRenderedPrompt` 传递了 `templateType` 变量，但**数据库中的 `template_generation` 提示词模板没有 `{{templateType}}` 或 `{{templateTypeGuidance}}` 占位符**。

这意味着：
- `templateType` 被传入但被**静默忽略**
- 18 种模板类型的详细指导（`templateTypeGuides`）只在 **fallback 路径**中生效
- 由于数据库有 `template_generation` 提示词，`getRenderedPrompt` 返回非空字符串，**永远不会走到 fallback 路径**
- **结果：模板类型选择对 AI 生成结果没有任何影响！**

### 修复方案

1. **更新数据库中的 `template_generation` 提示词**：添加 `{{#if templateType}}` 条件块
2. **修改 `templateGeneratorService.ts`**：将 `templateTypeGuides`、`categoryGuides`、`layoutGuides` 的解析提前到 `getRenderedPrompt` 调用之前，将解析后的文本作为变量传入

---

## 实施步骤

### Step 1: 修改 `templateGeneratorService.ts` 的 `buildSystemPrompt` 方法
- 将 `templateTypeGuides`、`categoryGuides`、`layoutGuides` 的定义移到 `getRenderedPrompt` 调用之前
- 向 `getRenderedPrompt` 传递 `templateTypeGuidance`、`categoryGuidance`、`layoutGuidance` 变量
- 保留 fallback 路径不变

### Step 2: 更新本地种子数据中的 `template_generation` 提示词
- 在 `00000000000001_initial_seed.sql` 中，给 `template_generation` 提示词添加：
```
{{#if templateType}}
## Template Type Guidance
You are creating a "{{templateType}}" type graph. Follow this specific guidance:
{{templateTypeGuidance}}
{{/if}}
```

### Step 3: 生成远程数据库迁移 SQL 脚本
- 包含所有 ALTER TABLE、UPDATE、INSERT 语句
- 用户直接在 Supabase Dashboard 执行

### Step 4: 运行类型检查验证
