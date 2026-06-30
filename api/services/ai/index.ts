// 组合根：在 barrel 加载时绑定 chatService 到 aiService，
// 拆解 aiService ↔ chatService 运行时循环依赖。
// chatService 与 aiService 均单向依赖 contextBuilder，无运行时环。
import { chatService } from "./chatService";
import { bindChatService } from "./aiService";
import { graphService } from "../graph";

bindChatService(chatService);
chatService.setGraphQueryService(graphService);

export {
  aiService,
  AIService,
  bindChatService,
  type GenerateCardsOptions,
  type CardDifficulty,
} from "./aiService";
export {
  aiActionService,
  AIActionService,
  type AIAction,
  type AIActionVariables,
  type AIActionExecutionResult,
} from "./aiActionService";
export {
  promptService,
  PromptService,
  type PromptScope,
  type PromptTemplate,
  type PromptListOptions,
  type PromptCreateData,
  type PromptUpdateData,
} from "./promptService";
export { embeddingService, EmbeddingService } from "./embeddingService";
export {
  ragService,
  RAGService,
  type RAGContext,
  type RAGSearchResult,
  type RAGResponse,
  type GraphRAGSearchResult,
  type TraversalResult,
  type TraversalFunction,
} from "./ragService";
export { ragSearchService, RAGSearchService } from "./ragSearchService";
export { ragChatService, RAGChatService } from "./ragChatService";
export {
  searchService,
  SearchService,
  type SearchResult,
  type SearchGraphResult,
  type SearchNodeResult,
  type SemanticSearchResult,
} from "./searchService";
export { getMockResponse } from "./mock";
export {
  domainContextService,
  DomainContextService,
} from "./domainContextService";
export {
  templateGeneratorService,
  TemplateGeneratorService,
  type GeneratedTemplateNode,
  type GeneratedTemplateEdge,
  type GeneratedTemplateScheme,
  type GenerateTemplatesOptions,
  type GenerateTemplatesResult,
} from "./templateGeneratorService";
export {
  validateNode,
  validateEdge,
  validateTemplate,
  TEMPLATE_VALIDATION_RULES,
} from "./templateValidationService";
export { storyTemplateService, StoryTemplateService } from "./storyTemplateService";
export {
  conceptExtractorService,
  ConceptExtractorService,
  type ExtractConceptsOptions,
  type ExtractConceptsResult,
  type ParsedContent,
} from "./conceptExtractorService";
export {
  backboneNetworkService,
  BackboneNetworkService,
  type BackboneNode,
  type BackboneEdge,
  type BackboneModuleConfig,
  type BackboneNetwork,
  type GenerateBackboneOptions,
  type GenerateBackboneResult,
} from "./backboneNetworkService";
export {
  rerankingService,
  RerankingService,
} from "./rerankingService";
export {
  contextWindowManager,
  ContextWindowManager,
} from "./contextWindowManager";
export { aiConfigRouteService } from "./aiConfigRouteService";
export { performanceMonitor } from "./performanceMonitor";
export type { EnrichedMetadata } from "./performanceMonitor";
export { enrichMetadata } from "./performanceMonitor";
export { pricingService } from "./pricingService";
export { getAIProvider, getAIProviderForTask, clearProviderCache } from "./factory";
export { getEnvConfig, getProviderConfig, getDefaultProvider, getProviderForTask } from "./config";
export { literatureMetadataService, LiteratureMetadataService } from "./literatureMetadataService";
export type { LiteratureMetadata, LiteratureType, ExtractMetadataOptions } from "./literatureMetadataService";
export { annotationService, AnnotationService } from "./annotationService";
export type { Term } from "./annotationService";
export { documentParsingService, DocumentParsingService } from "./documentParsingService";
export type { IGraphQueryService } from "./types";
