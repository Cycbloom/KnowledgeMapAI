# 整合 AI 问答面板：LearningMode 复用 RAGChatPanel

## Summary

将 LearningMode 中的内联 AI 对话面板替换为共享的 RAGChatPanel 组件，消除两套独立实现，统一功能体验。

## Current State Analysis

### 两套实现现状

| 维度 | GraphEditor (RAGChatPanel) | LearningMode (内联) |
|------|---------------------------|---------------------|
| 组件 | RAGChatPanel + ChatMessage + ChatInput | 页面内联 JSX |
| API | `/rag/chat/stream` + `/ai/tutor-chat` | `/ai/chat` |
| RAG 检索 | 支持（返回 sources） | 不支持 |
| 助教模式 | 支持（5种子模式） | 不支持 |
| 语音朗读 TTS | 支持 | 不支持 |
| 语音输入 STT | 不支持 | 支持 |
| 消息引用按钮 | 支持 | 不支持 |
| 选中文本引用 | 支持 | 不支持 |
| 术语提示 TermTooltip | 不支持 | 支持 |
| 来源节点展示 | 支持 | 不支持 |
| Markdown 预处理 | 不使用 | preprocessMarkdown |

### 关键文件

- `src/components/RAGChat/index.tsx` - RAGChatPanel 主组件（902行）
- `src/components/RAGChat/ChatMessage.tsx` - 消息渲染组件
- `src/components/RAGChat/ChatInput.tsx` - 输入框组件
- `src/components/RAGChat/hooks/useChatState.ts` - 对话状态管理
- `src/pages/LearningMode.tsx` - 学习模式页面（含内联对话面板，约500行对话相关代码）
- `src/pages/GraphEditor.tsx` - 图谱编辑器页面（已使用 RAGChatPanel）

## Proposed Changes

### Step 1: 增强 ChatMessage 组件 - 添加 TermTooltip 支持

**文件**: `src/components/RAGChat/ChatMessage.tsx`

**What**: 在 ChatMessage 的 Markdown 渲染中添加 TermTooltip 支持（LearningMode 独有功能）

**Why**: LearningMode 的消息渲染使用了 TermTooltip 组件来识别 `term:` 前缀链接，整合后需要保留此功能

**How**:
- 添加可选 prop `enableTermTooltip?: boolean`
- 在 ReactMarkdown 的 components 中，当 `enableTermTooltip` 为 true 时，对 `a` 标签的 `term:` 前缀 href 使用 TermTooltip 渲染
- 导入 TermTooltip 组件

### Step 2: 增强 ChatInput 组件 - 添加语音输入 (STT)

**文件**: `src/components/RAGChat/ChatInput.tsx`

**What**: 添加语音输入按钮，使用 `useSpeechRecognition` hook

**Why**: LearningMode 有语音输入功能，整合后需要保留

**How**:
- 添加可选 prop `enableSTT?: boolean`
- 当 `enableSTT` 为 true 时，在发送按钮旁显示麦克风按钮
- 使用 `useSpeechRecognition` hook 实现语音转文字
- 语音识别结果自动填入输入框

### Step 3: 增强 RAGChatPanel - 支持右侧嵌入模式

**文件**: `src/components/RAGChat/index.tsx`

**What**: 添加布局模式支持，使 RAGChatPanel 可以作为右侧嵌入面板使用

**Why**: LearningMode 的面板是右侧嵌入布局（非浮动），需要适配

**How**:
- 添加可选 prop `variant?: "floating" | "embedded"`，默认 "floating"
- `floating` 模式：当前行为（左侧浮动面板，有拖拽宽度条）
- `embedded` 模式：无浮动定位，无拖拽宽度条，自适应容器宽度，无关闭按钮
- 添加可选 prop `enableTermTooltip?: boolean`，传递给 ChatMessage
- 添加可选 prop `enableSTT?: boolean`，传递给 ChatInput
- 添加可选 prop `onNavigateToNode?: (nodeId: string) => void`，用于 LearningMode 中的节点导航（替代 onNodeClick 的图谱内跳转）

### Step 4: 统一 API 调用 - LearningMode 使用 RAG API

**文件**: `src/pages/LearningMode.tsx`

**What**: 将 LearningMode 的对话 API 从 `api.ai.chatStream` 切换为 `api.rag.chatStream`

**Why**: RAG API 提供检索增强和来源引用能力，是更优的后端

**How**:
- 在 RAGChatPanel 的普通对话模式中，已经使用 `api.rag.chatStream`
- 只需确保 LearningMode 传入正确的 `graphId` 和 `currentNodeId`
- 不需要修改 RAGChatPanel 内部代码

### Step 5: 替换 LearningMode 中的内联对话面板

**文件**: `src/pages/LearningMode.tsx`

**What**: 删除 LearningMode 中的内联对话面板代码，替换为 RAGChatPanel 组件

**Why**: 这是整合的核心步骤，消除重复代码

**How**:
1. 删除 LearningMode 中约 500 行对话相关代码：
   - 消息列表渲染（内联 ChatMessage）
   - 输入框渲染（内联 ChatInput）
   - 引用区域渲染
   - 对话状态管理（分散的 useState）
   - `handleChatSubmit` 函数
   - 消息相关的 useState（messages, input, isChatLoading, quotes 等）
2. 导入 RAGChatPanel 组件
3. 在右侧面板的 chat 模式中，渲染 RAGChatPanel（embedded 模式）
4. 传递必要的 props：
   - `variant="embedded"`
   - `graphId`
   - `currentNodeId` / `currentNodeTitle`
   - `isTutorMode` / `tutorMode`
   - `enableTermTooltip={true}`
   - `enableSTT={true}`
   - `onNavigateToNode` - 用于节点导航
   - `onToggleTutorMode` / `onSwitchTutorMode`
   - `onExtractConcepts` / `onAddConceptToGraph` / `onAddAllConcepts`
   - `onSuggestNextTopics` / `suggestedNextTopics`
   - `onTutorChat`
5. 保留 LearningMode 的右侧面板模式切换 UI（chat / learning-path / literature-extract / concept-aggregation），但 chat 模式内部使用 RAGChatPanel

### Step 6: 清理冗余代码

**文件**: `src/pages/LearningMode.tsx`

**What**: 清理整合后不再需要的代码

**How**:
- 删除不再使用的 useState（messages, input, isChatLoading, sessionId 等）
- 删除不再使用的函数（handleChatSubmit, handlePlayMessage 等）
- 删除不再使用的 import（ReactMarkdown, remarkGfm, remarkMath, rehypeKatex, CodeBlock, TermTooltip 等）
- 删除不再使用的 useQuoteShortcut 调用（RAGChatPanel 内部已有）
- 保留 useSpeechRecognition hook 的导入（如果 ChatInput 内部不直接使用）

### Step 7: 处理助教模式

**文件**: `src/pages/LearningMode.tsx`

**What**: 确保 LearningMode 的助教模式正确接入 RAGChatPanel

**How**:
- LearningMode 已有 `tutorOps.handleTutorChat` 函数，将其作为 `onTutorChat` 传递给 RAGChatPanel
- RAGChatPanel 的助教子模式切换 UI 已经包含了 free / guided / learning-path / literature-extract / concept-aggregation
- LearningMode 的右侧面板模式切换可以简化为：chat 模式使用 RAGChatPanel（内含助教子模式），其他模式（learning-path / literature-extract / concept-aggregation）保持独立渲染

## Assumptions & Decisions

1. **以 RAGChatPanel 为基础**：不新建组件，在现有 RAGChatPanel 上扩展
2. **embedded 模式**：新增 `variant` prop 区分浮动/嵌入布局，不破坏现有 GraphEditor 用法
3. **API 统一**：LearningMode 切换到 RAG API，获得检索增强能力
4. **功能保留**：LearningMode 独有的 TermTooltip 和 STT 通过可选 prop 保留
5. **渐进式整合**：先替换对话面板，子面板（learning-path / literature-extract / concept-aggregation）保持独立渲染

## Verification Steps

1. `npm run check` - TypeScript 类型检查通过
2. `npm run lint` - ESLint 检查通过
3. GraphEditor 中的 AI 问答面板功能不受影响
4. LearningMode 中的 AI 对话功能正常（消息收发、流式输出、引用、语音等）
5. LearningMode 的 TermTooltip 功能正常
6. LearningMode 的语音输入功能正常
7. 两边的助教模式切换正常
8. 引用功能（Ctrl+U、消息引用按钮、选中文本引用）在两边都正常
