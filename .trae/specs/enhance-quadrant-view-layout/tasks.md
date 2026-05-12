# Tasks

- [x] Task 1: 修改节点距离计算逻辑
  - [x] SubTask 1.1: 在 QuadrantNode.tsx 中引入基于节点 ID 的伪随机距离浮动
  - [x] SubTask 1.2: 设置距离范围为 regionRadius * 0.3 到 0.8
  - [x] SubTask 1.3: 确保刷新后节点位置一致（使用伪随机）

- [x] Task 2: 创建边渲染组件
  - [x] SubTask 2.1: 创建 QuadrantEdge.tsx 组件
  - [x] SubTask 2.2: 支持不同线型（实线、虚线、点线）
  - [x] SubTask 2.3: 使用关系类型对应的颜色

- [x] Task 3: 在 QuadrantCanvas 中渲染边
  - [x] SubTask 3.1: 计算边的起点和终点坐标
  - [x] SubTask 3.2: 过滤只显示区域内节点之间的边
  - [x] SubTask 3.3: 边渲染在节点下层

- [x] Task 4: 验证和测试
  - [x] SubTask 4.1: 运行类型检查
  - [x] SubTask 4.2: 测试节点分布效果
  - [x] SubTask 4.3: 测试边显示效果

# Task Dependencies

- [Task 2] 和 [Task 3] 可以并行执行
- [Task 4] 依赖 [Task 1], [Task 2], [Task 3] 完成
