# Tasks

- [x] Task 1: 修改 recursiveGraphProcessor.ts 添加节点去重逻辑
  - [x] SubTask 1.1: 在处理器开始时查询图谱中已存在的所有节点标题
  - [x] SubTask 1.2: 创建 `existingNodeTitles` Set 存储已存在节点名称
  - [x] SubTask 1.3: 修改初始化阶段（depth 1）的核心节点创建逻辑，添加去重检查
  - [x] SubTask 1.4: 修改扩展阶段（depth 2）的子节点创建逻辑，添加去重检查
  - [x] SubTask 1.5: 修改深度扩展阶段（depth 3）的叶子节点创建逻辑，添加去重检查
  - [x] SubTask 1.6: 添加跳过重复节点的日志记录

- [x] Task 2: 修改 utils.ts 工具函数添加节点去重逻辑
  - [x] SubTask 2.1: 修改 `generateNodesForGraph` 函数，在生成前查询已存在节点
  - [x] SubTask 2.2: 在 `generateNodesForGraph` 中添加核心节点去重检查
  - [x] SubTask 2.3: 修改 `expandNodeForGraph` 函数，查询已存在的子节点
  - [x] SubTask 2.4: 在 `expandNodeForGraph` 中传递已存在子节点信息给 prompt
  - [x] SubTask 2.5: 在 `expandNodeForGraph` 中添加子节点去重检查

- [x] Task 3: 优化 prompt 模板增强去重引导
  - [x] SubTask 3.1: 更新 `auto_graph_expand` 模板，添加全图谱节点列表变量
  - [x] SubTask 3.2: 在 prompt 中强调不要生成已存在的节点名称

- [x] Task 4: 测试验证
  - [x] SubTask 4.1: 测试新建图谱时不会生成重复节点
  - [x] SubTask 4.2: 测试扩展图谱时不会生成重复节点
  - [x] SubTask 4.3: 测试递归生成时跨层级不会生成重复节点
  - [x] SubTask 4.4: 验证日志正确记录跳过的重复节点

# Task Dependencies

- [Task 3] depends on [Task 1] and [Task 2]
- [Task 4] depends on [Task 1], [Task 2], and [Task 3]
