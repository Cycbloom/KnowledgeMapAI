# Tasks

- [x] Task 1: 创建知识点服务层 (knowledgePointService)
  - [x] SubTask 1.1: 创建 `api/services/knowledgePointService.ts` 文件
  - [x] SubTask 1.2: 实现 `create()` 方法 - 创建知识点，自动生成 embedding
  - [x] SubTask 1.3: 实现 `get()` 方法 - 获取单个知识点
  - [x] SubTask 1.4: 实现 `update()` 方法 - 更新知识点内容
  - [x] SubTask 1.5: 实现 `delete()` 方法 - 硬删除知识点
  - [x] SubTask 1.6: 实现 `searchSimilar()` 方法 - 语义相似度搜索
  - [x] SubTask 1.7: 实现 `listAccessible()` 方法 - 获取可访问的知识点列表
  - [x] SubTask 1.8: 实现 `getGraphs()` 方法 - 获取知识点所属图谱

- [x] Task 2: 创建图谱节点服务层 (graphNodeService)
  - [x] SubTask 2.1: 创建 `api/services/graphNodeService.ts` 文件
  - [x] SubTask 2.2: 实现 `addToGraph()` 方法 - 添加知识点到图谱
  - [x] SubTask 2.3: 实现 `removeFromGraph()` 方法 - 从图谱移除知识点（软删除）
  - [x] SubTask 2.4: 实现 `updatePosition()` 方法 - 更新节点位置
  - [x] SubTask 2.5: 实现 `batchUpdatePositions()` 方法 - 批量更新位置
  - [x] SubTask 2.6: 实现 `updateLevel()` 方法 - 更新节点层级
  - [x] SubTask 2.7: 实现 `getGraphNodes()` 方法 - 获取图谱所有节点
  - [x] SubTask 2.8: 实现 `batchDelete()` 方法 - 批量删除节点

- [x] Task 3: 创建边服务层 (edgeService)
  - [x] SubTask 3.1: 创建 `api/services/edgeService.ts` 文件
  - [x] SubTask 3.2: 实现 `create()` 方法 - 创建边，使用新字段名
  - [x] SubTask 3.3: 实现 `delete()` 方法 - 删除边
  - [x] SubTask 3.4: 实现 `getGraphEdges()` 方法 - 获取图谱所有边
  - [x] SubTask 3.5: 实现 `deleteByKnowledgePoint()` 方法 - 删除知识点相关的所有边

- [x] Task 4: 创建学习服务层 (studyService)
  - [x] SubTask 4.1: 创建 `api/services/studyService.ts` 文件
  - [x] SubTask 4.2: 实现 `getCards()` 方法 - 获取学习卡片，使用 knowledge_point_id
  - [x] SubTask 4.3: 实现 `createCard()` 方法 - 创建卡片
  - [x] SubTask 4.4: 实现 `createCardsBatch()` 方法 - 批量创建卡片
  - [x] SubTask 4.5: 实现 `updateProgress()` 方法 - 更新学习进度（FSRS）
  - [x] SubTask 4.6: 实现 `deleteCard()` 方法 - 删除卡片
  - [x] SubTask 4.7: 实现 `deleteCardsBatch()` 方法 - 批量删除卡片

- [x] Task 5: 重构节点路由 (api/routes/nodes.ts)
  - [x] SubTask 5.1: 重构 `POST /nodes` - 调用服务层创建节点
  - [x] SubTask 5.2: 重构 `GET /nodes/:id` - 调用服务层获取节点
  - [x] SubTask 5.3: 重构 `PUT /nodes/:id` - 调用服务层更新节点
  - [x] SubTask 5.4: 重构 `DELETE /nodes/:id` - 调用服务层删除节点
  - [x] SubTask 5.5: 重构 `POST /nodes/batch-delete` - 调用服务层批量删除
  - [x] SubTask 5.6: 重构 `POST /nodes/batch-update-positions` - 调用服务层批量更新位置
  - [x] SubTask 5.7: 重构 `POST /edges` - 调用服务层创建边，使用新字段名
  - [x] SubTask 5.8: 重构 `DELETE /edges/:id` - 调用服务层删除边

- [x] Task 6: 重构学习路由 (api/routes/study.ts)
  - [x] SubTask 6.1: 重构 `GET /cards` - 调用服务层获取卡片
  - [x] SubTask 6.2: 重构 `POST /cards` - 调用服务层创建卡片
  - [x] SubTask 6.3: 重构 `POST /cards/batch` - 调用服务层批量创建卡片
  - [x] SubTask 6.4: 重构 `PUT /cards/:id/progress` - 调用服务层更新进度

- [x] Task 7: 更新前端 API 客户端
  - [x] SubTask 7.1: 更新 `src/services/api/nodes.ts` - 适配新字段名
  - [x] SubTask 7.2: 更新 `src/services/api/study.ts` - 适配新字段名
  - [x] SubTask 7.3: 更新 `src/hooks/useGraphNodeOperations.ts` - 适配新 API
  - [x] SubTask 7.4: 更新 `src/hooks/useQueries.ts` - 适配新字段名

- [x] Task 8: 更新 Schema 验证
  - [x] SubTask 8.1: 更新 `api/schemas/index.ts` 中的 createEdgeSchema
  - [x] SubTask 8.2: 更新 `api/schemas/index.ts` 中的 createCardSchema

- [ ] Task 9: 验证与测试
  - [ ] SubTask 9.1: 验证节点创建流程正常
  - [ ] SubTask 9.2: 验证边创建使用新字段名
  - [ ] SubTask 9.3: 验证学习卡片关联正确
  - [ ] SubTask 9.4: 验证知识点复用功能正常

# Task Dependencies

- [Task 5] depends on [Task 1, Task 2, Task 3]
- [Task 6] depends on [Task 4]
- [Task 7] depends on [Task 5, Task 6]
- [Task 8] depends on [Task 1, Task 3, Task 4]
- [Task 9] depends on [Task 5, Task 6, Task 7, Task 8]
