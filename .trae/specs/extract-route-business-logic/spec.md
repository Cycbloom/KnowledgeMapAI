# 路由层非 DB 业务逻辑下沉 Spec

## Why
前七轮重构已将路由层直接 DB 调用清零。但路由中仍残留非 DB 业务逻辑（编排、分支判断、事件发布等），导致路由层职责不单一。本轮目标是将这些业务逻辑下沉到服务层，使路由只负责：提取参数 → 调用服务 → 格式化响应。

## What Changes
- **扩展** `api/services/ai/promptService.ts` — 新增 `optimizeWithAI(templateContent, instruction)` 方法，封装 AI 调用逻辑
- **扩展** `api/services/ai/ragService.ts` — 新增 `search(query, userId, options)` 方法，封装搜索分支逻辑
- **扩展** `api/services/study/studyRouteService.ts` — 新增 `parseCardQueryParams(query)` 方法，封装查询参数解析
- **扩展** `api/services/study/studyService.ts` — `updateProgress()` 内部增加事件发布
- **扩展** `api/services/common/backupService.ts` — 新增 `importBackup()` 和 `exportAndRecord()` 方法
- **简化** `api/routes/prompts.ts` — `/optimize` 路由委托给 `promptService.optimizeWithAI()`
- **简化** `api/routes/rag.ts` — `/search` 路由委托给 `ragService.search()`
- **简化** `api/routes/study.ts` — `/cards` GET 路由使用 `parseCardQueryParams()`，`/cards/:id/progress` PUT 路由移除事件发布代码
- **简化** `api/routes/backup.ts` — `/import` 和 `/export` 路由委托给 backupService

## Impact
- Affected specs: 无破坏性变更，所有 API 接口保持不变
- Affected code: 5 个路由文件 + 5 个服务文件

## ADDED Requirements

### Requirement: promptService.optimizeWithAI
- `optimizeWithAI(templateContent, instruction)` — 获取 AI provider，使用 `promptService.getRenderedPrompt("optimize_prompt", ...)` 构建系统提示，调用 AI 并返回优化后的内容
- 返回 `Promise<string>`（优化后的 prompt 文本）

### Requirement: ragService.search
- `search(query, userId, options)` — 封装搜索分支逻辑：当 `useGraphContext && graphId` 时调用 `graphAugmentedSearch`，否则调用 `semanticSearch`
- options 包含 `graphId`, `matchThreshold`, `matchCount`, `useGraphContext`, `graphHops`
- 返回 `Promise<RAGSearchResult[]>`

### Requirement: studyRouteService.parseCardQueryParams
- `parseCardQueryParams(query)` — 从 Express query 对象解析卡片查询参数，返回结构化对象 `{ graphId, knowledgePointId, knowledgePointIds, dueOnly, refresh }`

### Requirement: studyService.updateProgress 事件发布
- `updateProgress()` 完成进度更新后，内部发布 `review_completed` 事件，替代路由层手动发布
- 新增 `userId` 参数用于事件发布

### Requirement: backupService.importBackup
- `importBackup(supabase, userId, data, mode)` — 封装导入逻辑：mode=replace 时先 cascadeDeleteGraph，再 restoreBackupData，最后清除缓存
- 返回 `Promise<{ stats; mode }>`

### Requirement: backupService.exportAndRecord
- `exportAndRecord(supabase, userId, type)` — 封装导出+快照记录逻辑：createBackup → createSnapshotRecord
- 返回 `Promise<{ filePath; fileSize; graphsCount; nodesCount }>`

## MODIFIED Requirements
无额外修改。

## REMOVED Requirements
无。所有 API 行为保持不变。
