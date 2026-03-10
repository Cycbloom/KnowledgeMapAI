# Tasks - 学习路径可视化增强

## 阶段一：数据层与状态管理

- [x] Task 1: 扩展 MindMapNode 组件支持学习路径状态
  - [x] 添加 learningPathOrder 属性用于显示学习顺序编号
  - [x] 添加 isLearningPathHighlighted 属性用于高亮效果
  - [x] 设计学习顺序编号的视觉样式（圆形徽章、位置、颜色）

- [x] Task 2: 扩展 MindMapCanvas 组件支持学习路径状态传递
  - [x] 添加 learningPathNodeIds 属性（学习路径节点集合）
  - [x] 添加 learningPathOrderMap 属性（节点ID到顺序编号的映射）
  - [x] 添加 highlightedPathNodeId 属性（当前高亮的路径节点）
  - [x] 将学习路径状态传递给子节点组件

## 阶段二：学习路径面板修复

- [x] Task 3: 修复 LearningPathPanel 组件展示问题
  - [x] 检查并修复学习路径列表的渲染逻辑
  - [x] 确保路径列表正确显示所有学习路径
  - [x] 优化列表滚动和布局样式

- [x] Task 4: 增强 LearningPathOutline 组件交互
  - [x] 添加节点点击时的回调函数
  - [x] 支持传递当前选中的学习路径 ID
  - [x] 优化节点列表的展示样式

## 阶段三：图谱编辑器集成

- [x] Task 5: 在 GraphEditor 中集成学习路径状态
  - [x] 添加 selectedLearningPathId 状态管理
  - [x] 添加 learningPathNodeIds 状态（当前路径的节点集合）
  - [x] 添加 learningPathOrderMap 状态（节点顺序映射）
  - [x] 实现学习路径选择时的状态更新逻辑

- [x] Task 6: 实现学习路径节点高亮逻辑
  - [x] 当用户点击学习路径节点时，更新 focusedNodeId
  - [x] 计算并更新 focusedNodeIds（包含路径上的所有节点）
  - [x] 计算并更新 focusedLinkIds（路径上的连接线）
  - [x] 实现取消高亮的逻辑

## 阶段四：视觉样式实现

- [x] Task 7: 实现学习顺序编号显示
  - [x] 在 MindMapNode 中添加顺序编号徽章
  - [x] 根据节点状态设置不同的编号样式（待学习/学习中/已完成）
  - [x] 确保编号在不同缩放级别下清晰可见

- [x] Task 8: 实现学习路径高亮效果
  - [x] 高亮路径上的节点（增强边框或光晕效果）
  - [x] 降低非路径节点的透明度
  - [x] 高亮路径上的连接线
  - [x] 添加平滑的过渡动画

## 阶段五：测试与验证

- [x] Task 9: 类型检查与代码检查
  - [x] 运行 npm run check 确保类型正确
  - [x] 运行 npm run lint 确保代码规范

- [x] Task 10: 功能测试
  - [x] 测试学习路径列表展示
  - [x] 测试节点点击高亮效果
  - [x] 测试学习顺序编号显示
  - [x] 测试取消高亮功能

---

# Task Dependencies

- Task 2 依赖 Task 1
- Task 5 依赖 Task 3, Task 4
- Task 6 依赖 Task 5
- Task 7, Task 8 依赖 Task 1, Task 2
- Task 9, Task 10 依赖 Task 1-8
