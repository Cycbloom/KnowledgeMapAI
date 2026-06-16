# AI问答面板整合 - 代码审查修复计划

## Summary

对本次 AI 问答面板整合变更进行代码审查后，发现若干遗漏和问题需要修复。

## 发现的问题（按优先级排序）

### 严重问题

1. **清空聊天按钮 onClick 为空操作** - LearningMode.tsx:1840，点击无任何效果
2. **`aiChat.startRecording`/`stopRecording` i18n key 缺失** - ChatInput.tsx:389，STT 按钮的 title 会显示 key 原文
3. **embedded 模式下助教模式切换/语音设置不可见** - RAGChatPanel header 被整体隐藏，用户无法切换助教模式

### 中等问题

4. **`learning.chat.clear` i18n key 缺失** - LearningMode.tsx:1846
5. **RAGChatPanel 缺少助教模式相关 props** - LearningMode 未传入 isTutorMode/onToggleTutorMode 等
6. **TermTooltip explanation 未做 decodeURIComponent** - ChatMessage.tsx:170

### 低等问题（本次不修复）

- "概念聚合" 硬编码中文（已有问题，非本次引入）
- addQuote 循环依赖（code smell，运行时无问题）
- 引用编辑 blur 保存可能触发不必要操作（最终结果正确）
- import 放在 lazy 之间（代码风格，不影响运行）
- useQuoteShortcut inputRef 未传入（功能缺失但不影响核心流程）

## Proposed Changes

### Fix 1: 补充 i18n 翻译 key

**文件**: `src/i18n/locales/zh-CN.json`, `src/i18n/locales/en-US.json`

添加缺失的 key：
- `aiChat.startRecording` / `aiChat.stopRecording`
- `learning.chat.clear`

### Fix 2: 修复清空聊天按钮

**文件**: `src/pages/LearningMode.tsx`

移除外层 header 中的无效清空按钮（RAGChatPanel 内部 ChatInput 已有清空功能），或者将其改为关闭面板功能。

### Fix 3: embedded 模式下保留助教模式切换

**文件**: `src/components/RAGChat/index.tsx`

在 embedded 模式下，将助教模式切换按钮从 header 中提取出来，放到消息区域上方作为独立的工具栏。

### Fix 4: 补充 LearningMode 的助教模式 props

**文件**: `src/pages/LearningMode.tsx`

向 RAGChatPanel 传入助教模式相关 props（如果 LearningMode 需要助教模式的话）。

### Fix 5: TermTooltip decodeURIComponent

**文件**: `src/components/RAGChat/ChatMessage.tsx`

对 TermTooltip 的 explanation 做 decodeURIComponent 处理。

## Verification Steps

1. `npm run check` 通过
2. `npm run lint` 通过
3. LearningMode 中清空按钮功能正常
4. STT 按钮 title 显示正确中文
5. embedded 模式下助教模式切换可用
