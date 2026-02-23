# Tasks

- [x] Task 1: 添加跨图谱节点关系类型定义
  - [x] SubTask 1.1: 在 `src/types/index.ts` 中添加 `CrossGraphNodeConnection` 接口
  - [x] SubTask 1.2: 添加 `CrossGraphRelationData` 导出数据类型

- [x] Task 2: 实现跨图谱节点连接检测
  - [x] SubTask 2.1: 在 `CombinedGraphView.tsx` 中添加连接检测逻辑
  - [x] SubTask 2.2: 通过 `knowledge_point_id` 匹配两个图谱中的相同节点

- [x] Task 3: 绘制跨图谱节点连接线
  - [x] SubTask 3.1: 创建 `CrossGraphEdgeRenderer` 组件
  - [x] SubTask 3.2: 实现虚线连接样式和动画效果
  - [x] SubTask 3.3: 添加连接线悬停交互

- [x] Task 4: 更新侧边栏显示跨图谱连接
  - [x] SubTask 4.1: 在侧边栏添加"跨图谱连接"标签页
  - [x] SubTask 4.2: 显示匹配节点对列表
  - [x] SubTask 4.3: 点击节点对可定位到对应节点

- [x] Task 5: 实现跨图谱关系导出
  - [x] SubTask 5.1: 更新导出 JSON 功能，包含跨图谱连接数据
  - [x] SubTask 5.2: 添加导出按钮到工具栏

# Task Dependencies
- Task 2 依赖 Task 1
- Task 3 依赖 Task 2
- Task 4 依赖 Task 2
- Task 5 依赖 Task 2, Task 4
