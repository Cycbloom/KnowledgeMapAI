# Tasks

- [x] Task 1: 修改 `withAIPerformanceTracking` 支持 sessionId 参数
  - [x] 1.1 在 `api/services/ai/utils/performanceTracker.ts` 的 options 中增加可选 `sessionId` 字段
  - [x] 1.2 将 `sessionId` 传递给 `performanceMonitor.recordLog()`

- [x] Task 2: 修改 `literatureMetadataService.extractMetadata()` 传递 sessionId
  - [x] 2.1 在 `ExtractMetadataOptions` 类型中增加可选 `sessionId` 字段
  - [x] 2.2 将 `sessionId` 传入 `withAIPerformanceTracking` 的 options

- [x] Task 3: 修改 `conceptExtractorService` 传递 sessionId
  - [x] 3.1 在 `ExtractConceptsOptions` 类型中增加可选 `sessionId` 字段
  - [x] 3.2 在 `extractConcepts()` 方法中将 `sessionId` 传入 `withAIPerformanceTracking`
  - [x] 3.3 在 `classifyConcept()` 方法中支持传递 sessionId
  - [x] 3.4 在 `locateBackboneModule()` 方法中支持传递 sessionId

- [x] Task 4: 修改 `/extract` 路由统一传递 sessionId
  - [x] 4.1 在调用 `extractMetadata` 时将 `sessionId` 传入 options
  - [x] 4.2 确认 `extractConcepts` 通过 extractOptions 接收到 sessionId
  - [x] 4.3 修改 `withLiteratureTracking`：totalTokens=0 时不记录空日志

- [x] Task 5: 修改前端 PerformanceTab 支持文献提取归组显示
  - [x] 5.1 在 `getSessionName()` 函数中增加对文献提取操作的识别，返回"文献提取"
  - [x] 5.2 补充 zh-CN.json 和 en-US.json 中的翻译 key

- [x] Task 6: 验证与测试
  - [x] 6.1 运行 `npm run check` 确认类型检查通过
  - [x] 6.2 运行 `npm run lint` 确认代码规范（唯一错误在未修改的预存文件）

# Task Dependencies
- [Task 2, 3] depends on [Task 1]
- [Task 4] depends on [Task 2, 3]
- [Task 5] can parallel with [Task 1-4]
- [Task 6] depends on all other tasks
