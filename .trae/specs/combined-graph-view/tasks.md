# Tasks

- [x] Task 1: 添加类型定义
  - [x] SubTask 1.1: 在 `src/types/index.ts` 中添加联立视图相关类型

- [x] Task 2: 实现图谱地图多选功能
  - [x] SubTask 2.1: 在 `GraphMapCanvas.tsx` 中添加多选状态管理
  - [x] SubTask 2.2: 实现按住 Ctrl/Cmd 键多选的交互逻辑
  - [x] SubTask 2.3: 添加多选图谱的高亮样式

- [ ] Task 3: 添加联立打开按钮
  - [ ] SubTask 3.1: 在 `GraphMap.tsx` 中添加联立打开按钮
  - [ ] SubTask 3.2: 实现按钮的启用/禁用状态逻辑
  - [ ] SubTask 3.3: 实现导航到联立视图页面的逻辑

- [x] Task 4: 创建联立视图页面
  - [x] SubTask 4.1: 创建 `src/pages/CombinedGraphView.tsx` 页面组件
  - [x] SubTask 4.2: 实现左右分屏布局，支持可拖拽分隔条
  - [x] SubTask 4.3: 实现上下分屏布局切换功能
  - [x] SubTask 4.4: 在每个分屏中嵌入图谱画布组件

- [x] Task 5: 实现图谱间关系可视化
  - [x] SubTask 5.1: 获取两个图谱之间的关系数据
  - [x] SubTask 5.2: 在分屏之间绘制关系连接线
  - [x] SubTask 5.3: 高亮显示关系类型标签

- [x] Task 6: 添加联立视图工具栏
  - [x] SubTask 6.1: 创建联立视图工具栏组件
  - [x] SubTask 6.2: 实现返回图谱地图功能
  - [x] SubTask 6.3: 显示两个图谱的标题
  - [x] SubTask 6.4: 实现分屏方向切换功能

- [x] Task 7: 添加路由配置
  - [x] SubTask 7.1: 在 `App.tsx` 中添加 `/combined-graphs/:id1/:id2` 路由

# Task Dependencies
- Task 2 依赖 Task 1
- Task 3 依赖 Task 2
- Task 4 依赖 Task 1
- Task 5 依赖 Task 4
- Task 6 依赖 Task 4
- Task 7 依赖 Task 4, Task 6
