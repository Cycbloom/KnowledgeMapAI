# RAG Chat 修复计划：数学公式渲染 + 相关问题展示区域

## 问题总结

### 问题1：数学公式不渲染
AI 回复中的 LaTeX 数学公式（如 `\[...\]`、`\(...\)`）未正确渲染，直接显示原始文本。

**根因**：`ChatMessage.tsx` 中 `ReactMarkdown` 直接使用 `message.content`，未经过 `preprocessMarkdown` 预处理。项目已有 `src/utils/markdownPreprocessor.ts` 将 `\[...\]` 转为 `$$...$$`、`\(...\)` 转为 `$...$`，其他组件（NodeDetailSidebar、HighlightedReader 等）已正确使用，但 ChatMessage 遗漏了。

### 问题2：相关问题建议展示位置
AI 回复中包含的"相关问题建议"目前在消息气泡内以 Markdown 文本展示，用户希望将其提取到输入框上方的专属区域。

**现状**：
- AI 响应中 "### 相关问题建议" 作为消息内容的一部分显示在聊天气泡中
- 输入框上方已有 `suggestedQuestions` 区域（index.tsx L849-871），但目前只显示硬编码/模板化的建议
- `useChatState` 已有 `suggestedQuestions` 状态管理

**目标**：
- 从 AI 回复中自动提取"相关问题建议"，添加到 `suggestedQuestions`
- 从消息内容中移除"相关问题建议"部分，避免重复显示
- 输入框上方区域展示 AI 生成的真实相关问题，而非固定模板

---

## 修改方案

### 1. ChatMessage.tsx — 数学公式渲染修复
- 导入 `preprocessMarkdown`
- 将 `ReactMarkdown` 的 `{message.content}` 改为 `{preprocessMarkdown(message.content)}`
- 同时移除 `index.tsx` 中重复的 `import "katex/dist/katex.min.css"`（已全局引入）

**文件**：`src/components/RAGChat/ChatMessage.tsx`
- L1: 添加 `import { preprocessMarkdown } from "../../utils/markdownPreprocessor";`
- L263: `{message.content}` → `{preprocessMarkdown(message.content)}`

**文件**：`src/components/RAGChat/index.tsx`
- L26: 移除 `import "katex/dist/katex.min.css";`（已在 `src/index.css` 全局引入）

### 2. 相关问题提取逻辑 — 新增工具函数
创建提取函数，从 AI 回复内容中识别并提取"相关问题建议"部分。

**文件**：`src/utils/markdownPreprocessor.ts`（追加函数）
```typescript
// 提取 AI 回复中的相关问题建议，返回 { content: 清理后的内容, questions: 提取的问题数组 }
export const extractSuggestedQuestions = (content: string): {
  content: string;
  questions: string[];
} => {
  // 匹配模式："### 相关问题建议" 或 "---" 后跟编号列表
  // 支持中英文标记
  const patterns = [
    /(?:---\s*)?###\s*(?:相关问题建议?|Related\s+Questions?|Suggested\s+Questions?|Follow-up\s+Questions?)[\s\S]*?(?=\n---|\n##|$)/i,
    /(?:---\s*)?(?:相关问题建议?|Related\s+Questions?)[\s\S]*?(?=\n---|\n##|$)/i,
  ];

  let questions: string[] = [];
  let cleanedContent = content;

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      // 从匹配部分提取编号列表项
      const section = match[0];
      const itemPattern = /^\s*\d+\.\s*(.+)/gm;
      const matches = [...section.matchAll(itemPattern)];
      questions = matches.map(m => m[1].trim()).filter(Boolean);

      // 从原文中移除该部分
      cleanedContent = content.replace(pattern, '').trim();
      break;
    }
  }

  return { content: cleanedContent, questions };
};
```

### 3. index.tsx — 集成问题提取到 suggestedQuestions
在流式回复完成后，调用 `extractSuggestedQuestions` 处理最后一条助手消息：
- 提取问题到 `suggestedQuestions`
- 更新消息内容（移除内联的问题部分）

**文件**：`src/components/RAGChat/index.tsx`
- 导入 `extractSuggestedQuestions`
- 修改 `streamAssistantResponse` 中流式完成后的逻辑（约 L311-330）：
  - 对 `fullResponse` 调用 `extractSuggestedQuestions`
  - 用清理后的内容更新消息
  - 将提取的问题合并到 `suggestedQuestions`（替换硬编码模板）

### 4. 输入框上方建议区域优化
当前已有建议区域（index.tsx L849-871），但只显示2条且为横向滚动胶囊按钮。优化为：
- 显示 AI 提取的真实问题（最多3条）
- 保留当前的视觉样式（胶囊按钮），已够用

**文件**：`src/components/RAGChat/index.tsx`
- L856: `.slice(0, 2)` → `.slice(0, 3)` 展示更多建议

---

## 涉及文件清单

| 文件 | 修改内容 |
|------|----------|
| `src/components/RAGChat/ChatMessage.tsx` | 导入并应用 `preprocessMarkdown` |
| `src/components/RAGChat/index.tsx` | 导入提取函数、移除重复 katex CSS import、集成问题提取逻辑、建议数量调整 |
| `src/utils/markdownPreprocessor.ts` | 新增 `extractSuggestedQuestions` 函数 |

## 验证步骤

1. `npm run check` — 类型检查通过
2. `npm run lint` — 代码规范检查通过
3. 手动测试：
   - 发送包含数学公式的问题（如"什么是量子比特"），确认 `\[...\]` 和 `\(...\)` 正确渲染
   - 确认 AI 回复中的"相关问题建议"不再显示在消息气泡内，而是出现在输入框上方
   - 确认点击建议问题可以正常发送
