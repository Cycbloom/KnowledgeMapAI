# Tasks

## Phase 1: 代码修改

- [x] Task 1: 在 GraphOutline 组件中添加骨干节点图标显示
  - [x] SubTask 1.1: 导入 `BackboneNodeIcon` 组件和相关类型
  - [x] SubTask 1.2: 在 `TreeNode` 组件中检查节点的 `properties.backboneModule` 属性
  - [x] SubTask 1.3: 在节点标题前渲染骨干节点图标
  - [x] SubTask 1.4: 在列表视图中也添加骨干节点图标显示
  - [x] SubTask 1.5: 确保图标样式和布局正确

## Phase 2: 测试与验证

- [x] Task 2: 验证功能实现
  - [x] SubTask 2.1: 在 LearningMode 中验证骨干节点图标显示
  - [x] SubTask 2.2: 在图谱编辑器大纲视图中验证骨干节点图标显示
  - [x] SubTask 2.3: 验证悬停提示正确显示
  - [x] SubTask 2.4: 验证深色模式和浅色模式下的显示效果

- [x] Task 3: 编写 E2E 测试
  - [x] SubTask 3.1: 测试大纲视图中骨干节点图标显示
  - [x] SubTask 3.2: 测试非骨干节点不显示图标
  - [x] SubTask 3.3: 测试悬停提示功能

# Task Dependencies

- Task 2 依赖 Task 1（验证需要先完成代码修改）
- Task 3 依赖 Task 1（测试需要先完成代码修改）
- Task 2 和 Task 3 可以并行执行
