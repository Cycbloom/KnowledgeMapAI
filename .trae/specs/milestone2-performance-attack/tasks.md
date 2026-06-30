# Tasks

- [x] Task 1: 为 MindMapCanvas 添加 React.memo
  - [x] SubTask 1.1: 读取 `src/components/GraphEditor/canvas/MindMapCanvas.tsx`，分析其 35+ props 中哪些是稳定引用（来自 useMemo/useCallback/React Query）、哪些是每次渲染新创建的
  - [x] SubTask 1.2: 为 MindMapCanvas 添加 React.memo，编写自定义比较函数（重点比较 nodes/edges 引用、回调引用等关键 props）
  - [x] SubTask 1.3: 确保添加 memo 后功能正常（nodes/edges 变化时仍需重渲染）

- [x] Task 2: 为 GraphToolbar 添加 React.memo
  - [x] SubTask 2.1: 读取 `src/components/GraphEditor/toolbar/GraphToolbar.tsx`，分析其 50+ props
  - [x] SubTask 2.2: 为 GraphToolbar 添加 React.memo，编写自定义比较函数
  - [x] SubTask 2.3: 确保功能正常

- [x] Task 3: 提取 GraphEditor 内联回调为 useCallback
  - [x] SubTask 3.1: 读取 `src/pages/GraphEditor.tsx`，找到传递给 MindMapCanvas 的所有内联箭头函数（onLayoutUpdate、onMarkNodeMastered、onOpenDetail 等）
  - [x] SubTask 3.2: 将内联箭头函数提取为 useCallback，设置合理的依赖列表
  - [x] SubTask 3.3: 将传递给子组件的内联对象（如 pathfindingState、exportActions）提取为 useMemo
  - [x] SubTask 3.4: 确保提取后功能不变

- [x] Task 4: 修复 useCallback 依赖不精确问题
  - [x] SubTask 4.1: 找到依赖整个 state 对象的 useCallback（如 handleSelectParentFromGraph 依赖 [selectedNode, state]）
  - [x] SubTask 4.2: 将依赖列表精确化为具体的状态属性而非整个 state 对象
  - [x] SubTask 4.3: 确保修复后逻辑不变

- [x] Task 5: 为 GraphEditor 面板组件添加 React.memo
  - [x] SubTask 5.1: 读取 `src/components/GraphEditor/panels/` 下的面板组件（GraphAnalysisPanel、RAGChatPanel、VersionHistoryPanel 等），评估哪些需要 memo
  - [x] SubTask 5.2: 为接收 props 较多的面板组件添加 React.memo
  - [x] SubTask 5.3: 确保功能正常

- [x] Task 6: 优化 batchGetGraphNodeStatus 为批量查询
  - [x] SubTask 6.1: 读取 `api/services/graph/graphService.ts` 中 batchGetGraphNodeStatus 和 getGraphNodeStatus 的实现
  - [x] SubTask 6.2: 将 N 次并行查询改为单次 `SELECT ... FROM study_cards WHERE user_id = ? AND graph_id IN (...)` 查询
  - [x] SubTask 6.3: 在 JS 端按 graph_id 分组返回结果，保持返回格式兼容
  - [x] SubTask 6.4: 保留缓存层逻辑（getOrSet），确保缓存仍可命中
  - [x] SubTask 6.5: 确保路由 `POST /batch-node-status` 返回结果格式不变

- [x] Task 7: 优化 aiActionService 循环 INSERT 为批量 INSERT
  - [x] SubTask 7.1: 读取 `api/services/ai/aiActionService.ts` 中创建子节点的循环 INSERT 代码
  - [x] SubTask 7.2: 将逐条 INSERT 改为 Supabase 批量 INSERT（.insert(array) 而非循环 .insert(single)）
  - [x] SubTask 7.3: 确保事务路径和降级路径均使用批量操作
  - [x] SubTask 7.4: 确保功能不变

- [x] Task 8: 验证与回归测试
  - [x] SubTask 8.1: 运行 `npm run check:full` 确保零类型错误
  - [x] SubTask 8.2: 运行 `npm run lint:full` 确保零 lint 错误
  - [x] SubTask 8.3: 手动验证 GraphEditor 交互性能改善（无卡顿）
  - [x] SubTask 8.4: 验证 batch-node-status API 返回格式兼容

# Task Dependencies
- [Task 3, 4] 应在 [Task 1, 2] 之前完成（先稳定回调引用，再添加 memo，否则 memo 因回调引用变化而失效）
- [Task 5] 可与 [Task 1, 2] 并行（面板组件独立）
- [Task 6, 7] 相互独立可并行（后端优化）
- [Task 8] depends on [Task 1-7 全部完成]
