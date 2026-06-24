# Tasks

- [x] Task 1: 重构 api/utils/nodeHelpers.ts，消除重复定义
  - [x] SubTask 1.1: 将 4 个重复项（GraphNodeRaw、getKnowledgePoint、buildNodeFromGraphNode、buildNodesFromGraphNodes）改为从 shared 重新导出
  - [x] SubTask 1.2: 保留 api 独有的 4 个函数（getGraphNodesFromNewTable、getGraphNodesBatchFromNewTable、createKnowledgePointWithGraphNode、getKnowledgePointsByIds）
  - [x] SubTask 1.3: 确保所有现有消费者（10 个文件）无需修改导入路径

- [x] Task 2: 验证迁移结果
  - [x] SubTask 2.1: 运行 TypeScript 类型检查确认无报错
  - [x] SubTask 2.2: 确认 api/utils/nodeHelpers.ts 不再有与 shared 重复的类型或函数定义

# Task Dependencies
- Task 2 依赖 Task 1
