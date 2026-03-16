# Tasks

- [x] Task 1: 优化图谱推荐 API - 简化为单次生成
  - [x] SubTask 1.1: 移除多轮生成逻辑，改为单次生成推荐列表
  - [x] SubTask 1.2: 优化 AI prompt，只生成标题和描述，不生成知识点
  - [x] SubTask 1.3: 简化返回结构，移除 rounds 等元数据
  - [x] SubTask 1.4: 调整 AI 超时配置，确保单次请求能完成

- [x] Task 2: 拆分批量创建 API - 分离创建和初始化
  - [x] SubTask 2.1: 修改 `/domain/batch-create` API，只创建空图谱
  - [x] SubTask 2.2: 移除 `auto_generate_content` 参数的逻辑
  - [x] SubTask 2.3: 返回创建成功的图谱列表，供后续初始化使用

- [x] Task 3: 新增分层初始化 API
  - [x] SubTask 3.1: 创建 `/graphs/:id/initialize` API 端点
  - [x] SubTask 3.2: 实现三层初始化逻辑（根节点 → 核心节点 → 子节点）
  - [x] SubTask 3.3: 每层单独 AI 请求，避免超时
  - [x] SubTask 3.4: 返回初始化进度和结果

- [x] Task 4: 新增批量初始化 API
  - [x] SubTask 4.1: 创建 `/graphs/batch-initialize` API 端点
  - [x] SubTask 4.2: 支持并行初始化多个图谱
  - [x] SubTask 4.3: 返回每个图谱的初始化状态

- [x] Task 5: 更新前端组件 - 两阶段 UI
  - [x] SubTask 5.1: 更新 DomainGraphGenerator 组件，分离推荐和初始化
  - [x] SubTask 5.2: 第一阶段完成后显示推荐列表
  - [x] SubTask 5.3: 用户选择后先创建空图谱
  - [x] SubTask 5.4: 创建完成后询问是否初始化知识点
  - [x] SubTask 5.5: 初始化时显示分层进度

- [x] Task 6: 更新前端 API 服务
  - [x] SubTask 6.1: 更新 `analyzeDomain` API 调用
  - [x] SubTask 6.2: 更新 `batchCreateDomainGraphs` API 调用
  - [x] SubTask 6.3: 新增 `initializeGraph` API 调用
  - [x] SubTask 6.4: 新增 `batchInitializeGraphs` API 调用

- [x] Task 7: 测试与验证
  - [x] SubTask 7.1: 测试图谱推荐功能，确保不超时
  - [x] SubTask 7.2: 测试批量创建空图谱
  - [x] SubTask 7.3: 测试分层初始化功能
  - [x] SubTask 7.4: 测试并行初始化多个图谱
  - [x] SubTask 7.5: 运行 lint 和 typecheck

# Task Dependencies

- [Task 2] depends on [Task 1] - 创建 API 依赖推荐 API 的简化
- [Task 3] depends on [Task 2] - 初始化 API 依赖创建 API
- [Task 4] depends on [Task 3] - 批量初始化依赖单图谱初始化
- [Task 5] depends on [Task 1, Task 2, Task 3, Task 4] - 前端依赖所有后端 API
- [Task 6] depends on [Task 1, Task 2, Task 3, Task 4] - API 服务依赖后端 API
- [Task 7] depends on [Task 1, Task 2, Task 3, Task 4, Task 5, Task 6] - 测试依赖所有功能完成
