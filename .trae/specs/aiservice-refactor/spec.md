# AIService 拆分重构 Spec

## Why

`aiService.ts` 当前 1765 行，包含 14 个方法（chat、generateCards、expandKnowledge、generatePodcastScript、extractConcepts 等），职责过重。所有方法耦合在单个类中导致：代码导航困难、独立测试不便、多人协作时冲突风险高、各子功能无法独立演进。

## What Changes

将 `AIService` 从单一大类拆分为**按领域划分的子服务** + **Facade 门面类**：

- 新建 `EmbeddingService` — 嵌入向量生成（`generateEmbedding`、`generateEmbeddingsBatch`）
- 新建 `ChatService` — 对话与辅导（`chat`、`tutorChat`）
- 新建 `CardGenerationService` — 学习卡片生成（`generateCards`）
- 新建 `KnowledgeExpansionService` — 知识扩展与推荐（`expandKnowledge`、`getBranchSuggestions`、`suggestNextTopic`）
- 新建 `ContentGenerationService` — 内容生成（`generatePodcastScript`、`generateLearningMaterial`、`generateTaskDetails`）
- 新建 `AnalysisService` — 分析与提取（`extractConcepts`、`generateGraphFromImage`、`analyzeCrossGraphConnections`）
- 改造 `AIService` 为 Facade 门面，委托调用上述子服务
- 抽取共享工具函数到 `aiUtils.ts`（请求去重、请求 Key 生成）
- 统一 Prompt 管理：将 `suggestNextTopic`、`tutorChat`、`generateGraphFromImage` 中硬编码的 Prompt 迁移至数据库或统一常量

**不破坏外部 API**：所有调用方仍通过 `aiService.xxx()` 调用，签名不变。

## Impact

- Affected specs: 无直接关联 spec
- Affected code:
  - 核心文件: `api/services/ai/aiService.ts`
  - 新增文件: `api/services/ai/embeddingOps.ts`、`api/services/ai/chatService.ts`、`api/services/ai/cardGenerationService.ts`、`api/services/ai/knowledgeExpansionService.ts`、`api/services/ai/contentGenerationService.ts`、`api/services/ai/analysisService.ts`、`api/services/ai/aiUtils.ts`
  - 调用方（28 个文件）无需改动，因 Facade 保持相同 API
  - 测试文件: `api/__tests__/services/aiService.test.ts`

## ADDED Requirements

### Requirement: EmbeddingOps 服务

系统 SHALL 提供独立的嵌入向量操作服务，封装 `generateEmbedding` 和 `generateEmbeddingsBatch` 方法。

#### Scenario: 单条嵌入生成
- **WHEN** 调用 `embeddingOps.generateEmbedding(text)`
- **THEN** 返回 `number[] | null`，行为与原 `aiService.generateEmbedding` 完全一致

#### Scenario: 批量嵌入生成
- **WHEN** 调用 `embeddingOps.generateEmbeddingsBatch(texts)`
- **THEN** 返回 `(number[] | null)[]`，行为与原 `aiService.generateEmbeddingsBatch` 完全一致

### Requirement: ChatService 服务

系统 SHALL 提供独立的对话服务，封装 `chat` 和 `tutorChat` 方法。

### Requirement: CardGenerationService 服务

系统 SHALL 提供独立的卡片生成服务，封装 `generateCards` 方法及相关的类型定义（`CardDifficulty`、`GenerateCardsOptions`）。

### Requirement: KnowledgeExpansionService 服务

系统 SHALL 提供独立的知识扩展服务，封装 `expandKnowledge`、`getBranchSuggestions`、`suggestNextTopic` 方法。

### Requirement: ContentGenerationService 服务

系统 SHALL 提供独立的内容生成服务，封装 `generatePodcastScript`、`generateLearningMaterial`、`generateTaskDetails` 方法及 `GenerateLearningMaterialResult` 类型。

### Requirement: AnalysisService 服务

系统 SHALL 提供独立的分析提取服务，封装 `extractConcepts`、`generateGraphFromImage`、`analyzeCrossGraphConnections` 方法。

### Requirement: AI 共享工具函数模块

系统 SHALL 将 `dedupedRequest`、`generateRequestKey`、`isEnglishLanguage` 等共享工具抽取到 `aiUtils.ts`。

### Requirement: AIService Facade 门面

系统 SHALL 保留 `AIService` 类作为门面，内部委托给各子服务，对外保持完全相同的 API 签名和导出方式（`export const aiService = new AIService()`）。

## MODIFIED Requirements

### Requirement: Prompt 管理

以下方法当前硬编码了 system prompt，SHALL 迁移为使用 `promptService.getRenderedPrompt()` 或统一 Prompt 常量：
- `suggestNextTopic` — 第 1207-1214 行硬编码 system prompt
- `tutorChat` — 第 1298-1310 行硬编码 system prompt
- `generateGraphFromImage` — 第 974-983 行硬编码 system prompt

## REMOVED Requirements

无（仅重构，无功能移除）
