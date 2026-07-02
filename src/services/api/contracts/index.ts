export type { IGraphsApi } from './IGraphsApi';
export type { INodesApi } from './INodesApi';
export type { IEdgesApi } from './IEdgesApi';
export type { IBacklinksApi } from './IBacklinksApi';
export type { IAuthApi } from './IAuthApi';
export type { IAiApi, IAiActionsApi } from './IAiApi';
export type { IStudyApi } from './IStudyApi';
export type { IDashboardApi } from './IDashboardApi';
export type { IStatisticsApi } from './IStatisticsApi';
export type { IQuizApi } from './IQuizApi';
export type { IAchievementsApi, Achievement, DailyTask } from './IAchievementsApi';
export type { IPeriodicTasksApi } from './IPeriodicTasksApi';
export type { IKnowledgePointsApi, IGraphNodesApi, ICombinedViewApi } from './IKnowledgePointsApi';
export type { ISchedulerApi } from './ISchedulerApi';
export type { ITtsApi } from './ITtsApi';
export type { ITasksApi, ISearchApi, IDataApi } from './ITasksApi';
export type { IRagApi } from './IRagApi';
export type { IAutoGraphApi } from './IAutoGraphApi';
export type { ILearningPathsApi, ILearningPathApi } from './ILearningPathsApi';
export type { ITemplatesApi, IPromptsApi, IFocusApi, SaveTemplateData } from './ITemplatesApi';
export type { IHealthApi } from './IHealthApi';
export type { IBackupApi, BackupSnapshot } from './IBackupApi';
export type { IPerformanceApi } from './IPerformanceApi';
export type { IApi } from './IApi';
export type {
  TopicCheckResult,
  DomainRecommendation,
  DomainGraphRelation,
  DomainAnalysisResult,
  DomainExpansionResult,
  BatchCreateDomainGraphsResult,
  InitializeGraphResult,
  BatchInitializeResult,
} from './graphTypes';
export type { IAgentApi, AgentSession, AgentMessage, ToolCall, SkillDefinition, GraphRecommendation, RelationType, ToolDefinition, AnalysisGoal, ExecuteResult, StructuredAnalysisResult, MergeSuggestion } from './IAgentApi';
export type { IDomainsApi, IGraphDomainsApi, DomainTreeNode } from './IDomainsApi';
export type { IPluginsApi, RegistryPlugin, InstalledPlugin, PluginUpdate } from './IPluginsApi';
export type { ILiteratureApi, LiteratureMetadata, LiteratureInfo, LiteratureExtractRequest, LiteratureExtractResponse, LiteratureApplyRequest, LiteratureApplyResponse, ExtractedConcept, ExtractedRelation, ConceptType } from './ILiteratureApi';
export type { IRegionsApi, CustomRegion, CreateRegionData, UpdateRegionData, GraphViewMode } from './IRegionsApi';
export type { IStoryCreationApi, IStoryStructuresApi, IStoryCharactersApi, IStoryScenesApi, IStoryAppearancesApi, IStoryRelationshipsApi, StoryStructure, StoryCharacter, StorySceneDetail, StoryAppearance, StoryCharacterRelationship, InitializeTemplateResponse } from './IStoryCreationApi';
export type { IConceptAggregationApi, AnalyzeOptions, AnalysisResult, MergeGroup, MergeResult, HierarchyRelationInput, ApplyHierarchyResult, UpdateAliasesResult, ConceptGroup, HierarchyRelation } from './IConceptAggregationApi';
export type { IGraphVersionsApi, PaginatedResult, GraphSnapshot, DiffResult, GraphEvent, SnapshotData, SnapshotNodeData, SnapshotEdgeData, NodeDiff, EdgeDiff, DiffChangeType, GraphSnapshotType, VersionGraphEventType } from './IGraphVersionsApi';
export { NotSupportedError } from './types';