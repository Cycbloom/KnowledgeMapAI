# Tasks

- [ ] Task 1: 修复 backboneModuleMap 构建逻辑中的级别过滤问题
  - [ ] 1.1 在 graph_nodes 查询中添加 `level` 字段
  - [ ] 1.2 添加级别过滤条件，只接受 `'root'` 或 `'core'` 级别的节点
  - [ ] 1.3 实现候选节点收集和优先级选择（core > root）
  - [ ] 1.4 添加详细的日志输出（跳过警告 + 最终选择信息）

- [ ] Task 2: 验证修复效果
  - [ ] 2.1 运行类型检查 `npm run check:incremental`
  - [ ] 2.2 运行代码检查 `npm run lint`
  - [ ] 2.3 手动测试文献提取功能，验证 parentId 指向正确的骨干节点

# Task Dependencies
- [Task 2] depends on [Task 1]
