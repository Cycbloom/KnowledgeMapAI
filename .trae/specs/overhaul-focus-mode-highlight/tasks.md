# Tasks

- [x] Task 1: 重写 HighlightedReader 高亮核心逻辑——修复位置偏移 Bug
  - [x] SubTask 1.1: 新增 `cleanupHighlights` 函数，在重新高亮前清除所有已注入的高亮 span，恢复原始文本节点
  - [x] SubTask 1.2: 修改高亮计算流程——渲染完成后从 DOM 提取纯文本，在纯文本上运行关键词匹配和本地模式分析
  - [x] SubTask 1.3: 重写 `applyHighlights` 函数，使用与 DOM 纯文本一致的偏移量应用高亮
  - [x] SubTask 1.4: 修复 `analyzeKeywords` 函数，使其接收纯文本而非原始 Markdown
  - [x] SubTask 1.5: 修复 `analyzeTextLocally` 函数，移除 `Math.random()`，改用基于高亮密度的确定性筛选

- [x] Task 2: HighlightedReader 暗色模式支持
  - [x] SubTask 2.1: 修改 `getHighlightClassName` 函数，接收 `isDark` 参数，返回暗色适配的高亮样式
  - [x] SubTask 2.2: 修改 HighlightedReader 的 prose 容器样式，根据 `isDark` 切换文本颜色

- [x] Task 3: Tooltip 视口边界检测
  - [x] SubTask 3.1: 新增 `calculateTooltipPosition` 工具函数，检测视口边界并自动调整位置
  - [x] SubTask 3.2: 在 Tooltip 渲染时使用计算后的安全位置

- [x] Task 4: 高亮词点击交互增强
  - [x] SubTask 4.1: HighlightedReader 新增 `onKeywordClick` 回调 prop
  - [x] SubTask 4.2: 高亮 span 添加点击事件，触发回调并传递关键词信息
  - [x] SubTask 4.3: LearningFocusPanel 接收回调，展开设置面板并滚动到对应关键词卡片

- [x] Task 5: 高亮统计信息增强
  - [x] SubTask 5.1: 扩展高亮状态，记录关键词命中数、本地分析命中数、各重要性级别数量
  - [x] SubTask 5.2: 更新高亮状态栏 UI，显示分类统计信息

- [x] Task 6: LearningFocusPanel 暗色模式适配
  - [x] SubTask 6.1: 将 `isDark` 状态传入 HighlightedReader（当前硬编码为 `false`）
  - [x] SubTask 6.2: 确保专注模式面板整体暗色模式下阅读体验一致

- [x] Task 7: 性能优化
  - [x] SubTask 7.1: 高亮计算使用 `requestAnimationFrame` 调度，避免阻塞渲染
  - [x] SubTask 7.2: 内容变化时使用防抖（300ms）延迟重新计算高亮

# Task Dependencies

- [Task 2] depends on [Task 1]（暗色模式样式依赖新的高亮应用方式）
- [Task 3] depends on [Task 1]（Tooltip 依赖新的高亮 span 结构）
- [Task 4] depends on [Task 1]（点击交互依赖新的高亮 span 结构）
- [Task 5] depends on [Task 1]（统计信息依赖新的高亮计算结果）
- [Task 6] depends on [Task 2]（面板暗色适配依赖 HighlightedReader 暗色支持）
- [Task 7] depends on [Task 1]（性能优化基于新的高亮逻辑）
