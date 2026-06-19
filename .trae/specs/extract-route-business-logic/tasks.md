# Tasks

- [x] Task 1: promptService 新增 optimizeWithAI 方法
  - [x] 1.1 在 `PromptService` 类中添加 `optimizeWithAI(templateContent: string, instruction?: string)` 方法
  - [x] 1.2 方法内：获取 AI provider → getRenderedPrompt("optimize_prompt", ...) 构建系统提示 → 构建 messages → 调用 AI → 返回优化文本
  - [x] 1.3 简化 `api/routes/prompts.ts` 的 `/optimize` 路由，委托给 `promptService.optimizeWithAI()`

- [x] Task 2: ragService 新增 search 方法
  - [x] 2.1 在 `RAGService` 类中添加 `search(query, userId, options)` 方法
  - [x] 2.2 方法内：根据 `useGraphContext && graphId` 分支调用 `graphAugmentedSearch` 或 `semanticSearch`
  - [x] 2.3 简化 `api/routes/rag.ts` 的 `/search` 路由，委托给 `ragService.search()`

- [x] Task 3: studyRouteService 新增 parseCardQueryParams + studyService 事件发布
  - [x] 3.1 在 `StudyRouteService` 类中添加 `parseCardQueryParams(query)` 静态方法
  - [x] 3.2 简化 `api/routes/study.ts` 的 GET `/cards` 路由，使用 `parseCardQueryParams`
  - [x] 3.3 在 `studyService.updateProgress()` 内部增加 `review_completed` 事件发布
  - [x] 3.4 简化 `api/routes/study.ts` 的 PUT `/cards/:id/progress` 路由，移除事件发布代码

- [x] Task 4: backupService 新增 importBackup 和 exportAndRecord 方法
  - [x] 4.1 在 `BackupService` 类中添加 `importBackup(supabase, userId, data, mode)` 方法
  - [x] 4.2 在 `BackupService` 类中添加 `exportAndRecord(supabase, userId, type)` 方法
  - [x] 4.3 简化 `api/routes/backup.ts` 的 `/import` 和 `/export` 路由

- [x] Task 5: 验证类型检查
  - [x] 5.1 运行 `npm run check` 确保无类型错误
  - [x] 5.2 运行 `npm run lint` 确保无 lint 错误

# Task Dependencies
- [Task 5] depends on [Task 1-4]
- [Task 1-4] 可并行
