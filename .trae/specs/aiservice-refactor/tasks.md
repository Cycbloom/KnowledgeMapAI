# Tasks

- [x] Task 1: 抽取共享工具函数到 `aiUtils.ts`
  - [x] 将 `isEnglishLanguage`、`dedupedRequest`、`generateRequestKey` 从 `aiService.ts` 移至 `api/services/ai/aiUtils.ts`
  - [x] 在 `aiUtils.ts` 中导出 `pendingRequests` Map（供去重使用）
  - [x] 在 `aiService.ts` 中改为从 `aiUtils.ts` import

- [x] Task 2: 创建 `EmbeddingOps` 服务
  - [x] 新建 `api/services/ai/embeddingOps.ts`，将 `generateEmbedding` 和 `generateEmbeddingsBatch` 迁入
  - [x] 导出 `embeddingOps` 单例

- [x] Task 3: 创建 `ChatService` 服务
  - [x] 新建 `api/services/ai/chatService.ts`，将 `chat` 和 `tutorChat` 迁入
  - [x] 将 `tutorChat` 的硬编码 system prompt 替换为 `promptService.getRenderedPrompt()` 调用
  - [x] 导出 `chatService` 单例

- [x] Task 4: 创建 `CardGenerationService` 服务
  - [x] 新建 `api/services/ai/cardGenerationService.ts`，将 `generateCards` 及类型定义迁入
  - [x] 导出 `cardGenerationService` 单例

- [x] Task 5: 创建 `KnowledgeExpansionService` 服务
  - [x] 新建 `api/services/ai/knowledgeExpansionService.ts`，将 `expandKnowledge`、`getBranchSuggestions`、`suggestNextTopic` 迁入
  - [x] 将 `suggestNextTopic` 的硬编码 system prompt 替换为 `promptService.getRenderedPrompt()` 调用
  - [x] 导出 `knowledgeExpansionService` 单例

- [x] Task 6: 创建 `ContentGenerationService` 服务
  - [x] 新建 `api/services/ai/contentGenerationService.ts`，将 `generatePodcastScript`、`generateLearningMaterial`、`generateTaskDetails` 及 `GenerateLearningMaterialResult` 类型迁入
  - [x] 导出 `contentGenerationService` 单例

- [x] Task 7: 创建 `AnalysisService` 服务
  - [x] 新建 `api/services/ai/analysisService.ts`，将 `extractConcepts`、`generateGraphFromImage`、`analyzeCrossGraphConnections` 迁入
  - [x] 将 `generateGraphFromImage` 的硬编码 system prompt 替换为 `promptService.getRenderedPrompt()` 调用
  - [x] 导出 `analysisService` 单例

- [x] Task 8: 改造 `AIService` 为 Facade 门面
  - [x] 清空 `AIService` 类中的所有方法实现
  - [x] 每个方法改为委托调用对应子服务的同名方法
  - [x] 保持相同的类签名和 `export const aiService = new AIService()` 导出方式
  - [x] 确保所有 28 个调用方无需任何改动

# Task Dependencies
- [Task 2] depends on [Task 1]
- [Task 3] depends on [Task 1]
- [Task 4] depends on [Task 1]
- [Task 5] depends on [Task 1]
- [Task 6] depends on [Task 1]
- [Task 7] depends on [Task 1]
- [Task 8] depends on [Task 2, Task 3, Task 4, Task 5, Task 6, Task 7]
