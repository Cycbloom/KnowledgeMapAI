# 修复 AI 知识图谱生成器蒙版未覆盖顶部栏问题

## 问题总结

首页点击"AI生成"按钮后，弹出的 AI 知识图谱生成器弹窗的黑色蒙版无法覆盖页面最顶部的 header 栏（包含面包屑、通知中心、主题切换等按钮的那一行）。

## 根因分析

CSS 层叠上下文（Stacking Context）冲突：

1. **Layout.tsx** 中，`<header>` 设置了 `z-10 relative`，创建了 z-index 为 10 的层叠上下文
2. **Layout.tsx** 中，页面内容区 `<div>` 设置了 `relative` 但没有显式 z-index（等效 z-auto/0）
3. header（z-10）和内容区（z-auto）是**兄弟元素**，z-10 > z-auto，header 始终在内容区之上
4. **Dashboard.tsx** 中的弹窗蒙版使用 `fixed inset-0 z-50`，但它渲染在内容区**内部**
5. 无论弹窗 z-index 多高，都受限于父级内容区的层叠上下文，无法超越 header

## 修复方案

使用 React `createPortal` 将弹窗蒙版渲染到 `document.body`，脱离 Layout 的层叠上下文限制。

### 修改文件

**`d:\KnowledgeMap\src\pages\Dashboard.tsx`**（第 822-843 行）

- 添加 `import { createPortal } from "react-dom"`
- 将 AI Generator Modal 的 JSX 用 `createPortal(..., document.body)` 包裹

修改前：
```tsx
{isAIGeneratorOpen && (
  <div className={`fixed inset-0 z-50 flex ...`}>
    ...
  </div>
)}
```

修改后：
```tsx
{isAIGeneratorOpen && createPortal(
  <div className={`fixed inset-0 z-50 flex ...`}>
    ...
  </div>,
  document.body
)}
```

## 验证步骤

1. 启动开发服务器 `npm run electron:dev`
2. 在首页点击"AI生成"按钮
3. 确认黑色蒙版覆盖整个视口，包括顶部 header 栏
4. 确认弹窗内容正常显示和交互
5. 确认关闭弹窗后页面恢复正常
