import type { IAuthApi } from './IAuthApi';
import type { IGraphsApi } from './IGraphsApi';
import type { INodesApi } from './INodesApi';
import type { IEdgesApi } from './IEdgesApi';
import type { IAiApi, IAiActionsApi } from './IAiApi';
import type { IStudyApi } from './IStudyApi';
import type { IDashboardApi } from './IDashboardApi';
import type { IStatisticsApi } from './IStatisticsApi';
import type { IQuizApi } from './IQuizApi';
import type { IAchievementsApi } from './IAchievementsApi';
import type { IPeriodicTasksApi } from './IPeriodicTasksApi';
import type { ISchedulerApi } from './ISchedulerApi';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GenericApiModule = Record<string, any>;

export interface IApi {
  auth: IAuthApi;
  graphs: IGraphsApi;
  nodes: INodesApi;
  edges: IEdgesApi;
  knowledgePoints: GenericApiModule;
  graphNodes: GenericApiModule;
  combinedView: GenericApiModule;
  ai: IAiApi;
  aiActions: IAiActionsApi;
  tts: GenericApiModule;
  study: IStudyApi;
  dashboard: IDashboardApi;
  statistics: IStatisticsApi;
  tasks: GenericApiModule;
  search: GenericApiModule;
  data: GenericApiModule;
  templates: GenericApiModule;
  prompts: GenericApiModule;
  focus: GenericApiModule;
  achievements: IAchievementsApi;
  periodicTasks: IPeriodicTasksApi;
  learningPaths: GenericApiModule;
  learningPath: GenericApiModule;
  rag: GenericApiModule;
  autoGraph: GenericApiModule;
  health: GenericApiModule;
  backup: GenericApiModule;
  quiz: IQuizApi;
  agent: GenericApiModule;
  scheduler: ISchedulerApi;
  performance: GenericApiModule;
  domains: GenericApiModule;
  graphDomains: GenericApiModule;
  plugins: GenericApiModule;
  literature: GenericApiModule;
  regions: GenericApiModule;
  storyCreation: GenericApiModule;
  conceptAggregation: GenericApiModule;
  graphVersions: GenericApiModule;
}