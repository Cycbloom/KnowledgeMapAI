# Tasks

## Phase 1: 核心工具优化

- [ ] Task 1: 优化 `get_graph_overview` 工具
  - [ ] SubTask 1.1: 添加 `summarize` 参数（默认true）
  - [ ] SubTask 1.2: 实现索引映射（idx代替UUID）
  - [ ] SubTask 1.3: 添加 `domain` 字段，移除 `description`
  - [ ] SubTask 1.4: 移除 `created_at` 字段
  - [ ] SubTask 1.5: 添加 `nodes` 节点数字段

- [ ] Task 2: 优化 `get_graph_details` 工具
  - [ ] SubTask 2.1: 添加 `summarize` 参数
  - [ ] SubTask 2.2: 节点使用索引，边使用索引引用
  - [ ] SubTask 2.3: `content` 改为 `summary`（截断30字）
  - [ ] SubTask 2.4: 移除不必要的元数据字段

- [ ] Task 3: 优化 `get_graph_nodes` 工具
  - [ ] SubTask 3.1: 添加 `summarize` 参数
  - [ ] SubTask 3.2: 节点使用索引
  - [ ] SubTask 3.3: 截断 `content` 为 `summary`

- [ ] Task 4: 优化 `get_isolated_graphs` 工具
  - [ ] SubTask 4.1: 添加 `summarize` 参数
  - [ ] SubTask 4.2: 使用索引映射
  - [ ] SubTask 4.3: 移除 `description`，添加 `domain`

- [ ] Task 5: 优化 `get_graph_relations` 工具
  - [ ] SubTask 5.1: 添加 `summarize` 参数
  - [ ] SubTask 5.2: 使用索引引用图谱（from/to）
  - [ ] SubTask 5.3: 添加 `graphIndex` 映射表

- [ ] Task 6: 优化 `search_graphs` 工具
  - [ ] SubTask 6.1: 添加 `summarize` 参数
  - [ ] SubTask 6.2: 截断搜索结果中的长文本

## Phase 2: 分析工具优化

- [ ] Task 7: 优化 `analysisTools.ts` 中的工具
  - [ ] SubTask 7.1: `analyze_merge_candidates` 添加精简模式
  - [ ] SubTask 7.2: `get_similar_graphs` 添加精简模式
  - [ ] SubTask 7.3: `get_learning_paths` 添加精简模式
  - [ ] SubTask 7.4: `analyze_graph_structure` 添加精简模式

- [ ] Task 8: 优化 `learningTools.ts` 中的工具
  - [ ] SubTask 8.1: `get_prerequisite_chain` 添加精简模式
  - [ ] SubTask 8.2: `get_extension_suggestions` 添加精简模式

- [ ] Task 9: 优化 `nodeTools.ts` 中的工具
  - [ ] SubTask 9.1: `get_node_relations` 添加精简模式

## Phase 3: 验证

- [ ] Task 10: 类型检查与测试
  - [ ] SubTask 10.1: 运行 `npm run check` 验证类型
  - [ ] SubTask 10.2: 运行 `npm run lint` 验证代码风格
  - [ ] SubTask 10.3: 测试精简模式输出正确
  - [ ] SubTask 10.4: 测试完整模式仍可正常工作

---

# Task Dependencies

- Task 2 依赖 Task 1（get_graph_details 需要参考 get_graph_overview 的索引方案）
- Task 5 依赖 Task 1（get_graph_relations 需要图谱索引映射）
- Task 7, 8, 9 可并行执行
- Task 10 依赖所有优化任务完成

# Parallelizable Work

- Task 1, Task 3, Task 4 可并行执行（独立工具）
- Task 7, Task 8, Task 9 可并行执行（不同工具文件）
