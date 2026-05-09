# Tasks

- [x] Task 1: 标题栏图标和标题文字动态化
  - [x] SubTask 1.1: 在 LearningMode.tsx 中引入 TEMPLATE_TYPE_CONFIG 配置（从 Dashboard 提取为共享常量或直接在 LearningMode 中定义映射）
  - [x] SubTask 1.2: 根据 graphMeta?.template_type 动态渲染标题栏图标（专题研究用 Microscope + 紫色，其他用 BookOpen + primary）
  - [x] SubTask 1.3: 根据 graphMeta?.template_type 动态渲染标题文字（专题研究显示"专题研究"，其他显示"知识学习"）

- [x] Task 2: GraphOverviewPanel 概览面板图标动态化
  - [x] SubTask 2.1: GraphOverviewPanel 接收 template_type prop
  - [x] SubTask 2.2: 根据 template_type 动态渲染概览面板顶部图标（专题研究用 Microscope + 紫色渐变，其他用 BookOpen + primary 渐变）
  - [x] SubTask 2.3: LearningMode.tsx 传递 template_type 给 GraphOverviewPanel

- [x] Task 3: 大纲面板骨干模块分组展示
  - [x] SubTask 3.1: GraphOutline 接收 template_type prop
  - [x] SubTask 3.2: 当 template_type === "topic_research" 时，按骨干模块分组展示节点（使用 BACKBONE_MODULE_LABELS 和 BACKBONE_MODULE_ICONS）
  - [x] SubTask 3.3: 每个模块组显示完善状态（基于模块下是否有非 needsRefinement 的子节点判断）
  - [x] SubTask 3.4: 非专题研究图谱保持原有展示方式不变
  - [x] SubTask 3.5: LearningMode.tsx 传递 template_type 给 GraphOutline

# Task Dependencies

- [Task 2] depends on [Task 1] (共享 TEMPLATE_TYPE_CONFIG 映射逻辑)
- [Task 3] independent
