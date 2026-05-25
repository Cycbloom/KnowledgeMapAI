# Tasks

- [x] Task 1: 关键词高亮功能下放至普通学习模式
  - [x] SubTask 1.1: 在 LearningMode.tsx 中将文章区域的 ReactMarkdown 替换为 HighlightedReader 组件，传入 keywords、isDark、isMobile 等必要 props
  - [x] SubTask 1.2: 在 LearningMode.tsx 的文章阅读区域工具栏中添加关键词高亮开关按钮（使用 useFocusStore 的 highlightEnabled / setHighlightEnabled）
  - [x] SubTask 1.3: 验证 HighlightedReader 在非专注模式下正常工作，确保高亮效果、tooltip、点击交互与专注模式一致
  - [x] SubTask 1.4: 验证进入/退出专注模式时高亮状态不冲突，刷新页面后状态持久化正确

- [x] Task 2: 智能复制引用 - 快捷键与剪贴板逻辑
  - [x] SubTask 2.1: 在 LearningMode.tsx 中注册全局 Ctrl+U 快捷键监听，获取当前选中文本，将其以引用格式写入内部状态
  - [x] SubTask 2.2: 实现 Ctrl+V 拦截逻辑：当 AI 输入框获得焦点且存在内部标记的引用文本时，以引用格式粘贴；普通粘贴不受影响
  - [x] SubTask 2.3: 确保正常 Ctrl+C / Ctrl+V 操作不受影响，外部粘贴内容不自动添加引用格式

- [x] Task 3: 智能复制引用 - ChatInput 引用块 UI 渲染
  - [x] SubTask 3.1: 扩展 ChatInput 组件，支持引用块的视觉渲染（左侧竖线、背景色、引用图标等样式）
  - [x] SubTask 3.2: 在 ChatInput 中维护引用文本与普通文本的分离数据结构，支持多段引用累积
  - [x] SubTask 3.3: 实现引用块的删除功能（点击引用块上的关闭按钮可移除单条引用）

- [x] Task 4: 智能复制引用 - 消息发送与 Prompt 处理
  - [x] SubTask 4.1: 修改 RAGChatPanel 的 handleSend 逻辑，在发送消息时将引用文本与用户问题分别标记
  - [x] SubTask 4.2: 更新 promptService.ts 中 rag_chat 默认模板，增加引用上下文处理指令
  - [x] SubTask 4.3: 更新数据库中 rag_chat prompt 记录（如存在自定义覆盖），确保引用上下文指令生效

- [x] Task 5: 集成验证与边界情况处理
  - [x] SubTask 5.1: 验证关键词高亮在两种模式下的完整交互流程
  - [x] SubTask 5.2: 验证智能复制引用在不同场景下的行为（无选中文本、跨段落选择、代码块选择等）
  - [x] SubTask 5.3: 运行 lint 和类型检查确保代码质量

# Task Dependencies
- [Task 2] depends on [Task 3] (快捷键写入引用后，ChatInput 需要先支持引用块渲染)
- [Task 4] depends on [Task 3] (消息发送格式依赖 ChatInput 的引用数据结构)
- [Task 5] depends on [Task 1, Task 2, Task 3, Task 4]
