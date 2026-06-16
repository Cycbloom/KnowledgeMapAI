# AI助教对话框引用功能增强 Spec

## Why
当前AI助教对话框已支持通过 Ctrl+U 快捷键将选中文本作为引用添加到输入框，但引用功能的用户体验和功能性还有很大提升空间。用户需要更直观、更丰富的引用方式来与AI进行更高效的对话。

## What Changes
- 增强消息气泡中的引用交互（点击引用按钮、右键菜单）
- 支持从知识图谱节点直接引用内容
- 增强引用区域的视觉效果和交互体验
- 支持引用内容的编辑和格式化
- 添加快捷键提示和引导

## Impact
- Affected specs: 无直接影响其他spec
- Affected code:
  - `src/components/RAGChat/index.tsx` - 主面板逻辑
  - `src/components/RAGChat/ChatInput.tsx` - 输入框和引用显示
  - `src/components/RAGChat/ChatMessage.tsx` - 消息气泡渲染
  - `src/pages/LearningMode.tsx` - 学习模式页面
  - `src/i18n/locales/zh-CN.json` / `en-US.json` - 国际化文案

## ADDED Requirements

### Requirement: 消息气泡内联引用按钮
系统 SHALL 在助手回复的消息气泡上提供"引用此消息"的快速操作按钮。

#### Scenario: 用户点击引用按钮
- **WHEN** 用户点击助手消息旁的引用按钮
- **THEN** 该条消息的全部内容被添加为引用，并显示在输入框上方
- **AND** 输入框自动获得焦点

#### Scenario: 用户选中部分文本后引用
- **WHEN** 用户在助手消息中选中部分文本
- **THEN** 显示浮动工具栏，包含"引用选中文本"按钮
- **WHEN** 用户点击该按钮
- **THEN** 仅将选中的文本添加为引用

### Requirement: 右键上下文菜单引用
系统 SHALL 在文本选中时提供右键菜单的"引用到对话"选项。

#### Scenario: 右键菜单引用
- **WHEN** 用户在任意位置选中文本并右键
- **THEN** 上下文菜单包含"引用到AI对话"选项
- **WHEN** 用户选择该选项
- **THEN** 选中文本被添加为引用到AI对话框（如果对话框未打开则自动打开）

### Requirement: 节点内容快速引用
系统 SHALL 提供从知识图谱节点快速引用其标题或摘要到对话的能力。

#### Scenario: 从侧边栏引用节点
- **WHEN** 用户在节点详情/侧边栏看到"引用到对话"按钮并点击
- **THEN** 节点的标题和核心内容被格式化后添加为引用
- **AND** 引用格式包含节点标识：`[节点: 节点标题] 内容摘要...`

### Requirement: 引用区域视觉增强
系统 SHALL 增强引用区域的视觉效果和交互体验。

#### Scenario: 引用卡片展示
- **WHEN** 存在引用内容时
- **THEN** 引用以卡片形式展示，显示：
  - 引用来源图标（文本/节点/代码）
  - 引用内容预览（最多2行，超出省略）
  - 字符数统计
  - 单独删除按钮
  - 清空所有引用按钮（当引用数量>1时）

#### Scenario: 引用拖拽排序
- **WHEN** 存在多个引用时
- **THEN** 用户可以通过拖拽调整引用顺序

### Requirement: 引用内容编辑
系统 SHALL 允许用户在发送前编辑引用内容。

#### Scenario: 编辑引用
- **WHEN** 用户点击引用卡片的编辑按钮/双击引用卡片
- **THEN** 引用卡片变为可编辑状态
- **WHEN** 用户修改完成并按Enter或点击外部
- **THEN** 保存修改后的引用内容

### Requirement: 快捷键提示与引导
系统 SHALL 为用户提供清晰的快捷键使用引导。

#### Scenario: 首次使用提示
- **WHEN** 用户首次打开AI对话框且从未使用过引用功能
- **THEN** 在输入框上方显示轻量级提示："提示：选中任意文本后按 Ctrl+U 可快速引用到对话"
- **AND** 提示在用户首次使用引用功能后消失

#### Scenario: 快捷键参考
- **WHEN** 用户在对话框中按下 Ctrl+/ (或查看帮助)
- **THEN** 显示对话框相关的快捷键列表，包括引用相关快捷键

## MODIFIED Requirements

### Requirement: Ctrl+U 全局引用快捷键
优化现有的 Ctrl+U 快捷键行为：

- **WHEN** 用户在任何页面选中文字并按 Ctrl+U
- **THEN** 如果AI对话框未打开，自动打开对话框并添加引用
- **AND** 添加成功后显示Toast提示："已添加引用"
- **AND** 支持连续多次使用 Ctrl+U 累积添加多个引用

### Requirement: 引用发送格式化
优化引用内容在发送时的格式：

- **WHEN** 用户发送带有引用的消息
- **THEN** 引用内容以结构化格式发送给AI，便于AI理解上下文：
  ```
  [引用 #1]
  {引用内容}

  [引用 #2]
  {引用内容}

  [用户问题]
  {用户输入}
  ```

## REMOVED Requirements
无
