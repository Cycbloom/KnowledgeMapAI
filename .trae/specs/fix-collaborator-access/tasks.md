# Tasks

- [x] Task 1: 修复 graphService.getGraph() 方法
  - [x] SubTask 1.1: 移除应用层的 user_id 硬性过滤条件
  - [x] SubTask 1.2: 添加协作者权限检查逻辑
  - [x] SubTask 1.3: 确保公开图谱仍然可以匿名访问

- [x] Task 2: 验证 graphService.getGraphNodes() 方法
  - [x] SubTask 2.1: 确认 RLS 策略正确配置
  - [x] SubTask 2.2: 移除任何应用层不必要的过滤

- [x] Task 3: 更新图谱访问路由
  - [x] SubTask 3.1: 确保 GET /api/graphs/:id 路由正确处理协作者访问
  - [x] SubTask 3.2: 确保 GET /api/graphs/:id/nodes 路由正确处理协作者访问

- [x] Task 4: 测试验证
  - [x] SubTask 4.1: 运行 npm run lint 和 npm run check
  - [x] SubTask 4.2: 手动测试协作者访问图谱流程
  - [x] SubTask 4.3: 验证节点正确显示

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1, Task 2, Task 3]
