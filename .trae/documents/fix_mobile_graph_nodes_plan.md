# 修复移动端知识图谱节点问题 - 实施计划

## [x] 任务 1: 修复移动端节点 API 构建问题
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 在 `src/services/mobile/nodes.ts` 中添加 `buildNodeFromGraphNode` 函数的移植
  - 修改 `getByGraphId` 方法，使用该函数正确构建 Node 类型
  - 确保从 `graph_nodes` 和 `knowledge_points` 表正确合并数据
- **Success Criteria**:
  - 移动端 API 返回的节点包含完整的 title、content 等字段
- **Test Requirements**:
  - `programmatic` TR-1.1: 验证返回的节点有正确的 title 字段 ✓
  - `human-judgement` TR-1.2: 移动端大纲视图能正常显示节点 ✓
- **Notes**: 已完成，添加了完整的节点构建逻辑

## [x] 任务 2: 增强 GraphOutline 组件的错误处理
- **Priority**: P1
- **Depends On**: 任务 1
- **Description**: 
  - 在 `GraphOutline.tsx` 中添加对 undefined 节点的处理
  - 在排序前检查节点和 title 字段是否存在
  - 添加安全检查以防止 localeCompare 错误
- **Success Criteria**:
  - 即使节点数据异常，组件也不会崩溃
- **Test Requirements**:
  - `programmatic` TR-2.1: 验证即使存在无效节点，组件也能正常渲染 ✓
  - `human-judgement` TR-2.2: 点击大纲视图不再报错 ✓
- **Notes**: 已完成，添加了安全的 title 检查和节点过滤

## [x] 任务 3: 修复移动端查询时使用正确的 SELECT 语句
- **Priority**: P1
- **Depends On**: 任务 1
- **Description**: 
  - 在移动端 API 中使用与后端一致的 `GRAPH_NODES_SELECT` 查询语句
  - 确保查询包含完整的 knowledge_points 数据
- **Success Criteria**:
  - 移动端查询能获取到完整的节点数据
- **Test Requirements**:
  - `programmatic` TR-3.1: 验证查询返回的数据包含 knowledge_points 嵌套信息 ✓
- **Notes**: 已完成，使用了与后端一致的查询语句
