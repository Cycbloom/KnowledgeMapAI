# Checklist

## 依赖清理
- [x] `@types/react-syntax-highlighter` 仅出现在 devDependencies，不出现在 dependencies
- [x] `babel-plugin-react-dev-locator` 已移除（未被任何源文件引用）
- [x] `npm install` 成功且 lock 文件无冲突
- [x] `npm run check` 和 `npm run lint` 通过

## API 路由命名
- [x] `api/app.ts` 中所有 41 条路由路径均使用 kebab-case
- [x] 无需添加向后兼容别名（全部已合规）

## ErrorBoundary 覆盖
- [x] MindMapCanvas 被 ErrorBoundary 包裹（GraphEditor.tsx）
- [x] GraphMapCanvas 被 ErrorBoundary 包裹（GraphMap.tsx）
- [x] TaskWorkbench 被 ErrorBoundary 包裹（TaskDetailPage.tsx）
- [x] GraphSidebarManager 被 ErrorBoundary 包裹（GraphEditor.tsx）
- [x] 错误回退 UI 包含"重试"按钮（ErrorBoundary 自带）

## 路由去重
- [x] `/api/knowledge-points` 路径有独立的路由处理器（knowledgePoints.ts）
- [x] `/api/graph-nodes` 路径有独立的路由处理器（graphNodes.ts）
- [x] `/api/combined-view` 路径有独立的路由处理器（combinedView.ts）
- [x] 共享 handler 逻辑已提取到独立文件
- [x] 三个路径各自的逻辑正常

## graphs.ts 拆分
- [x] `api/routes/graphs/` 目录存在
- [x] `crud.ts` 包含 CRUD 路由（24 条）
- [x] `analysis.ts` 包含领域分析路由（6 条）
- [x] `expansion.ts` 包含扩展/发现/骨干路由（13 条）
- [x] `index.ts` 正确汇总所有子路由
- [x] `api/app.ts` 导入路径自动解析（Node.js 目录 index.ts 解析）
- [x] `npm run check` 通过

## MindMapCanvas 拆分
- [x] `useCanvasInteraction` hook 独立存在
- [x] `useCanvasTransform` hook 独立存在
- [x] `useEdgeManagement` hook 独立存在
- [x] Props 接口完全不变（对外 API 一致）
- [x] 组件从 1601 行减少至 861 行
- [x] `npm run check` 通过

## GraphMapCanvas 拆分
- [x] `useGraphMapInteraction` hook 独立存在
- [x] 交互逻辑 hook 独立存在
- [x] 组件从 918 行减少至 400 行
- [x] `npm run check` 通过

## TaskWorkbench 拆分
- [x] NotesTab 为独立组件文件
- [x] SubtaskList、ExecutionRecords、ProgressDetail 已独立
- [x] `npm run check` 通过

## 共享逻辑提取
- [x] `shared/utils/nodeHelpers.ts` — GRAPH_NODES_SELECT、buildNodeFromGraphNode 等
- [x] `shared/constants/taskDefaults.ts` — 默认任务设置常量
- [x] `shared/types/database.ts` — toUserTask 函数
- [x] mobile 层从 @shared 导入，消除重复
- [x] `npm run check` 通过

## 启动流程
- [x] server.ts 五阶段启动，有清晰的顺序日志
- [x] 非关键服务失败不阻止启动
- [x] 启动完成后输出健康检查汇总日志（含各服务状态 + 启动耗时）
- [x] `npm run check` 通过