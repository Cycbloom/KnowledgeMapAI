# 学习模式功能增强 Spec

## Why
当前关键词高亮功能仅在专注模式（LearningFocusPanel）中可用，普通学习模式（LearningMode）无法使用该功能，限制了学习体验的灵活性。同时，AI 对话中缺少对引用文本的结构化支持，用户无法便捷地将学习内容以引用格式带入对话上下文，影响 AI 对问题的理解深度。

## What Changes
- 将关键词高亮功能从专注模式中解耦，使其在普通学习模式中也可独立启用
- 在普通学习模式的文章阅读区域添加关键词开关控制按钮
- 将普通学习模式的文章渲染从 `ReactMarkdown` 替换为 `HighlightedReader` 组件
- 为 AI 对话添加智能复制引用功能，支持快捷键选中文本并以引用格式粘贴到输入框
- 在 ChatInput 中支持引用块的渲染与编辑
- 修改 `rag_chat` prompt 模板，增加引用上下文处理指令
- 在数据库 prompt 模板中同步更新相关提示词

## Impact
- Affected specs: 学习模式阅读体验、AI 对话交互
- Affected code:
  - `src/pages/LearningMode.tsx` — 替换文章渲染组件，添加关键词开关
  - `src/components/Learning/HighlightedReader.tsx` — 可能需要调整以适配非专注模式场景
  - `src/store/useFocusStore.ts` — 高亮状态在非专注模式下的语义调整
  - `src/components/RAGChat/ChatInput.tsx` — 添加引用块渲染与编辑支持
  - `src/components/RAGChat/index.tsx` — 添加快捷键监听与引用粘贴逻辑
  - `api/services/ai/promptService.ts` — 更新 rag_chat prompt 模板
  - `supabase/migrations/` — 更新数据库中的 prompt 记录

---

## ADDED Requirements

### Requirement: 关键词高亮功能下放至普通学习模式

系统 SHALL 允许用户在普通学习模式（非专注模式）中启用关键词高亮功能。

#### Scenario: 普通学习模式下启用关键词高亮
- **WHEN** 用户在普通学习模式中点击关键词高亮开关按钮
- **THEN** 文章内容区域使用 HighlightedReader 组件渲染，显示关键词高亮效果
- **AND** 高亮效果与专注模式中的表现一致（颜色分级、tooltip 提示、点击交互）

#### Scenario: 普通学习模式下关闭关键词高亮
- **WHEN** 用户在普通学习模式中关闭关键词高亮开关
- **THEN** 文章内容区域恢复为普通 Markdown 渲染，不显示高亮效果

#### Scenario: 关键词开关状态持久化
- **WHEN** 用户切换关键词高亮开关状态
- **THEN** 该状态通过 useFocusStore 持久化到 localStorage
- **AND** 刷新页面或重新进入学习模式后，开关状态保持一致

#### Scenario: 专注模式与普通学习模式的关键词状态不冲突
- **WHEN** 用户在普通学习模式中启用了关键词高亮后进入专注模式
- **THEN** 专注模式中的关键词高亮正常工作
- **AND** 退出专注模式后，普通学习模式的关键词高亮状态保持不变

#### Scenario: 无关键词数据时的降级处理
- **WHEN** 当前节点没有 keywords 数据且用户启用关键词高亮
- **THEN** 使用本地分析模式（analyzeTextLocally）进行高亮，与专注模式行为一致

### Requirement: 智能复制引用功能

系统 SHALL 提供 AI 对话中的智能复制引用功能，允许用户将选中文本以引用格式粘贴到 AI 输入框。

#### Scenario: 通过快捷键复制选中文本为引用
- **WHEN** 用户在学习内容区域选中文本后按下 Ctrl+U
- **THEN** 选中的文本被复制到剪贴板，并以引用格式标记（如 `> 引用文本`）
- **AND** AI 输入框自动获得焦点，引用内容自动填入

#### Scenario: 在 AI 输入框中粘贴引用文本
- **WHEN** 用户在 AI 输入框中按下 Ctrl+V 粘贴内容
- **AND** 粘贴的内容来自学习内容区域的选中文本（通过内部标记识别）
- **THEN** 粘贴内容以引用格式显示在输入框中

#### Scenario: 引用格式在输入框中的 UI 展示
- **WHEN** AI 输入框中包含引用文本
- **THEN** 引用部分以视觉上可区分的样式显示（如左侧竖线、背景色、引用图标）
- **AND** 实际发送给 AI 的消息中，引用文本以结构化格式包裹，便于 AI 识别上下文

#### Scenario: 引用文本发送给 AI
- **WHEN** 用户发送包含引用文本的消息
- **THEN** 发送给 AI 的 prompt 中引用部分被明确标记为引用上下文
- **AND** AI 收到的消息格式中引用文本与用户问题有清晰区分

#### Scenario: 正常复制粘贴不受影响
- **WHEN** 用户使用常规 Ctrl+C / Ctrl+V 操作（非 Ctrl+U）
- **THEN** 正常的文本复制粘贴功能不受影响
- **AND** 从外部应用粘贴的文本不会自动添加引用格式

#### Scenario: 多段引用累积
- **WHEN** 用户多次使用 Ctrl+U 选中不同文本
- **THEN** 每次选中的文本以独立引用块追加到输入框中
- **AND** 用户可以在引用块之间或之后输入自己的问题

### Requirement: Prompt 模板更新支持引用上下文

系统 SHALL 更新 rag_chat prompt 模板以正确处理引用上下文。

#### Scenario: AI 识别引用上下文
- **WHEN** 用户发送的消息包含引用文本
- **THEN** AI 根据 rag_chat prompt 中的指令，优先基于引用上下文回答问题
- **AND** AI 在回答中明确关联引用内容与用户问题

## MODIFIED Requirements

### Requirement: HighlightedReader 组件适配
HighlightedReader 组件 SHALL 支持在非专注模式（普通学习模式）下使用，不依赖 `isInFocusMode` 状态。

- 组件的高亮逻辑由 `highlightEnabled` 状态独立控制，不与专注模式绑定
- 在普通学习模式下，关键词点击交互（如滚动到关键词卡片）可简化为 tooltip 展示

### Requirement: useFocusStore 高亮状态语义扩展
`useFocusStore` 中的 `highlightEnabled` 和 `highlightIntensity` 状态 SHALL 在专注模式和普通学习模式中均可使用。

- `highlightEnabled` 的语义从"专注模式中的高亮开关"扩展为"全局高亮开关"
- 不新增独立的状态字段，复用现有 `highlightEnabled` / `highlightIntensity`
