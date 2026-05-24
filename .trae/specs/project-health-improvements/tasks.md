# Tasks

## Phase 1: 低风险高收益清理（可并行执行）

- [x] Task 1: 清理 package.json 依赖配置
  - [x] 将 `@types/react-syntax-highlighter` 从 dependencies 移至 devDependencies（当前两处都有）
  - [x] 移除 `babel-plugin-react-dev-locator`（未被任何源代码引用）
  - [x] 运行 `npm install` 确保 lock 文件更新
  - [x] 验证：运行 `npm run check` 和 `npm run lint` 通过

- [x] Task 2: 统一 API 路由命名
  - [x] 审查 `api/app.ts` 中所有路由挂载路径
  - [x] 确认所有路径已使用 kebab-case（共 41 条路由，全部合规，无需修改）
  - [x] 验证：无遗漏

- [x] Task 3: 为巨型组件添加 ErrorBoundary 包裹
  - [x] 在 MindMapCanvas 使用处添加 ErrorBoundary 包裹（GraphEditor.tsx）
  - [x] 在 GraphMapCanvas 使用处添加 ErrorBoundary 包裹（GraphMap.tsx）
  - [x] 在 TaskWorkbench 使用处添加 ErrorBoundary 包裹（TaskDetailPage.tsx）
  - [x] 在 GraphSidebarManager 使用处添加 ErrorBoundary 包裹（GraphEditor.tsx）
  - [x] 验证：npm run check 通过，ErrorBoundary 自带"重试"按钮

## Phase 2: 路由架构整理（需串行，有依赖关系）

- [x] Task 4: 清理 knowledgePointRoutes 多路径挂载
  - [x] 审查三个路径的实际路由差异
  - [x] 为 `/api/graph-nodes` 创建独立路由文件 `graphNodes.ts`
  - [x] 为 `/api/combined-view` 创建独立路由文件 `combinedView.ts`
  - [x] 从 `knowledgePoints.ts` 移除不属于它的路由
  - [x] 验证：npm run check 通过

- [x] Task 5: 拆分巨型路由文件 graphs.ts
  - [x] 创建 `api/routes/graphs/` 目录
  - [x] 提取 CRUD 操作到 `crud.ts`（24 条路由，~750 行）
  - [x] 提取领域分析逻辑到 `analysis.ts`（6 条路由，~380 行）
  - [x] 提取扩展/发现/骨干操作到 `expansion.ts`（13 条路由，~930 行）
  - [x] 创建 `index.ts` 汇总所有子路由
  - [x] Node.js 自动解析路径，`api/app.ts` 无需修改导入
  - [x] 验证：npm run check 通过

## Phase 3: 前端巨型组件拆分（可并行执行）

- [x] Task 6: 拆分 MindMapCanvas 组件
  - [x] 提取画布交互 hook：`useCanvasInteraction`（缩放、拖拽、选择）
  - [x] 提取画布变换 hook：`useCanvasTransform`
  - [x] 提取边管理 hook：`useEdgeManagement`
  - [x] 1601 行 → 861 行，Props 接口不变
  - [x] 验证：npm run check 通过

- [x] Task 7: 拆分 GraphMapCanvas 组件
  - [x] 提取交互逻辑 hook：`useGraphMapInteraction`（613 行）
  - [x] 918 行 → 400 行
  - [x] 验证：npm run check 通过

- [x] Task 8: 拆分 TaskWorkbench 组件
  - [x] 提取 Notes 内容为独立 `NotesTab` 组件
  - [x] SubtaskList、ExecutionRecords、ProgressDetail 已独立
  - [x] 验证：npm run check 通过

## Phase 4: 服务层优化（可并行执行）

- [x] Task 9: Mobile 与 API 层共享逻辑提取
  - [x] 创建 `shared/utils/nodeHelpers.ts`：GRAPH_NODES_SELECT、buildNodeFromGraphNode 等
  - [x] 创建 `shared/constants/taskDefaults.ts`：默认任务设置常量
  - [x] 在 `shared/types/database.ts` 添加 `toUserTask()` 函数
  - [x] mobile 层改为从 @shared 导入，消除重复
  - [x] 验证：npm run check 通过

- [x] Task 10: 服务启动流程改进
  - [x] 五阶段启动流程（Phase 1-5），明确依赖顺序
  - [x] 非关键服务（性能监控、第三方插件）失败仅记录警告
  - [x] 启动完成输出健康检查汇总日志（含启动耗时）
  - [x] 验证：npm run check 通过

# Task Dependencies
- Phase 2 依赖 Phase 1 完成（先清理命名和依赖再重构路由结构）
- Phase 3 可与 Phase 2 并行（前后端独立）
- Phase 4 依赖 Phase 2 完成（服务层优化需在路由整理后进行）
- Task 5 依赖 Task 4 完成（统一路由架构后再拆分单文件）
- Task 6、7、8 相互独立，可并行执行
- Task 9、10 相互独立，可并行执行