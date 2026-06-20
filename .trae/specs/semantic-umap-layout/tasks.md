# Tasks

- [x] Task 1: 扩展 GraphViewMode 类型和视图模式选择器
  - [x] 1.1: 在 `shared/types/graph.ts` 中将 `GraphViewMode` 扩展为包含 `"semantic"`
  - [x] 1.2: 在 `src/components/GraphEditor/toolbar/ViewModeSelector.tsx` 中新增 semantic 模式选项（Map 图标，"语义地图"标签）
  - [x] 1.3: 在 `src/components/GraphEditor/toolbar/GraphToolbar.tsx` 中新增 semantic 模式按钮
  - [x] 1.4: 在 `src/hooks/graphEditor/useViewState.ts` 中支持 semantic 模式持久化（无需修改，已泛化处理）

- [x] Task 2: 后端 embedding 数据按需返回
  - [x] 2.1: 在 `shared/utils/nodeHelpers.ts` 中新增 `GRAPH_NODES_SELECT_WITH_EMBEDDING` 常量
  - [x] 2.2: 在 `api/services/graph/graphService.ts` 的 `getGraphNodes` 方法中添加 `includeEmbedding` 参数
  - [x] 2.3: 在 `api/routes/graphs/analysis.ts` 的获取节点端点中添加 `includeEmbedding` 查询参数支持

- [x] Task 3: 前端 embedding 数据获取和缓存
  - [x] 3.1: 在 `src/services/api/graphs.ts` 的 `getNodes` 方法中添加 `includeEmbedding` 参数
  - [x] 3.2: 在 `src/hooks/queries/useGraphQueries.ts` 中新增 `useGraphDataWithEmbedding` hook
  - [x] 3.3: React Query 缓存策略已正确配置（独立 queryKey + 5分钟 staleTime）

- [x] Task 4: 安装 umap-js 并实现 UMAP 布局计算
  - [x] 4.1: 安装 `umap-js` 依赖
  - [x] 4.2: 在 `src/utils/mindmapLayout.ts` 中新增 `createSemanticLayout` 函数
  - [x] 4.3: 在 `src/workers/graphCalculator.worker.ts` 中新增 `calculateSemanticLayout` 方法
  - [x] 4.4: 在 `src/hooks/common/useWorker.ts` 中扩展 `GraphWorkerApi` 接口

- [x] Task 5: MindMapCanvas 支持语义布局模式
  - [x] 5.1: 在 `MindMapCanvas` 组件中添加 `layoutMode` 和 `embeddings` props
  - [x] 5.2: 当 layoutMode 为 semantic 时，使用 UMAP 布局替代力导向布局
  - [x] 5.3: 实现部分节点无 embedding 的降级处理（混合布局，在 createSemanticLayout 中实现）
  - [x] 5.4: 实现全部节点无 embedding 的降级处理（提示横幅 + 回退力导向）
  - [x] 5.5: 实现 UMAP 计算进度反馈（加载动画 + "正在计算语义布局..."提示）

- [x] Task 6: GraphEditor 页面集成语义布局模式
  - [x] 6.1: 在 `GraphEditor.tsx` 中为 semantic 视图模式添加条件渲染，传递 layoutMode 和 embeddings
  - [x] 6.2: 切换到 semantic 模式时触发 embedding 数据请求（useGraphDataWithEmbedding hook）
  - [x] 6.3: 切换离开 semantic 模式时保留 embedding 缓存（React Query staleTime）

- [x] Task 7: 验证和测试
  - [x] 7.1: 运行 `npm run lint` 和 `npx tsc --noEmit` 确保无类型/代码错误
  - [x] 7.2: 验证 semantic 模式在有 embedding 数据时正确显示语义聚类（代码逻辑验证）
  - [x] 7.3: 验证无 embedding 数据时的降级处理（代码逻辑验证）
  - [x] 7.4: 验证从 semantic 模式切换到其他模式再切回时缓存生效（React Query 缓存策略验证）

# Task Dependencies
- [Task 2] depends on [Task 1] (需要 GraphViewMode 类型先扩展)
- [Task 3] depends on [Task 2] (需要后端 API 先支持 embedding 返回)
- [Task 4] depends on nothing (可与 Task 2/3 并行)
- [Task 5] depends on [Task 3] and [Task 4] (需要 embedding 数据和 UMAP 布局函数)
- [Task 6] depends on [Task 5] (需要 MindMapCanvas 支持语义布局)
- [Task 7] depends on [Task 6] (需要完整集成后验证)
