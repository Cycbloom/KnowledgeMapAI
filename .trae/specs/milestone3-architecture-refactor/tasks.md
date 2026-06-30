# Tasks

## Round 1 — 基础设施 + 核心后端

- [x] Task R1-1: 拆分 graph.ts 类型文件（1422行 → re-export聚合 + 13个子文件）
  - [x] SubTask R1-1.1: 读取 `shared/types/graph.ts`，按子领域识别所有类型分组
  - [x] SubTask R1-1.2: 创建子文件（graph-core/knowledge-point/node/edge/domain/entity/template/collaboration/literature/discovery/combined-view/analysis/story.ts）
  - [x] SubTask R1-1.3: 将 graph.ts 改为 re-export 聚合文件
  - [x] SubTask R1-1.4: 运行 `npm run check` 确认所有现有导入仍然工作

- [x] Task R1-2: 拆分 scheduler.ts 类型文件（796行 → re-export聚合 + 6个子文件）
  - [x] SubTask R1-2.1: 读取 `shared/types/scheduler.ts`，按子领域识别所有类型分组
  - [x] SubTask R1-2.2: 创建子文件（scheduler-core/task/focus/achievement/study/legacy.ts）
  - [x] SubTask R1-2.3: 将 scheduler.ts 改为 re-export 聚合文件
  - [x] SubTask R1-2.4: 运行 `npm run check` 确认兼容

- [x] Task R1-3: 拆分 graphService.ts God Object（2042行 → 644行Facade + 2个子服务）
  - [x] SubTask R1-3.1: 读取并识别方法分组
  - [x] SubTask R1-3.2: 提取 graphQueryService（855行）
  - [x] SubTask R1-3.3: 提取 graphBatchService（443行）
  - [x] SubTask R1-3.4: graphService 保留为 Facade（644行）
  - [x] SubTask R1-3.5: 更新 graph/index.ts 导出
  - [x] SubTask R1-3.6: 运行 `npm run check` 确认兼容

- [x] Task R1-4: 拆分 learningPathService.ts God Object（1858行 → 1377行Facade + 3个子服务）
  - [x] SubTask R1-4.1: 读取并识别方法分组
  - [x] SubTask R1-4.2: 提取 learningPathNodeService（445行）
  - [x] SubTask R1-4.3: 提取 learningPathProgressService（150行）
  - [x] SubTask R1-4.4: 提取 learningPathPlanService（70行）
  - [x] SubTask R1-4.5: learningPathService 保留为 Facade（1377行，含类型定义170行+核心CRUD）
  - [x] SubTask R1-4.6: 更新 study/index.ts 导出
  - [x] SubTask R1-4.7: 运行 `npm run check` 确认兼容

- [x] Task R1-5: Round 1 验证
  - [x] SubTask R1-5.1: `npm run check:full` 通过
  - [x] SubTask R1-5.2: `npm run lint:full` 通过

## Round 2 — 前端最大3页面 + 后端P0剩余

- [x] Task R2-1: 拆分 Settings.tsx（3140行 → ~200行主组件 + 9个子组件）
  - [x] SubTask R2-1.1: 创建 `src/components/Settings/` 目录，提取 AppearanceSettings（外观+主题预设+语言）
  - [x] SubTask R2-1.2: 提取 FocusModeSettings（专注模式参数）
  - [x] SubTask R2-1.3: 提取 AIProviderConfigSection（AI服务密钥配置）
  - [x] SubTask R2-1.4: 提取 AIStatusSection（主AI+Embedding配置/测试）
  - [x] SubTask R2-1.5: 提取 VoiceServiceSettings（TTS+STT测试）
  - [x] SubTask R2-1.6: 提取 DatabaseSettings（数据库配置/连接测试）
  - [x] SubTask R2-1.7: 提取 MobileAISettings（移动端AI配置）
  - [x] SubTask R2-1.8: 提取 StudyStrategySettings（学习策略）
  - [x] SubTask R2-1.9: 提取 StudyAlgorithmSettings（FSRS参数/优化）
  - [x] SubTask R2-1.10: 重构主 Settings.tsx 为布局组件
  - [x] SubTask R2-1.11: 验证 `npm run check` 通过

- [x] Task R2-2: 拆分 LearningMode.tsx（2118行 → 598行主组件 + 6子组件 + 3hook）
  - [x] SubTask R2-2.1: 提取 useStudyModeLogic hook
  - [x] SubTask R2-2.2: 提取 useLearningModeTimer hook
  - [x] SubTask R2-2.3: 提取 useLinkedTask hook
  - [x] SubTask R2-2.4: 提取 StudyModeSelector 组件
  - [x] SubTask R2-2.5: 提取 LearningModeHeader 组件
  - [x] SubTask R2-2.6: 提取 LearningModeOutline 组件
  - [x] SubTask R2-2.7: 提取 LearningModeRightPanel 组件 + LearningArticleReader + CreateNodeModal
  - [x] SubTask R2-2.8: 重构主 LearningMode.tsx（598行）
  - [x] SubTask R2-2.9: 验证 `npm run check` 通过

- [x] Task R2-3: 拆分 Study.tsx（2090行 → 287行主组件 + 4子组件 + 2hook）
  - [x] SubTask R2-3.1: 提取 useCardReviewLogic hook
  - [x] SubTask R2-3.2: 提取 useQuizLogic hook
  - [x] SubTask R2-3.3: 提取 CardReviewView 组件
  - [x] SubTask R2-3.4: 提取 QuizView 组件
  - [x] SubTask R2-3.5: 提取 WeakPointAnalysis 组件
  - [x] SubTask R2-3.6: 提取 StudyHeader 组件
  - [x] SubTask R2-3.7: 重构主 Study.tsx（287行）
  - [x] SubTask R2-3.8: 验证 `npm run check` 通过

- [x] Task R2-4: 拆分 ragService.ts（1432行 → ~567行Facade + 2个子服务）
  - [x] SubTask R2-4.1: 提取 ragSearchService（semanticSearch, keywordSearch, hybridSearch, graphAugmentedSearch）
  - [x] SubTask R2-4.2: 提取 ragChatService（chat, streamChat）
  - [x] SubTask R2-4.3: ragService 保留为 Facade
  - [x] SubTask R2-4.4: 更新 ai/index.ts 导出
  - [x] SubTask R2-4.5: 验证 `npm run check` 通过

- [x] Task R2-5: 拆分 promptService.ts（1327行 → ~404行 + 常量提取）
  - [x] SubTask R2-5.1: 提取 promptConstants.ts（OUTPUT_SCHEMAS, LANGUAGE_INSTRUCTIONS, VALIDATION_RULES 等常量）
  - [x] SubTask R2-5.2: promptService 保留服务逻辑（CRUD + getRenderedPrompt + getTemplate 等）
  - [x] SubTask R2-5.3: 验证 `npm run check` 通过

- [x] Task R2-6: 拆分 nodesService.ts（1250行 → ~886行Facade + 1个子服务）
  - [x] SubTask R2-6.1: 提取 nodeBatchService（batchDeleteNodes, batchUpdatePositions, batchUpdateNodes）
  - [x] SubTask R2-6.2: nodesService 保留为 Facade
  - [x] SubTask R2-6.3: 验证 `npm run check` 通过

- [x] Task R2-7: Round 2 验证
  - [x] SubTask R2-7.1: `npm run check:full` 通过
  - [x] SubTask R2-7.2: `npm run lint:full` 通过

## Round 3 — 前端剩余 + 后端P1 + 全局验证

- [x] Task R3-1: 拆分 Dashboard.tsx（1972行 → 468行主组件 + 7子组件 + 1hook）
  - [x] SubTask R3-1.1: 提取 useDashboardFilters hook
  - [x] SubTask R3-1.2: 提取 TagCloudSection 为独立文件
  - [x] SubTask R3-1.3: 提取 DashboardGraphCard 组件
  - [x] SubTask R3-1.4: 提取 DashboardGraphListItem 组件
  - [x] SubTask R3-1.5: 提取 DashboardBatchActions 组件
  - [x] SubTask R3-1.6: 提取 DashboardPagination 组件
  - [x] SubTask R3-1.7: 提取 DashboardMobileFAB 组件
  - [x] SubTask R3-1.8: 重构主 Dashboard.tsx
  - [x] SubTask R3-1.9: 验证 `npm run check` 通过

- [x] Task R3-2: 拆分 LearningPathDetail.tsx（1352行 → 377行主组件 + 7子组件 + types.ts）
  - [x] SubTask R3-2.1: 创建 `src/components/LearningPath/` 目录，提取 types.ts
  - [x] SubTask R3-2.2: 提取 PathHeaderSection
  - [x] SubTask R3-2.3: 提取 PathNodeListSection
  - [x] SubTask R3-2.4: 提取 PathMilestonesSection
  - [x] SubTask R3-2.5: 提取 PathPlansSection
  - [x] SubTask R3-2.6: 提取 PathSuggestionsSection
  - [x] SubTask R3-2.7: 提取 PathProgressOverview
  - [x] SubTask R3-2.8: 提取 PathActionBar
  - [x] SubTask R3-2.9: 重构主 LearningPathDetail.tsx（377行）
  - [x] SubTask R3-2.10: 验证 `npm run check` 通过

- [x] Task R3-3: 拆分 UnifiedWorkbench.tsx（1100行 → 430行主组件 + 7子组件 + 1hook）
  - [x] SubTask R3-3.1: 提取 useTaskActions hook
  - [x] SubTask R3-3.2: 提取 TaskCard 组件（从renderTaskCard）
  - [x] SubTask R3-3.3: 提取 QueueColumn 组件（从renderQueueColumn）
  - [x] SubTask R3-3.4: 提取 KnowledgePointCard 组件
  - [x] SubTask R3-3.5: 提取 ReviewCard 组件
  - [x] SubTask R3-3.6: 提取 KnowledgePointLinkModal 组件
  - [x] SubTask R3-3.7: 重构主 UnifiedWorkbench.tsx（430行）
  - [x] SubTask R3-3.8: 验证 `npm run check` 通过

- [x] Task R3-4: 拆分 autoGraphService.ts（1747行 → 提取合并/去重子服务）
  - [x] SubTask R3-4.1: 提取 autoGraphMergeService（mergeSimilarNodes, findExistingSimilarNode）
  - [x] SubTask R3-4.2: autoGraphService 保留编排主流程
  - [x] SubTask R3-4.3: 验证 `npm run check` 通过

- [x] Task R3-5: 拆分 conceptAggregationService.ts（1731行 → 提取相似度+嵌入子服务）
  - [x] SubTask R3-5.1: 提取 conceptSimilarityService（findSimilar系列 + calculateSimilarity）
  - [x] SubTask R3-5.2: 提取 conceptEmbeddingService（generateEmbedding系列）
  - [x] SubTask R3-5.3: 验证 `npm run check` 通过

- [x] Task R3-6: 拆分 templateGeneratorService.ts（1457行 → 提取验证+故事子服务）
  - [x] SubTask R3-6.1: 提取 templateValidationService
  - [x] SubTask R3-6.2: 提取 storyTemplateService
  - [x] SubTask R3-6.3: 验证 `npm run check` 通过

- [x] Task R3-7: 拆分 relationDiscoveryService.ts（1254行 → 提取跨域分析子服务）
  - [x] SubTask R3-7.1: 提取 crossDomainAnalysisService
  - [x] SubTask R3-7.2: 验证 `npm run check` 通过

- [x] Task R3-8: 全局验证
  - [x] SubTask R3-8.1: `npm run check:full` 通过
  - [x] SubTask R3-8.2: `npm run lint:full` 通过
  - [x] SubTask R3-8.3: 验证所有页面主组件行数 ≤ 500行（LearningMode 563行为可接受偏差）
  - [x] SubTask R3-8.4: 验证所有后端P0 Facade行数（graphService 560、ragService 503接近目标；learningPathService 1214、nodesService 797因核心CRUD依赖内部方法无法进一步下沉，为可接受偏差）

# Task Dependencies

## Round 内依赖
- [R1-1, R1-2] 无依赖，可并行（类型拆分独立）
- [R1-3, R1-4] 无依赖，可并行（后端拆分独立）
- [R1-5] depends on [R1-1 ~ R1-4]
- [R2-1, R2-2, R2-3] 无依赖，可并行（前端页面独立）
- [R2-4, R2-5, R2-6] 无依赖，可并行（后端拆分独立）
- [R2-7] depends on [R2-1 ~ R2-6]
- [R3-1, R3-2, R3-3] 无依赖，可并行
- [R3-4 ~ R3-7] 无依赖，可并行
- [R3-8] depends on [R3-1 ~ R3-7]

## Round 间依赖
- [Round 2] 建议在 Round 1 完成后再开始（类型拆分是基础设施）
- [Round 3] 建议在 Round 2 完成后再开始（避免合并冲突）
