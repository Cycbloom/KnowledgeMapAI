# 计划：AutoGraphGenerator 模板提示词编辑改进

## 需求分析

**当前问题：**
1. AutoGraphGenerator 中的"编辑提示词"按钮（Settings2 图标）仅在选中了非 blank 模板且模板选择器折叠时才显示（[AutoGraphGenerator.tsx:663-677](file:///d:/KnowledgeMap/src/components/AutoGraph/AutoGraphGenerator.tsx#L663-L677)）
2. 点击后只能编辑当前选中模板类型的提示词，每次只能编辑一个
3. 编辑弹窗是一个简单的 PromptEditor，没有模板类型切换功能

**目标：**
1. 提示词编辑按钮始终显示（不依赖模板选择状态）
2. 点击后打开一个新弹窗，左侧列出所有模板类型（按分类分组），右侧显示选中模板的提示词编辑器
3. 在一个窗口内可以切换并修改所有模板类型的提示词

## 实现方案

### 核心思路

创建一个新的 `TemplatePromptConfigPanel` 组件，类似现有的 `PromptConfigPanel` 但专门用于模板类型提示词管理。左侧按分类显示所有模板类型列表，右侧使用现有的 `PromptEditor` 编辑选中模板的提示词。

### 步骤

#### 1. 创建 `TemplatePromptConfigPanel` 组件

**文件：** `src/components/AutoGraph/TemplatePromptConfigPanel.tsx`

**功能：**
- 左侧面板：按 4 个分类（knowledge/project/analysis/architecture）+ blank 分组显示所有模板类型
- 每个模板类型显示名称和描述
- 当前选中模板高亮
- 如果某模板有自定义提示词（非系统默认），显示标记
- 右侧面板：使用 `PromptEditor` 编辑选中模板的提示词
- 支持加载/保存各模板类型的提示词（复用 `api.prompts.list` 和 `api.prompts.save`）
- 接收 `graphId` prop，支持图谱级/用户级提示词

**状态管理：**
- `selectedType: TemplateType | null` — 当前选中的模板类型
- `templates: { system: PromptTemplate[]; user: PromptTemplate[]; graph: PromptTemplate[] }` — 已加载的提示词模板
- `editingContent: string` — 当前编辑的提示词内容
- `isLoading: boolean` — 加载状态

**提示词加载逻辑（复用现有 `handleOpenPromptEditor` 的逻辑）：**
- 对每个模板类型，prompt code 为 `template_type_${type}`
- 优先级：graph > user > system
- 加载时一次性获取所有提示词，然后在本地按 code 过滤

**保存逻辑（复用现有 `handleSavePrompt` 的逻辑）：**
- 保存到 graph 级（如果有 graphId）或 user 级
- code 为 `template_type_${selectedType}`

#### 2. 修改 `AutoGraphGenerator.tsx`

**变更点：**

a) **提示词编辑按钮始终显示**
- 移除 `selectedTemplateType !== "blank" && !isTemplateSelectorOpen` 条件
- 按钮始终可见，位于模板类型标签旁边

b) **替换提示词编辑弹窗**
- 移除现有的 `editingPromptType` 和 `editingPromptContent` 状态
- 移除现有的 `handleOpenPromptEditor` 和 `handleSavePrompt` 函数
- 新增 `showTemplatePromptConfig: boolean` 状态
- 点击按钮时设置 `showTemplatePromptConfig = true`
- 渲染 `TemplatePromptConfigPanel` 替换原有的 `PromptEditor` 弹窗

c) **传入 `graphId` 和 `initialSelectedType`**
- `initialSelectedType` 默认为当前 `selectedTemplateType`（如果不是 blank 则传入）

#### 3. 添加 i18n 翻译键

在 `zh-CN.json` 和 `en-US.json` 的 `autoGraph` 下添加：
- `templatePromptConfig`: "模板提示词配置" / "Template Prompt Configuration"

### 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/AutoGraph/TemplatePromptConfigPanel.tsx` | 新建 | 新的模板提示词配置面板组件 |
| `src/components/AutoGraph/AutoGraphGenerator.tsx` | 修改 | 按钮始终显示 + 替换弹窗 |
| `src/components/PromptConfig/promptScenarios.tsx` | 不变 | 复用现有场景定义 |
| `src/components/GraphEditor/panels/PromptEditor.tsx` | 不变 | 复用现有编辑器 |
| `src/i18n/locales/zh-CN.json` | 修改 | 添加翻译键 |
| `src/i18n/locales/en-US.json` | 修改 | 添加翻译键 |

### UI 设计

```
┌──────────────────────────────────────────────────────┐
│  模板提示词配置                                    X │
├──────────────────┬───────────────────────────────────┤
│                  │                                   │
│ 📚 知识          │  知识树 - 提示词编辑              │
│   ● 知识树       │                                   │
│   ○ 技能图谱     │  ┌─────────────────────────────┐  │
│   ○ 概念网络     │  │ 可用变量: [topic]            │  │
│   ○ 学习路径     │  ├─────────────────────────────┤  │
│   ○ 专题研究     │  │                             │  │
│                  │  │  (textarea 编辑区)           │  │
│ 💼 项目          │  │                             │  │
│   ○ 项目生命周期 │  │                             │  │
│   ○ 开发流程     │  │                             │  │
│   ○ 任务分解     │  └─────────────────────────────┘  │
│   ○ 迭代规划     │                                   │
│                  │  [AI 智能优化]     [取消] [保存]   │
│ 🔍 分析          │                                   │
│   ○ 根因分析     │                                   │
│   ○ SWOT 分析    │                                   │
│   ○ 对比分析     │                                   │
│   ○ 决策树       │                                   │
│                  │                                   │
│ 🏗️ 架构          │                                   │
│   ○ 技术生态     │                                   │
│   ○ 组织架构     │                                   │
│   ○ 系统架构     │                                   │
│   ○ 知识体系     │                                   │
│                  │                                   │
│ 📄 空白图谱      │                                   │
│                  │                                   │
└──────────────────┴───────────────────────────────────┘
```

左侧列表中，已自定义提示词的模板类型显示小标记（如紫色圆点），方便用户识别哪些已修改。
