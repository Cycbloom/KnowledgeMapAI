# 生成补充节点内容 - 添加反馈机制计划

## 问题分析

当前"生成/补充节点内容"按钮存在以下问题：

1. **按钮无 loading 状态**：点击后按钮没有任何视觉变化，用户不知道是否正在处理
2. **消息反馈可能不明显**：虽然有消息提示，但用户可能没有注意到底部消息栏
3. **缺少进度指示器**：长时间生成时用户无法知道进度

### 代码位置

- 按钮 UI：[NodeDetailSidebar.tsx:323-332](file:///d:\KnowledgeMap\src\components\GraphEditor\sidebar\NodeDetailSidebar.tsx#L323-L332)
- 处理逻辑：[useGraphAIOperations.ts:522-562](file:///d:\KnowledgeMap\src\hooks\graphAI\useGraphAIOperations.ts#L522-L562)
- 状态管理：[GraphSidebarManager.tsx:65](file:///d:\KnowledgeMap\src\components\GraphEditor\sidebar\GraphSidebarManager.tsx#L65) (loading 状态存在但未传递)

### 发现的问题

1. `loading` 状态已在 `GraphEditorState` 中定义，`handleGenerateNodeContent` 也调用了 `loadingSetter: setLoading`
2. 但 `NodeDetailSidebar` 组件**没有接收 loading prop**，按钮无法显示加载状态
3. 按钮没有 disabled 状态，用户可能重复点击
4. **类型不一致**：`MessageBar` 支持 `loading` 类型，但 `useMessageStore` 的 `MessageType` 没有定义 `loading`

## 实施方案

### 步骤 1：修复消息类型定义

**文件**: `src/store/useMessageStore.ts`

在 `MessageType` 中添加 `'loading'` 类型：
```typescript
export type MessageType = 'info' | 'success' | 'warning' | 'error' | 'loading';
```

### 步骤 2：修改 NodeDetailSidebar 组件 Props

**文件**: `src/components/GraphEditor/sidebar/NodeDetailSidebar.tsx`

1. 在 `NodeDetailSidebarProps` 接口中添加 `isGeneratingContent?: boolean` prop
2. 在组件中接收该 prop
3. 修改按钮显示：
   - loading 时显示 `Loader2` spinner 图标 + "生成中..."
   - 正常时显示 `Wand2` 图标 + "生成/补充节点内容"
   - loading 时禁用按钮并添加视觉反馈

### 步骤 3：传递 loading 状态到 NodeDetailSidebar

**文件**: `src/components/GraphEditor/sidebar/GraphSidebarManager.tsx`

1. 从 `state` 中获取 `loading` 状态（已有）
2. 将 `loading` 作为 `isGeneratingContent` prop 传递给 `NodeDetailSidebar`

### 步骤 4：优化消息反馈

**文件**: `src/hooks/graphAI/useGraphAIOperations.ts`

将开始消息改为 `loading` 类型，并设置更长的持续时间：
```typescript
addMessage({ 
  content: 'AI 内容生成任务已开始...', 
  type: 'loading',
  duration: 0  // 持续显示直到完成
});
```

完成时需要移除 loading 消息或替换为成功消息。

## 预期效果

1. 点击按钮后，按钮立即显示 spinner + "生成中..."，按钮变灰且禁用
2. 底部消息栏显示蓝色背景 + 旋转图标 + "AI 内容生成任务已开始..."
3. 生成完成后：
   - 按钮恢复正常状态
   - 消息栏显示绿色背景 + "AI 内容生成完成"

## 文件修改清单

| 文件 | 修改内容 |
|------|----------|
| `src/store/useMessageStore.ts` | 添加 `'loading'` 到 MessageType |
| `src/components/GraphEditor/sidebar/NodeDetailSidebar.tsx` | 添加 isGeneratingContent prop，按钮显示 loading 状态 |
| `src/components/GraphEditor/sidebar/GraphSidebarManager.tsx` | 传递 loading 状态 |
| `src/hooks/graphAI/useGraphAIOperations.ts` | 使用 loading 类型消息 |

## 详细代码修改

### 1. useMessageStore.ts

```typescript
// 修改前
export type MessageType = 'info' | 'success' | 'warning' | 'error';

// 修改后
export type MessageType = 'info' | 'success' | 'warning' | 'error' | 'loading';
```

### 2. NodeDetailSidebar.tsx

```tsx
// Props 接口添加
interface NodeDetailSidebarProps {
  // ... 现有 props
  isGeneratingContent?: boolean;
}

// 组件中接收
export const NodeDetailSidebar: React.FC<NodeDetailSidebarProps> = ({
  // ... 现有 props
  isGeneratingContent = false,
}) => {

// 按钮修改
<button
  onClick={onGenerateNodeContent}
  disabled={isGeneratingContent}
  className={`w-full flex items-center justify-center ... ${
    isGeneratingContent 
      ? "opacity-60 cursor-not-allowed" 
      : "hover:bg-purple-100 dark:hover:bg-purple-900/30"
  }`}
>
  {isGeneratingContent ? (
    <>
      <Loader2 size={isMobile ? 18 : 16} className="mr-2 animate-spin" />
      生成中...
    </>
  ) : (
    <>
      <Wand2 size={isMobile ? 18 : 16} className="mr-2" />
      生成/补充节点内容
    </>
  )}
</button>
```

### 3. GraphSidebarManager.tsx

```tsx
<NodeDetailSidebar
  // ... 现有 props
  isGeneratingContent={loading}
/>
```

### 4. useGraphAIOperations.ts

```typescript
const handleGenerateNodeContent = async () => {
  if (!selectedNode || !id) return;
  
  // 使用 loading 类型，持续显示
  const loadingMsgId = addMessage({ 
    content: 'AI 内容生成任务已开始...', 
    type: 'loading',
    duration: 0 
  });
  
  await asyncHandler(
    async () => {
      // ... 现有逻辑
    },
    {
      loadingSetter: setLoading,
      successMessage: 'AI 内容生成完成',
      errorMessage: 'AI 生成失败',
      onFinally: () => {
        // 移除 loading 消息
        removeMessage(loadingMsgId);
      }
    }
  );
};
```
