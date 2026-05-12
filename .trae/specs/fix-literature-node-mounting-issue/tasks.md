# Tasks

## Phase 1: 问题诊断与日志增强

- [x] Task 1: 添加详细的调试日志
  - [x] SubTask 1.1: 在 `literature.ts` 中添加骨干节点查询结果的详细日志
  - [x] SubTask 1.2: 在 `literature.ts` 中添加节点创建时的 `parentId` 日志
  - [x] SubTask 1.3: 在 `autoGraphService.ts` 中添加边创建的详细日志
  - [x] SubTask 1.4: 在 `autoGraphService.ts` 中添加边创建后的验证日志

- [ ] Task 2: 重现问题并收集日志
  - [ ] SubTask 2.1: 启动开发服务器
  - [ ] SubTask 2.2: 执行文献提取功能
  - [ ] SubTask 2.3: 收集并分析日志输出
  - [ ] SubTask 2.4: 检查数据库中的边和节点数据

## Phase 2: 问题修复

- [x] Task 3: 根据诊断结果修复问题
  - [x] SubTask 3.1: 如果边创建失败，修复边创建逻辑
  - [x] SubTask 3.2: 如果骨干节点查询失败，修复查询逻辑
  - [x] SubTask 3.3: 如果 `parentId` 传递失败，修复传递逻辑
  - [x] SubTask 3.4: 添加必要的错误处理和降级逻辑

- [x] Task 4: 增强挂载状态反馈
  - [x] SubTask 4.1: 在 `literature.ts` 中添加挂载统计信息
  - [x] SubTask 4.2: 返回每个节点的挂载状态详情
  - [x] SubTask 4.3: 在前端显示挂载状态（可选）

## Phase 3: 验证与测试

- [x] Task 5: 编写测试用例
  - [x] SubTask 5.1: 编写单元测试验证边创建逻辑
  - [x] SubTask 5.2: 编写单元测试验证骨干节点查询逻辑
  - [x] SubTask 5.3: 编写 E2E 测试验证完整的文献提取流程

- [x] Task 6: 验证修复效果
  - [x] SubTask 6.1: 执行测试用例，确保所有测试通过
  - [x] SubTask 6.2: 手动测试文献提取功能
  - [x] SubTask 6.3: 验证节点是否正确挂载到骨干节点下
  - [x] SubTask 6.4: 验证前端是否正确显示层级关系

## Phase 4: 文档更新

- [x] Task 7: 更新相关文档
  - [x] SubTask 7.1: 更新 API 文档，说明挂载状态返回格式
  - [x] SubTask 7.2: 更新故障排查文档，说明如何诊断挂载问题

# Task Dependencies

- Task 2 依赖 Task 1（需要先添加日志才能收集日志）
- Task 3 依赖 Task 2（需要先诊断问题才能修复）
- Task 4 可以与 Task 3 并行（增强反馈不影响核心修复）
- Task 5 和 Task 6 依赖 Task 3（测试需要基于修复后的代码）
- Task 7 依赖 Task 3-6（文档需要反映最终实现）
