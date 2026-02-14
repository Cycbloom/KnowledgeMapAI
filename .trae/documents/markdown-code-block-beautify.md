# Markdown 代码块美化计划

## 目标
美化 Markdown 渲染时的代码块显示，包括：
- 语法高亮
- 更好的样式设计
- 深色/浅色模式支持

## 当前状态
- 使用 `react-markdown` 渲染 Markdown
- 代码块样式在 `src/index.css` 中定义
- 当前样式：`bg-slate-900`（深色背景），无语法高亮

## 实施步骤

### 1. 安装语法高亮库
```bash
npm install react-syntax-highlighter @types/react-syntax-highlighter
```

### 2. 创建代码块组件
创建 `src/components/CodeBlock.tsx`：
- 支持多种编程语言的语法高亮
- 显示语言标签
- 添加复制按钮
- 支持深色/浅色主题

### 3. 更新 ReactMarkdown 配置
在以下文件中添加自定义 code 组件：
- `src/pages/LearningMode.tsx`
- `src/components/GraphEditor/NodeDetailSidebar.tsx`
- `src/components/GraphEditor/ChatDialog.tsx`
- `src/components/GraphEditor/ActionResultModal.tsx`
- `src/components/GraphEditor/PodcastModal.tsx`

### 4. 更新 CSS 样式
在 `src/index.css` 中添加代码块相关样式

## 文件修改清单
1. `src/components/CodeBlock.tsx` (新建)
2. `src/index.css` (修改)
3. `src/pages/LearningMode.tsx` (修改)
4. `src/components/GraphEditor/NodeDetailSidebar.tsx` (修改)
5. `src/components/GraphEditor/ChatDialog.tsx` (修改)
6. `src/components/GraphEditor/ActionResultModal.tsx` (修改)
7. `src/components/GraphEditor/PodcastModal.tsx` (修改)
