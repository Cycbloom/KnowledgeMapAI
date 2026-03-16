# Tasks

- [x] Task 1: 数据库 Schema 更新 - 添加图谱领域字段
  - [x] SubTask 1.1: 在 `knowledge_graphs` 表添加 `domain` 字段（可选字符串）
  - [x] SubTask 1.2: 更新 Graph 类型定义，添加 domain 字段
  - [x] SubTask 1.3: 重置数据库验证 schema 变更

- [x] Task 2: 后端 API 增强 - 多轮领域分析
  - [x] SubTask 2.1: 修改 `/domain/analyze` API，接收 `count` 参数
  - [x] SubTask 2.2: 实现多轮生成逻辑（每轮最多 8 个，自动计算轮次）
  - [x] SubTask 2.3: 优化 AI prompt，支持子领域分解和更全面的推荐
  - [x] SubTask 2.4: 实现推荐结果去重和排序
  - [x] SubTask 2.5: 修改 `/domain/batch-create` API，自动设置图谱的 domain 字段

- [x] Task 3: 前端组件增强 - 领域图谱生成面板
  - [x] SubTask 3.1: 在 DomainGraphGenerator 组件添加图谱数量设置（滑块/输入框）
  - [x] SubTask 3.2: 添加多轮生成进度显示（轮次、已生成数量）
  - [x] SubTask 3.3: 更新 API 调用，传递 count 参数
  - [x] SubTask 3.4: 优化推荐列表展示，显示子领域分组

- [x] Task 4: 图谱地图星图可视化 - 领域背景渲染
  - [x] SubTask 4.1: 创建领域背景计算逻辑（根据图谱位置计算边界框）
  - [x] SubTask 4.2: 实现领域背景 SVG 渲染组件
  - [x] SubTask 4.3: 添加领域名称文字渲染（带发光效果）
  - [x] SubTask 4.4: 实现领域背景交互（点击高亮）
  - [x] SubTask 4.5: 添加领域颜色自动分配逻辑

- [x] Task 5: 图谱地图布局优化 - 领域聚合
  - [x] SubTask 5.1: 修改图谱地图布局算法，支持领域聚合
  - [x] SubTask 5.2: 同一领域的图谱节点在布局时靠近
  - [x] SubTask 5.3: 不同领域之间保持适当间距

- [x] Task 6: 测试与验证
  - [x] SubTask 6.1: 测试多轮领域分析功能
  - [x] SubTask 6.2: 测试图谱数量设置和验证
  - [x] SubTask 6.3: 测试领域背景渲染和交互
  - [x] SubTask 6.4: 测试领域聚合布局效果
  - [x] SubTask 6.5: 运行 lint 和 typecheck

# Task Dependencies

- [Task 2] depends on [Task 1] - API 需要数据库字段支持
- [Task 3] depends on [Task 2] - 前端组件需要后端 API 就绪
- [Task 4] depends on [Task 1] - 领域背景渲染需要 domain 字段
- [Task 5] depends on [Task 1] - 布局优化需要 domain 字段
- [Task 6] depends on [Task 1, Task 2, Task 3, Task 4, Task 5] - 测试需要所有功能完成
