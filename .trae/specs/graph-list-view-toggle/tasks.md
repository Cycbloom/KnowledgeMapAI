# Tasks

- [x] Task 1: 添加视图切换状态管理
  - [x] 添加 viewMode state（'card' | 'list'）
  - [x] 实现 localStorage 持久化（key: 'dashboard-view-mode'）
  - [x] 添加视图切换按钮组件（使用 LayoutGrid 和 List 图标）

- [x] Task 2: 实现列表视图组件
  - [x] 创建列表视图表格布局
  - [x] 显示列：标题、描述、节点数、创建时间、更新时间、操作
  - [x] 实现响应式设计（移动端适配）
  - [x] 保持选择模式功能在列表视图中正常工作

- [x] Task 3: 集成视图切换到 Dashboard
  - [x] 在搜索栏旁添加视图切换按钮
  - [x] 根据视图模式条件渲染卡片或列表视图
  - [x] 确保分页功能在两种视图下都正常工作

# Task Dependencies
- Task 2 依赖 Task 1（需要 viewMode state）
- Task 3 依赖 Task 1 和 Task 2
