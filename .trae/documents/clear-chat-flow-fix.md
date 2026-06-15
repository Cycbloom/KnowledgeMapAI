# 清空对话功能流程分析与修复计划

## 问题分析

用户反馈：清空对话后，AI 回复的上下文似乎为空。

### 当前流程追踪

1. **清空对话操作**（`useChatState.clearMessages`）只做了两件事：
   - 清空 `messages` 数组
   - 清空 `suggestedQuestions`
   - **没有重置 `sessionId`**

2. **发送新消息时**，`handleSend` 构建 `history` 参数：
   ```typescript
   const history = chatState.messages.map(m => ({ role: m.role, content: m.content }));
   ```
   清空后 `history = []`，LLM 无法引用之前的对话内容 —— 这是**预期行为**。

3. **RAG 上下文构建**（`buildContext`）：
   - 每次独立调用，基于当前消息文本做语义搜索和图谱遍历
   - **与 conversation history 无关**
   - `graphId`、`currentNodeId` 来自组件 props，不受清空影响
   - **结论：RAG 知识上下文不会因清空对话而丢失**

4. **sessionId 在后端仅用于性能监控日志**，不影响业务逻辑

### 核心结论

**RAG 上下文（知识图谱节点、语义搜索结果）不会因清空对话而丢失**，每次发消息都会重新构建。用户感觉"上下文为空"可能是因为：
- LLM 丢失了对话历史，无法引用之前的问答
- 这是清空对话的**预期行为**，不是 bug

### 需要修复的问题

虽然没有严重 bug，但有一个语义问题：**清空对话后 `sessionId` 没有重置**。从语义上讲，"清空对话 = 开始新会话"，应该生成新的 sessionId，这样性能日志也能正确分组。

## 修改计划

### 1. 重置 sessionId（`useChatState.ts`）

**文件**：`d:\KnowledgeMap\src\components\RAGChat\hooks\useChatState.ts`

- 为 `sessionId` 添加 setter
- 在 `clearMessages` 中重置 `sessionId`

```typescript
// 修改前
const [sessionId] = useState<string>(() => crypto.randomUUID());

// 修改后
const [sessionId, setSessionId] = useState<string>(() => crypto.randomUUID());

const clearMessages = useCallback(() => {
  setMessages([]);
  setSuggestedQuestions([]);
  setSessionId(crypto.randomUUID());
}, []);
```

### 2. 验证步骤

- 运行 `npx tsc --noEmit` 确认类型检查通过
- 运行 `npm run lint` 确认无新增错误
