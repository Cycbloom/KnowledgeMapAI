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

export { getMobileSupabaseClient, resetMobileSupabaseClient } from "./client";
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
} from "./auth";

export const mobileApi = {
  auth: mobileAuthApi,
  graphs: mobileGraphsApi,
  nodes: mobileNodesApi,
  edges: mobileEdgesApi,
  ai: mobileAiApi,
  study: mobileStudyApi,
  dashboard: mobileDashboardApi,
  statistics: mobileStatisticsApi,
  quiz: mobileQuizApi,
  scheduler: mobileSchedulerApi,
  achievements: mobileAchievementsApi,
  periodicTasks: mobilePeriodicTasksApi,
};
