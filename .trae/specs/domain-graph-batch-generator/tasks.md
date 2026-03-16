# Tasks

- [x] Task 1: 创建领域图谱生成面板组件
  - [x] SubTask 1.1: 创建 DomainGraphGenerator.tsx 组件基础结构
  - [x] SubTask 1.2: 实现领域主题输入区域
  - [x] SubTask 1.3: 实现推荐图谱列表展示（带选择功能）
  - [x] SubTask 1.4: 实现批量创建进度显示
  - [x] SubTask 1.5: 实现创建结果展示

- [x] Task 2: 添加领域图谱生成 API 端点
  - [x] SubTask 2.1: 创建领域分析 API（调用 AI 生成推荐图谱列表）
  - [x] SubTask 2.2: 扩展现有批量创建 API 或创建新端点
  - [x] SubTask 2.3: 实现图谱关系自动建立逻辑

- [x] Task 3: 集成到图谱地图页面
  - [x] SubTask 3.1: 在 GraphMapToolbar 添加"领域图谱生成"按钮
  - [x] SubTask 3.2: 在 GraphMap.tsx 中集成 DomainGraphGenerator 组件
  - [x] SubTask 3.3: 实现创建完成后刷新图谱地图

- [x] Task 4: 前端 API 服务层集成
  - [x] SubTask 4.1: 在 graphsApi 中添加领域分析 API 调用
  - [x] SubTask 4.2: 添加批量创建图谱的 API 调用

- [x] Task 5: 测试与验证
  - [x] SubTask 5.1: 测试领域主题输入和 AI 分析功能
  - [x] SubTask 5.2: 测试图谱选择和批量创建功能
  - [x] SubTask 5.3: 测试图谱关系自动建立功能
  - [x] SubTask 5.4: 测试可选的内容自动生成功能

# Task Dependencies

- [Task 2] depends on [Task 1] - API 端点需要在组件设计确定后实现
- [Task 3] depends on [Task 1] - 页面集成需要组件完成
- [Task 4] depends on [Task 2] - 前端 API 服务需要后端 API 就绪
- [Task 5] depends on [Task 1, Task 2, Task 3, Task 4] - 测试需要所有功能完成
