import { mobileGraphsApi } from "./graphs";
import { mobileNodesApi } from "./nodes";
import { mobileEdgesApi } from "./edges";
import { mobileAiApi } from "./ai";
import {
  mobileStudyApi,
  mobileDashboardApi,
  mobileStatisticsApi,
} from "./study";
import { mobileAuthApi } from "./auth";
import { mobileQuizApi } from "./quiz";
import { mobileSchedulerApi } from "./scheduler";
import { mobileAchievementsApi } from "./achievements";
import { mobilePeriodicTasksApi } from "./periodicTasks";
import type { IApi } from "../api/contracts/IApi";
import type { ITtsApi } from "../api/contracts/ITtsApi";
import type { ITasksApi, ISearchApi, IDataApi } from "../api/contracts/ITasksApi";
import type { ITemplatesApi, IPromptsApi, IFocusApi } from "../api/contracts/ITemplatesApi";
import type { ILearningPathsApi, ILearningPathApi } from "../api/contracts/ILearningPathsApi";
import type { IRagApi } from "../api/contracts/IRagApi";
import type { IAutoGraphApi } from "../api/contracts/IAutoGraphApi";
import type { IHealthApi } from "../api/contracts/IHealthApi";
import type { IBackupApi } from "../api/contracts/IBackupApi";
import type { IPerformanceApi } from "../api/contracts/IPerformanceApi";
import type { IAgentApi } from "../api/contracts/IAgentApi";
import type { IDomainsApi, IGraphDomainsApi } from "../api/contracts/IDomainsApi";
import type { IPluginsApi } from "../api/contracts/IPluginsApi";
import type { ILiteratureApi } from "../api/contracts/ILiteratureApi";
import type { IRegionsApi } from "../api/contracts/IRegionsApi";
import type { IStoryCreationApi } from "../api/contracts/IStoryCreationApi";
import type { IConceptAggregationApi } from "../api/contracts/IConceptAggregationApi";
import type { IGraphVersionsApi } from "../api/contracts/IGraphVersionsApi";
import type { IKnowledgePointsApi, IGraphNodesApi, ICombinedViewApi } from "../api/contracts/IKnowledgePointsApi";
import { NotSupportedError } from "../api/contracts/types";

/**
 * Creates a type-safe stub module that throws NotSupportedError for any property access.
 * Used for API modules that are not yet implemented on mobile.
 */
function createNotSupportedModule<T>(moduleName: string): T {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        throw new NotSupportedError(`${moduleName}.${String(prop)}`);
      },
    },
  ) as T;
}

export { getMobileSupabaseClient, resetMobileSupabaseClient, getSupabaseClient, resetSupabaseClient } from "@/lib/supabase";
export { mobileAuthApi } from "./auth";
export { mobileGraphsApi } from "./graphs";
export { mobileNodesApi } from "./nodes";
export { mobileEdgesApi } from "./edges";
export { mobileAiApi } from "./ai";
export {
  mobileStudyApi,
  mobileDashboardApi,
  mobileStatisticsApi,
} from "./study";
export { mobileQuizApi } from "./quiz";
export { mobileSchedulerApi } from "./scheduler";
export { mobileAchievementsApi } from "./achievements";
export { mobilePeriodicTasksApi } from "./periodicTasks";

export type {
  AuthResponse,
  RegisterData,
  LoginData,
  UpdateProfileData,
} from "@shared/types/api";

export const mobileApi: IApi = {
  auth: mobileAuthApi,
  graphs: mobileGraphsApi,
  nodes: mobileNodesApi,
  edges: mobileEdgesApi,
  knowledgePoints: createNotSupportedModule<IKnowledgePointsApi>("knowledgePoints"),
  graphNodes: createNotSupportedModule<IGraphNodesApi>("graphNodes"),
  combinedView: createNotSupportedModule<ICombinedViewApi>("combinedView"),
  ai: mobileAiApi,
  aiActions: mobileAiApi.aiActions,
  tts: createNotSupportedModule<ITtsApi>("tts"),
  study: mobileStudyApi,
  dashboard: mobileDashboardApi,
  statistics: mobileStatisticsApi,
  tasks: createNotSupportedModule<ITasksApi>("tasks"),
  search: createNotSupportedModule<ISearchApi>("search"),
  data: createNotSupportedModule<IDataApi>("data"),
  templates: createNotSupportedModule<ITemplatesApi>("templates"),
  prompts: createNotSupportedModule<IPromptsApi>("prompts"),
  focus: createNotSupportedModule<IFocusApi>("focus"),
  achievements: mobileAchievementsApi,
  periodicTasks: mobilePeriodicTasksApi,
  learningPaths: createNotSupportedModule<ILearningPathsApi>("learningPaths"),
  learningPath: createNotSupportedModule<ILearningPathApi>("learningPath"),
  rag: createNotSupportedModule<IRagApi>("rag"),
  autoGraph: createNotSupportedModule<IAutoGraphApi>("autoGraph"),
  health: createNotSupportedModule<IHealthApi>("health"),
  backup: createNotSupportedModule<IBackupApi>("backup"),
  quiz: mobileQuizApi,
  agent: createNotSupportedModule<IAgentApi>("agent"),
  scheduler: mobileSchedulerApi,
  performance: createNotSupportedModule<IPerformanceApi>("performance"),
  domains: createNotSupportedModule<IDomainsApi>("domains"),
  graphDomains: createNotSupportedModule<IGraphDomainsApi>("graphDomains"),
  plugins: createNotSupportedModule<IPluginsApi>("plugins"),
  literature: createNotSupportedModule<ILiteratureApi>("literature"),
  regions: createNotSupportedModule<IRegionsApi>("regions"),
  storyCreation: createNotSupportedModule<IStoryCreationApi>("storyCreation"),
  conceptAggregation: createNotSupportedModule<IConceptAggregationApi>("conceptAggregation"),
  graphVersions: createNotSupportedModule<IGraphVersionsApi>("graphVersions"),
};
