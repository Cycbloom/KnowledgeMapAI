# Tasks

- [x] Task 1: 实现控制台输出日志智能折叠功能
  - [x] Task 1.1: 修改 ConsoleOutput 组件，添加初始显示数量限制（最近 20 条）
  - [x] Task 1.2: 实现滚动监听和动态加载逻辑（向上滚动时加载更多）
  - [x] Task 1.3: 添加"查看更多历史日志"的视觉提示组件
  - [x] Task 1.4: 处理新命令执行时的自动滚动行为
  - [x] Task 1.5: 确保滚动位置平滑过渡，避免闪烁

- [x] Task 2: 实现键盘上下键快速访问历史命令
  - [x] Task 2.1: 在 ConsoleInput 中添加历史命令索引状态管理
  - [x] Task 2.2: 实现 ArrowUp 键浏览上一条历史命令的逻辑
  - [x] Task 2.3: 实现 ArrowDown 键浏览下一条历史命令的逻辑
  - [x] Task 2.4: 实现编辑内容临时保存和恢复机制
  - [x] Task 2.5: 处理与自动补全功能的优先级冲突

- [x] Task 3: 集成测试与优化
  - [x] Task 3.1: 编写日志折叠功能的单元测试
  - [x] Task 3.2: 编写历史命令键盘导航的单元测试
  - [x] Task 3.3: 编写 E2E 测试验证完整交互流程
  - [x] Task 3.4: 性能优化（大量日志时的渲染性能）
  - [x] Task 3.5: 边界情况处理（空历史、单条历史等）

# Task Dependencies
- [Task 2] depends on [Task 1] (可选，可并行开发)
- [Task 3] depends on [Task 1, Task 2]
