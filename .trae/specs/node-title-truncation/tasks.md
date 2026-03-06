# Tasks

- [x] Task 1: 创建文本截断工具函数
  - [x] SubTask 1.1: 创建 `src/utils/textUtils.ts` 文件
  - [x] SubTask 1.2: 实现 `truncateText` 函数，返回截断后的文本、是否被截断、原始文本
  - [ ] SubTask 1.3: 添加单元测试验证截断逻辑

- [x] Task 2: 修改 MindMapNode 组件支持标题截断
  - [x] SubTask 2.1: 在 MindMapNode.tsx 中引入 truncateText 函数
  - [x] SubTask 2.2: 修改标题渲染逻辑，显示截断后的标题
  - [x] SubTask 2.3: 添加 Tooltip 组件，在悬停时显示完整标题（仅当标题被截断时显示）

- [x] Task 3: 修改 PlanetView 3D视图支持标题截断
  - [x] SubTask 3.1: 在 PlanetView.tsx 的 PlanetNode 组件中引入截断逻辑
  - [x] SubTask 3.2: 修改 Text 组件显示截断后的标题
  - [x] SubTask 3.3: 实现悬停时显示完整标题的交互（可使用 HTML overlay 或 Three.js 方案）

- [x] Task 4: 测试验证
  - [x] SubTask 4.1: 运行 `npm run check` 确保类型检查通过
  - [x] SubTask 4.2: 运行 `npm run lint` 确保代码风格正确
  - [ ] SubTask 4.3: 手动测试各视图的标题截断和悬停显示功能

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 2, Task 3]
