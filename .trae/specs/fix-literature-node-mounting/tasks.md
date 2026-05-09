# Tasks

## Phase 1: 后端修复

- [x] Task 1: 修复文献提取节点挂载逻辑
  - [x] SubTask 1.1: 在 `api/routes/literature.ts` 的 `/apply` 接口中，添加骨干节点查询逻辑
  - [x] SubTask 1.2: 构建 `backboneModule -> nodeId` 的映射
  - [x] SubTask 1.3: 在创建节点时，根据 `targetModule` 设置正确的 `parentId`
  - [x] SubTask 1.4: 添加错误处理，当骨干节点不存在时的降级处理
  - [x] SubTask 1.5: 添加日志记录，记录挂载过程

- [x] Task 2: 验证节点创建逻辑
  - [x] SubTask 2.1: 确认 `autoGraphService.processAINodes` 正确处理 `parentId`
  - [x] SubTask 2.2: 确认边创建逻辑正确建立父子关系
  - [x] SubTask 2.3: 测试节点创建后的父子关系

## Phase 2: 测试与验证

- [x] Task 3: 编写单元测试
  - [x] SubTask 3.1: 测试骨干节点查询功能
  - [x] SubTask 3.2: 测试节点挂载逻辑
  - [x] SubTask 3.3: 测试骨干节点不存在时的降级处理

- [x] Task 4: 编写 E2E 测试
  - [x] SubTask 4.1: 测试完整的文献提取流程
  - [x] SubTask 4.2: 验证提取的概念节点正确挂载到骨干节点下
  - [x] SubTask 4.3: 验证节点在图谱中的层级关系
  - [x] SubTask 4.4: 测试骨干节点不存在时的场景

## Phase 3: 文档更新

- [x] Task 5: 更新相关文档
  - [x] SubTask 5.1: 更新 API 文档，说明节点挂载行为
  - [x] SubTask 5.2: 更新用户文档，说明概念节点的层级关系

# Task Dependencies

- Task 2 依赖 Task 1（验证逻辑需要先修复）
- Task 3 和 Task 4 可以并行（单元测试和 E2E 测试）
- Task 5 依赖 Task 1-4（文档需要反映最终实现）
