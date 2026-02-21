# Tasks

- [x] Task 1: 创建健康检查服务层 (healthService)
  - [x] SubTask 1.1: 创建 `api/services/healthService.ts` 文件
  - [x] SubTask 1.2: 实现 `getOverview()` 方法 - 获取统计概览
  - [x] SubTask 1.3: 实现 `getHeatmap()` 方法 - 获取热力图数据
  - [x] SubTask 1.4: 实现 `getWeakPoints()` 方法 - 获取薄弱知识点
  - [x] SubTask 1.5: 实现 `getPredictions()` 方法 - 获取预测数据
  - [x] SubTask 1.6: 实现 `getActivity()` 方法 - 获取活动数据

- [x] Task 2: 创建仪表盘服务层 (dashboardService)
  - [x] SubTask 2.1: 创建 `api/services/dashboardService.ts` 文件
  - [x] SubTask 2.2: 实现 `getDashboard()` 方法 - 获取仪表盘数据

- [x] Task 3: 创建认证服务层 (authService)
  - [x] SubTask 3.1: 创建 `api/services/authService.ts` 文件
  - [x] SubTask 3.2: 实现 `getProfile()` 方法 - 获取用户资料
  - [x] SubTask 3.3: 实现 `updateProfile()` 方法 - 更新用户资料

- [x] Task 4: 创建搜索服务层 (searchService)
  - [x] SubTask 4.1: 创建 `api/services/searchService.ts` 文件
  - [x] SubTask 4.2: 实现 `search()` 方法 - 关键词搜索
  - [x] SubTask 4.3: 实现 `semanticSearch()` 方法 - 语义搜索

- [x] Task 5: 扩展提示词模板服务层 (promptService)
  - [x] SubTask 5.1: 在 `promptService.ts` 添加 `create()` 方法
  - [x] SubTask 5.2: 添加 `update()` 方法
  - [x] SubTask 5.3: 添加 `delete()` 方法
  - [x] SubTask 5.4: 添加 `list()` 方法

- [x] Task 6: 创建自动图谱服务层 (autoGraphService)
  - [x] SubTask 6.1: 创建 `api/services/autoGraphService.ts` 文件
  - [x] SubTask 6.2: 实现 `createGraphNode()` 方法 - 创建图谱节点
  - [x] SubTask 6.3: 实现 `createEdge()` 方法 - 创建图谱边
  - [x] SubTask 6.4: 实现 `processAINodes()` 方法 - 处理 AI 生成的节点

- [ ] Task 7: 重构健康检查路由 (api/routes/health.ts)
  - [ ] SubTask 7.1: 重构 `GET /overview` - 调用 healthService
  - [ ] SubTask 7.2: 重构 `GET /heatmap` - 调用 healthService
  - [ ] SubTask 7.3: 重构 `GET /weak-points` - 调用 healthService
  - [ ] SubTask 7.4: 重构 `GET /predictions` - 调用 healthService
  - [ ] SubTask 7.5: 重构 `GET /activity` - 调用 healthService

- [ ] Task 8: 重构仪表盘路由 (api/routes/dashboard.ts)
  - [ ] SubTask 8.1: 重构仪表盘路由 - 调用 dashboardService

- [ ] Task 9: 重构认证路由 (api/routes/auth.ts)
  - [ ] SubTask 9.1: 重构 `GET /me` - 调用 authService
  - [ ] SubTask 9.2: 重构 `PUT /me` - 调用 authService

- [ ] Task 10: 重构搜索路由 (api/routes/search.ts)
  - [ ] SubTask 10.1: 重构搜索路由 - 调用 searchService

- [ ] Task 11: 重构提示词模板路由 (api/routes/prompts.ts)
  - [ ] SubTask 11.1: 重构 `GET /prompts` - 调用 promptService
  - [ ] SubTask 11.2: 重构 `POST /prompts` - 调用 promptService
  - [ ] SubTask 11.3: 重构 `PUT /prompts/:id` - 调用 promptService
  - [ ] SubTask 11.4: 重构 `DELETE /prompts/:id` - 调用 promptService

- [x] Task 12: 重构知识点路由 (api/routes/knowledgePoints.ts)
  - [x] SubTask 12.1: 检查并移除所有直接数据库操作
  - [x] SubTask 12.2: 确保所有操作通过 knowledgePointService

- [x] Task 13: 重构学习路径路由 (api/routes/learningPath.ts)
  - [x] SubTask 13.1: 将数据库操作迁移到服务层
  - [x] SubTask 13.2: 确保使用正确的字段名

- [x] Task 14: 重构自动图谱路由 (api/routes/autoGraph.ts)
  - [x] SubTask 14.1: 将数据库操作迁移到 autoGraphService
  - [x] SubTask 14.2: 确保使用正确的字段名

- [x] Task 15: 验证与测试
  - [x] SubTask 15.1: 验证所有路由无直接数据库操作
  - [x] SubTask 15.2: 验证健康检查 API 正常工作
  - [x] SubTask 15.3: 验证仪表盘 API 正常工作
  - [x] SubTask 15.4: 验证搜索 API 正常工作

# Task Dependencies

- [Task 7] depends on [Task 1]
- [Task 8] depends on [Task 2]
- [Task 9] depends on [Task 3]
- [Task 10] depends on [Task 4]
- [Task 11] depends on [Task 5]
- [Task 14] depends on [Task 6]
- [Task 15] depends on [Task 7, Task 8, Task 9, Task 10, Task 11, Task 12, Task 13, Task 14]
