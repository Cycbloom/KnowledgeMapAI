# 为创建Dialog添加Prompt配置功能 Spec

## Why

用户在创建各种内容（图谱、测验等）时，希望能够自定义AI生成的提示词，以控制生成内容的风格、难度和方向。目前每个创建功能都有独立的prompt配置，缺乏统一的管理界面。通过添加统一的prompt配置入口，用户可以更方便地管理和自定义各种创建场景的提示词。

## What Changes

- 在所有创建Dialog（创建图谱、创建测验等）的右上角添加prompt配置按钮
- 创建统一的Prompt配置UI，参考`AIActionSettingsPanel`的设计模板
- 支持不同创建场景的prompt模板管理（图谱创建、测验生成等）
- 提供提示词编辑器，支持变量插入和AI优化功能
- 保存用户的自定义prompt配置到用户设置中

## Impact

- Affected specs: 无
- Affected code:
  - `src/components/GraphMap/QuickCreateGraphPanel.tsx` - 添加prompt配置按钮
  - `src/components/Quiz/QuizGenerationModal.tsx` - 添加prompt配置按钮
  - `src/components/PromptConfig/PromptConfigPanel.tsx` - 新建统一的prompt配置面板
  - `src/services/api/prompts.ts` - 扩展API以支持prompt配置的保存和读取

---

## ADDED Requirements

### Requirement: 创建Dialog添加Prompt配置按钮

系统应在所有创建Dialog的右上角添加prompt配置按钮。

#### Scenario: 创建图谱Dialog显示prompt配置按钮

- **GIVEN** 用户打开创建图谱Dialog
- **WHEN** 用户查看Dialog标题栏
- **THEN** 在关闭按钮旁边显示一个prompt配置按钮（FileText图标）
- **AND** 按钮样式与现有UI保持一致

#### Scenario: 创建测验Dialog显示prompt配置按钮

- **GIVEN** 用户打开创建测验Dialog
- **WHEN** 用户查看Dialog标题栏
- **THEN** 在关闭按钮旁边显示一个prompt配置按钮（FileText图标）
- **AND** 按钮样式与现有UI保持一致

### Requirement: Prompt配置面板

系统应提供统一的Prompt配置面板，参考`AIActionSettingsPanel`的设计。

#### Scenario: 打开Prompt配置面板

- **GIVEN** 用户在创建Dialog中点击prompt配置按钮
- **WHEN** 系统打开配置面板
- **THEN** 显示当前创建场景的prompt配置
- **AND** 面板布局与`AIActionSettingsPanel`保持一致
- **AND** 包含场景列表、编辑器、保存/取消按钮

#### Scenario: Prompt配置面板显示场景列表

- **GIVEN** 用户打开Prompt配置面板
- **WHEN** 面板加载完成
- **THEN** 左侧显示可配置的场景列表（图谱创建、测验生成等）
- **AND** 当前场景高亮显示
- **AND** 每个场景显示名称和描述

#### Scenario: 编辑Prompt模板

- **GIVEN** 用户在Prompt配置面板中
- **WHEN** 用户选择一个场景并点击编辑
- **THEN** 显示PromptEditor组件
- **AND** 支持插入可用变量（如`{{graphTitle}}`、`{{knowledgePoints}}`等）
- **AND** 支持AI智能优化功能
- **AND** 支持保存和取消操作

### Requirement: Prompt配置持久化

系统应保存用户的自定义prompt配置。

#### Scenario: 保存Prompt配置

- **GIVEN** 用户编辑了某个场景的prompt模板
- **WHEN** 用户点击保存按钮
- **THEN** 系统将配置保存到用户设置中
- **AND** 显示保存成功提示
- **AND** 关闭配置面板

#### Scenario: 加载用户自定义Prompt

- **GIVEN** 用户之前保存了自定义prompt配置
- **WHEN** 用户再次打开创建Dialog
- **THEN** 系统加载用户保存的prompt配置
- **AND** 在创建时使用自定义的prompt

### Requirement: Prompt变量支持

系统应支持在prompt模板中使用变量。

#### Scenario: 图谱创建场景支持变量

- **GIVEN** 用户在编辑图谱创建的prompt模板
- **WHEN** 用户查看可用变量列表
- **THEN** 显示`{{graphTitle}}`、`{{description}}`、`{{relatedGraph}}`等变量
- **AND** 用户可以点击变量按钮插入到模板中

#### Scenario: 测验生成场景支持变量

- **GIVEN** 用户在编辑测验生成的prompt模板
- **WHEN** 用户查看可用变量列表
- **THEN** 显示`{{quizTitle}}`、`{{knowledgePoints}}`、`{{difficulty}}`、`{{questionTypes}}`等变量
- **AND** 用户可以点击变量按钮插入到模板中

---

## MODIFIED Requirements

### Requirement: 创建图谱功能

扩展现有的创建图谱功能以支持自定义prompt。

```typescript
// 在 QuickCreateGraphPanel.tsx 中添加
interface QuickCreateGraphPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: QuickCreateGraphRequest) => Promise<void>;
  relatedGraphId?: string;
  relatedGraphTitle?: string;
  defaultRelationType?: GraphRelationType;
  customPrompt?: string; // 新增：自定义prompt
}
```

### Requirement: 创建测验功能

扩展现有的创建测验功能以支持自定义prompt。

```typescript
// 在 QuizGenerationModal.tsx 中已有 customPrompt 字段
// 需要将其与用户保存的prompt配置关联
```

---

## UI Design Reference

参考`AIActionSettingsPanel.tsx`的设计：

1. **布局结构**：
   - 左侧：场景列表（类似动作列表）
   - 右侧：编辑区域

2. **场景卡片样式**：
   - 图标 + 名称 + 描述
   - 编辑/删除按钮
   - 悬停效果

3. **编辑器样式**：
   - 使用`PromptEditor`组件
   - 变量工具栏
   - AI优化按钮
   - 保存/取消按钮

4. **颜色方案**：
   - 主色调：indigo/purple
   - 背景：white/dark模式适配
   - 边框：gray-200/slate-700
