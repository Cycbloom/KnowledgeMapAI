# 修复 AI 助教对话面板暗色模式对比度问题 - 实现计划

## [x] 任务 1: 优化 ChatMessage 组件暗色模式样式
- **Priority**: P0
- **Depends On**: None
- **Description**: 优化 ChatMessage 组件在暗色模式下的对比度，确保文字清晰可读
  - 提高背景色和文字色的对比度
  - 优化 prose 组件的暗色模式显示
  - 调整所有相关元素的颜色
- **Success Criteria**:
  - 暗色模式下文字清晰可见，对比度充足
  - 亮色模式保持原有风格不变
  - 所有文本元素（包括 markdown）在暗色模式下都有足够的对比度
- **Test Requirements**:
  - `human-judgement` TR-1.1: 在暗色模式下检查 AI 助教对话面板的可读性，文字应该清晰明亮
  - `human-judgement` TR-1.2: 在亮色模式下检查样式，确保没有破坏原有设计
  - `human-judgement` TR-1.3: 检查 markdown 格式的文本（代码块、列表等）在两种模式下的显示效果
- **Notes**: 主要修改 src/components/RAGChat/ChatMessage.tsx 文件
