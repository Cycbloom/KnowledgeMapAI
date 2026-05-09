# LearningMode 专题研究 UI 优化 Spec

## Why

LearningMode 页面目前对所有图谱类型使用统一的 UI 表现（标题栏图标、标题文字、概览面板图标等），未针对专题研究（topic_research）图谱类型做差异化展示。专题研究图谱有独特的骨干模块结构和文献提取工作流，应在 UI 上体现其特殊性，帮助用户快速识别当前图谱类型并理解其结构。

## What Changes

- 标题栏图标根据 `template_type` 动态切换，专题研究使用 `Microscope` 图标及紫色主题色
- 标题栏标题文字根据图谱类型动态显示，专题研究显示"专题研究"
- GraphOverviewPanel 概览面板图标根据 `template_type` 动态切换
- 左侧大纲面板在专题研究图谱中按骨干模块分组展示节点，并显示模块完善状态

## Impact

- Affected specs: 无
- Affected code:
  - `src/pages/LearningMode.tsx` - 标题栏图标和标题文字动态化
  - `src/components/Learning/GraphOverviewPanel.tsx` - 概览面板图标动态化
  - `src/components/GraphEditor/panels/GraphOutline.tsx` - 专题研究模式下按骨干模块分组

## ADDED Requirements

### Requirement: 标题栏图标动态化

系统 SHALL 根据图谱的 `template_type` 在 LearningMode 标题栏中显示对应的图标和主题色。

#### Scenario: 专题研究图谱标题栏图标
- **WHEN** 用户在 LearningMode 中打开 `template_type === "topic_research"` 的图谱
- **THEN** 标题栏图标显示 `Microscope`，图标背景色使用紫色（`bg-purple-100 dark:bg-purple-900/30`），图标颜色使用紫色（`text-purple-600 dark:text-purple-400`）

#### Scenario: 其他图谱类型标题栏图标
- **WHEN** 用户在 LearningMode 中打开非专题研究类型的图谱
- **THEN** 标题栏图标保持原有 `BookOpen` 图标和 primary 主题色

### Requirement: 标题栏标题文字动态化

系统 SHALL 根据图谱的 `template_type` 在 LearningMode 标题栏中显示对应的类型标签。

#### Scenario: 专题研究图谱标题文字
- **WHEN** 用户在 LearningMode 中打开 `template_type === "topic_research"` 的图谱
- **THEN** 标题栏标题显示"专题研究"而非通用的"知识学习"

#### Scenario: 其他图谱类型标题文字
- **WHEN** 用户在 LearningMode 中打开其他类型的图谱
- **THEN** 标题栏标题保持原有"知识学习"

### Requirement: GraphOverviewPanel 概览面板图标动态化

系统 SHALL 根据图谱的 `template_type` 在 GraphOverviewPanel 中显示对应的图标。

#### Scenario: 专题研究图谱概览面板图标
- **WHEN** GraphOverviewPanel 接收 `template_type === "topic_research"` 的图谱
- **THEN** 概览面板顶部图标显示 `Microscope`，渐变背景色使用紫色

#### Scenario: 其他图谱类型概览面板图标
- **WHEN** GraphOverviewPanel 接收非专题研究类型的图谱
- **THEN** 概览面板顶部图标保持原有 `BookOpen` 和 primary 渐变色

### Requirement: 大纲面板骨干模块分组展示

系统 SHALL 在专题研究图谱的大纲面板中按骨干模块分组展示节点，并显示每个模块的完善状态。

#### Scenario: 专题研究图谱大纲面板分组
- **WHEN** 用户在 LearningMode 中打开 `template_type === "topic_research"` 的图谱
- **AND** 左侧大纲面板处于图谱大纲模式
- **THEN** 大纲面板按六大骨干模块分组展示节点
- **AND** 每个模块组显示模块图标、模块名称、节点数量
- **AND** 每个模块组显示完善状态（已完善/待完善）

#### Scenario: 非专题研究图谱大纲面板
- **WHEN** 用户在 LearningMode 中打开非专题研究类型的图谱
- **THEN** 大纲面板保持原有的树形/列表展示方式，不做分组
