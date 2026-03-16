# Tasks

- [x] Task 1: 修复图谱关系创建逻辑
  - [x] SubTask 1.1: 分析当前 `/domain/batch-create` API 的关系创建逻辑
  - [x] SubTask 1.2: 修复关系创建代码，确保所有图谱都正确建立关系
  - [x] SubTask 1.3: 添加关系创建的日志记录
  - [x] SubTask 1.4: 测试批量创建后关系是否正确显示

- [x] Task 2: 修复领域背景框位置计算
  - [x] SubTask 2.1: 修改 DomainBackground.tsx 使用正确的节点坐标
  - [x] SubTask 2.2: 使用 layout.nodes 中的 x, y 坐标而非 x_position, y_position
  - [x] SubTask 2.3: 验证背景框正确包围同领域节点

- [x] Task 3: 验证初始化任务执行流程
  - [x] SubTask 3.1: 检查任务队列配置是否正确
  - [x] SubTask 3.2: 验证 recursive_graph_generation 处理器注册
  - [x] SubTask 3.3: 添加任务执行日志
  - [x] SubTask 3.4: 测试初始化任务是否正确执行

- [x] Task 4: 集成测试与验证
  - [x] SubTask 4.1: 测试完整的领域图谱生成流程
  - [x] SubTask 4.2: 验证图谱地图上连线正确显示
  - [x] SubTask 4.3: 验证领域背景框位置正确
  - [x] SubTask 4.4: 验证初始化生成知识点和连线
  - [x] SubTask 4.5: 运行 lint 和 typecheck

# Task Dependencies

- [Task 2] 独立任务，可并行执行
- [Task 3] 独立任务，可并行执行
- [Task 4] depends on [Task 1, Task 2, Task 3]
