# Tasks

- [x] Task 1: 修改 AI 提示词支持丰富关系类型
  - [x] SubTask 1.1: 修改 promptService.ts 中的 text_to_graph 提示词
  - [x] SubTask 1.2: 修改 promptService.ts 中的 document_to_graph 提示词
  - [x] SubTask 1.3: 添加关系类型说明和使用示例

- [x] Task 2: 修改边创建逻辑支持智能选择关系类型
  - [x] SubTask 2.1: 修改 autoGraphService.ts 的 AINodeData 接口
  - [x] SubTask 2.2: 修改边创建逻辑使用 relationship_type
  - [x] SubTask 2.3: 修改 document.ts 路由支持 relationship_type

- [x] Task 3: 添加关系类型图例组件
  - [x] SubTask 3.1: 创建 RelationshipLegend.tsx 组件
  - [x] SubTask 3.2: 在 GraphMapCanvas.tsx 中集成图例组件
  - [x] SubTask 3.3: 添加显示/隐藏图例的按钮

- [x] Task 4: 验证代码正确性
  - [x] SubTask 4.1: 运行类型检查
  - [x] SubTask 4.2: 运行 lint 检查

# Task Dependencies

- Task 2 depends on Task 1
- Task 4 depends on Task 1, Task 2, Task 3
