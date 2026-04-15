# 模板类型提示词自定义 Spec

## Why

用户目前无法自定义各模板类型的 AI 生成指导文本（如"知识树"应该怎么生成、"技能图谱"应该怎么生成）。现有的三级提示词系统（system/user/graph）已经支持其他提示词的自定义，但 `template_generation` 提示词中的模板类型指导（`templateTypeGuidance`）是硬编码在后端的，用户无法修改。需要将模板类型指导纳入三级提示词体系，让用户可以在现有提示词设置面板中自定义。

## What Changes

- 在 `prompt_templates` 表中为每种模板类型创建系统级提示词记录（code 为 `template_type_{type}`，如 `template_type_knowledge_tree`）
- 修改 `templateGeneratorService.ts` 的 `buildSystemPrompt` 方法，从 `promptService` 获取每种模板类型的指导文本，而非使用硬编码
- 在 `PromptSettingsPanel` 中添加"模板生成"分类，包含 18 个模板类型的提示词配置项
- 在 `promptScenarios.tsx` 中添加模板生成相关的场景定义
- 添加 i18n 翻译

## Impact

- Affected specs: redesign-ai-graph-creation-flow
- Affected code:
  - `api/services/ai/templateGeneratorService.ts` - 从 promptService 获取模板类型指导
  - `api/services/ai/promptService.ts` - 无需修改，已有 getRenderedPrompt 支持
  - `src/components/GraphEditor/panels/PromptSettingsPanel.tsx` - 添加模板生成分类
  - `src/components/PromptConfig/promptScenarios.tsx` - 添加模板生成场景
  - `src/i18n/locales/zh-CN.json` - 新增翻译
  - `src/i18n/locales/en-US.json` - 新增翻译
  - `supabase/migrations/00000000000001_initial_seed.sql` - 添加模板类型提示词种子数据
  - `supabase/migrations/remote_migration_template_refactor.sql` - 远程迁移脚本更新

## ADDED Requirements

### Requirement: 模板类型指导提示词数据库化

系统 SHALL 将 18 种模板类型的指导文本存储在 `prompt_templates` 表中，使用 code 格式 `template_type_{type}`（如 `template_type_knowledge_tree`），scope 为 `system`，使其支持三级优先级覆盖。

#### Scenario: 系统级模板类型提示词

- **WHEN** 系统初始化
- **THEN** `prompt_templates` 表中存在 18 条系统级记录，code 分别为 `template_type_knowledge_tree`、`template_type_skill_map` 等
- **AND** 每条记录的 `template_content` 包含该模板类型的 AI 生成指导文本
- **AND** `scope` 为 `system`，`user_id` 为 NULL

#### Scenario: 用户级覆盖

- **WHEN** 用户在提示词设置中自定义了 `template_type_knowledge_tree` 的指导文本
- **THEN** 系统在生成知识树类型的图谱时使用用户自定义的指导文本
- **AND** 其他模板类型不受影响

#### Scenario: 图谱级覆盖

- **WHEN** 用户在某个图谱的设置中自定义了 `template_type_knowledge_tree` 的指导文本
- **THEN** 该图谱生成知识树类型时使用图谱级指导文本
- **AND** 其他图谱不受影响

### Requirement: templateGeneratorService 从 promptService 获取指导文本

系统 SHALL 在 `buildSystemPrompt` 方法中通过 `promptService.getRenderedPrompt` 获取每种模板类型的指导文本，而非使用硬编码。

#### Scenario: 获取模板类型指导

- **WHEN** 用户选择了"技能图谱"模板类型
- **THEN** `buildSystemPrompt` 调用 `promptService.getRenderedPrompt("template_type_skill_map", {}, userId, graphId)` 获取指导文本
- **AND** 如果用户/图谱级有自定义，返回自定义内容
- **AND** 如果没有自定义，返回系统默认内容

#### Scenario: 空白图谱无指导

- **WHEN** 用户选择了"空白图谱"模板类型
- **THEN** 不调用 promptService，不添加模板类型指导

### Requirement: PromptSettingsPanel 添加模板生成分类

系统 SHALL 在提示词设置面板中添加"模板生成"分类，包含 18 个模板类型的提示词配置项。

#### Scenario: 提示词设置面板展示

- **WHEN** 用户打开提示词设置面板
- **THEN** 在现有分类（知识图谱构建、卡片生成、AI 对话、任务调度）之外，新增"模板生成"分类
- **AND** 该分类下显示 18 个模板类型的提示词配置项
- **AND** 每个配置项显示模板类型名称、当前生效来源（系统/用户/图谱）、最后更新时间
- **AND** 提供"自定义"或"编辑"按钮

#### Scenario: 编辑模板类型提示词

- **WHEN** 用户点击某个模板类型的"自定义"按钮
- **THEN** 打开 PromptEditor 组件
- **AND** 编辑器中显示该模板类型的当前指导文本
- **AND** 可用变量列表为空（模板类型指导文本不需要变量替换）
- **AND** 保存后创建用户级或图谱级的 `template_type_{type}` 记录

### Requirement: promptScenarios 添加模板生成场景

系统 SHALL 在 `promptScenarios.tsx` 中添加模板生成相关的场景定义，支持 PromptConfigPanel 的三级展示。

#### Scenario: 场景定义

- **WHEN** PromptConfigPanel 渲染场景列表
- **THEN** 包含"模板生成"场景，分类为"generation"
- **AND** 场景下包含 18 个子场景，每个对应一种模板类型
- **AND** 每个子场景支持三级优先级展示

## MODIFIED Requirements

### Requirement: templateGeneratorService.buildSystemPrompt 方法

原有的 `buildSystemPrompt` 方法使用硬编码的 `templateTypeGuides` 映射。修改为从 `promptService` 动态获取：

原逻辑：
```typescript
const templateTypeGuides: Record<string, string> = {
  knowledge_tree: "Create a hierarchical knowledge tree structure...",
  skill_map: "Create a skill map showing prerequisite relationships...",
  // ... 18 个硬编码条目
};
const templateTypeGuidance = templateType && templateTypeGuides[templateType]
  ? templateTypeGuides[templateType] : "";
```

新逻辑：
```typescript
let templateTypeGuidance = "";
if (templateType && templateType !== "blank") {
  templateTypeGuidance = await promptService.getRenderedPrompt(
    supabaseAdmin,
    `template_type_${templateType}`,
    {},
    userId,
    graphId
  ) || "";
}
```

## REMOVED Requirements

（无移除的需求）
