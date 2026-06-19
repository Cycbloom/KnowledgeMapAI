# Tasks

- [x] Task 1: 将 learningPath.ts 的 3 个端点合并到 learningPaths.ts
  - [x] 在 learningPaths.ts 中添加 `POST /generate-preview` 端点（使用 `learningPathRouteService.generatePath`，不保存到数据库）
  - [x] 在 learningPaths.ts 中添加 `GET /progress/:graphId` 端点（使用 `learningPathRouteService.getProgress`）
  - [x] 在 learningPaths.ts 中添加 `POST /questions` 端点（使用 `learningPathRouteService.generateQuestions`）
  - [x] 导入 `learningPathRouteService` 并添加所需的 schema（getQuestionsSchema）

- [x] Task 2: 更新 app.ts 移除旧路由挂载
  - [x] 移除 `import learningPathRoutes from "./routes/learningPath"`
  - [x] 移除 `app.use("/api/learning-path", learningPathRoutes)`

- [x] Task 3: 更新前端 API 客户端路径
  - [x] 在 `src/services/api/learningPaths.ts` 中，将 `learningPathApi` 的请求路径从 `/learning-path/` 改为 `/learning-paths/`
  - [x] 更新 `learningPathApi.generate` 的路径为 `/learning-paths/generate-preview`
  - [x] 更新 `learningPathApi.getQuestions` 的路径为 `/learning-paths/questions`
  - [x] 更新 `learningPathApi.getProgress` 的路径为 `/learning-paths/progress/${graphId}`

- [x] Task 4: 删除 learningPath.ts 文件
  - [x] 删除 `api/routes/learningPath.ts`

- [x] Task 5: 运行类型检查和 lint 验证
  - [x] 运行 `npm run check` 确保无类型错误
  - [x] 运行 `npm run lint` 确保无 lint 错误

# Task Dependencies
- Task 2 depends on Task 1（先合并端点再移除旧路由）
- Task 3 depends on Task 1（前端路径需与后端新端点对应）
- Task 4 depends on Task 1 and Task 2（确认新端点可用后再删除旧文件）
- Task 5 depends on Task 1, 2, 3, 4（所有修改完成后验证）
