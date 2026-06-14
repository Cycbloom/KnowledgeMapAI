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
import { NotSupportedError } from "../api/contracts/types";

/**
 * Creates a stub module that throws NotSupportedError for any property access.
 * Used for API modules that are not yet implemented on mobile.
 */
function createNotSupportedModule(moduleName: string): Record<string, unknown> {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        throw new NotSupportedError(`${moduleName}.${String(prop)}`);
      },
    },
  );
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
  knowledgePoints: createNotSupportedModule("knowledgePoints"),
  graphNodes: createNotSupportedModule("graphNodes"),
  combinedView: createNotSupportedModule("combinedView"),
  ai: mobileAiApi,
  aiActions: mobileAiApi.aiActions,
  tts: createNotSupportedModule("tts"),
  study: mobileStudyApi,
  dashboard: mobileDashboardApi,
  statistics: mobileStatisticsApi,
  tasks: createNotSupportedModule("tasks"),
  search: createNotSupportedModule("search"),
  data: createNotSupportedModule("data"),
  templates: createNotSupportedModule("templates"),
  prompts: createNotSupportedModule("prompts"),
  focus: createNotSupportedModule("focus"),
  achievements: mobileAchievementsApi,
  periodicTasks: mobilePeriodicTasksApi,
  learningPaths: createNotSupportedModule("learningPaths"),
  learningPath: createNotSupportedModule("learningPath"),
  rag: createNotSupportedModule("rag"),
  autoGraph: createNotSupportedModule("autoGraph"),
  health: createNotSupportedModule("health"),
  backup: createNotSupportedModule("backup"),
  quiz: mobileQuizApi,
  agent: createNotSupportedModule("agent"),
  scheduler: mobileSchedulerApi,
  performance: createNotSupportedModule("performance"),
  domains: createNotSupportedModule("domains"),
  graphDomains: createNotSupportedModule("graphDomains"),
  plugins: createNotSupportedModule("plugins"),
  literature: createNotSupportedModule("literature"),
  regions: createNotSupportedModule("regions"),
  storyCreation: createNotSupportedModule("storyCreation"),
  conceptAggregation: createNotSupportedModule("conceptAggregation"),
  graphVersions: createNotSupportedModule("graphVersions"),
};
