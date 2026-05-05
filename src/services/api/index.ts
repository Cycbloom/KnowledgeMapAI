export {
  initCsrf,
  request,
  getAIConfig,
  getCookie,
  getHeaders,
  handleResponse,
} from "./client";
export type { AIAction, AIActionVariables } from "@shared/types";

export { authApi } from "./auth";
export { graphsApi } from "./graphs";
export { nodesApi, edgesApi } from "./nodes";
export {
  knowledgePointsApi,
  graphNodesApi,
  combinedViewApi,
  publicKnowledgePointsApi,
} from "./knowledgePoints";
export { aiApi, aiActionsApi } from "./ai";
export { ttsApi } from "./tts";
export { studyApi, dashboardApi, statisticsApi } from "./study";
export { tasksApi, searchApi, dataApi } from "./tasks";
export {
  templatesApi,
  promptsApi,
  focusApi,
  achievementsApi,
  periodicTasksApi,
} from "./templates";
export { learningPathsApi, learningPathApi } from "./learningPaths";
export type { LearningPathStatus, NodeStatus, GoalType } from "./learningPaths";
export { ragApi } from "./rag";
export { autoGraphApi } from "./autoGraph";
export type {
  GenerateTemplatesData,
  GenerateTemplatesResult,
  GeneratedTemplate,
  ApplyTemplateData,
  ApplyTemplateResult,
} from "./autoGraph";
export { healthApi } from "./health";
export { backupApi } from "./backup";
export { quizApi } from "./quiz";
export { agentApi } from "./agent";
export { schedulerApi } from "./modules/scheduler";
export { performanceApi } from "./performance";
export { domainsApi, graphDomainsApi } from "./domains";
export { pluginsApi } from "./plugins";
export type { RegistryPlugin, InstalledPlugin, PluginUpdate } from "./plugins";
export { literatureApi } from "./literature";

import { authApi } from "./auth";
import { graphsApi } from "./graphs";
import { nodesApi, edgesApi } from "./nodes";
import {
  knowledgePointsApi,
  graphNodesApi,
  combinedViewApi,
} from "./knowledgePoints";
import { aiApi, aiActionsApi } from "./ai";
import { ttsApi } from "./tts";
import { studyApi, dashboardApi, statisticsApi } from "./study";
import { tasksApi, searchApi, dataApi } from "./tasks";
import {
  templatesApi,
  promptsApi,
  focusApi,
  achievementsApi,
  periodicTasksApi,
} from "./templates";
import { learningPathsApi, learningPathApi } from "./learningPaths";
import { ragApi } from "./rag";
import { autoGraphApi } from "./autoGraph";
import { healthApi } from "./health";
import { backupApi } from "./backup";
import { quizApi } from "./quiz";
import { agentApi } from "./agent";
import { schedulerApi } from "./modules/scheduler";
import { performanceApi } from "./performance";
import { domainsApi, graphDomainsApi } from "./domains";
import { pluginsApi } from "./plugins";
import { literatureApi } from "./literature";

export const api = {
  auth: authApi,
  graphs: graphsApi,
  nodes: nodesApi,
  edges: edgesApi,
  knowledgePoints: knowledgePointsApi,
  graphNodes: graphNodesApi,
  combinedView: combinedViewApi,
  ai: aiApi,
  aiActions: aiActionsApi,
  tts: ttsApi,
  study: studyApi,
  dashboard: dashboardApi,
  statistics: statisticsApi,
  tasks: tasksApi,
  search: searchApi,
  data: dataApi,
  templates: templatesApi,
  prompts: promptsApi,
  focus: focusApi,
  achievements: achievementsApi,
  periodicTasks: periodicTasksApi,
  learningPaths: learningPathsApi,
  learningPath: learningPathApi,
  rag: ragApi,
  autoGraph: autoGraphApi,
  health: healthApi,
  backup: backupApi,
  quiz: quizApi,
  agent: agentApi,
  scheduler: schedulerApi,
  performance: performanceApi,
  domains: domainsApi,
  graphDomains: graphDomainsApi,
  plugins: pluginsApi,
  literature: literatureApi,
};

export type {
  UserTask,
  CreateUserTaskData,
  UpdateUserTaskData,
  TaskExecution,
  TaskSettings,
  UpdateTaskSettingsData,
  UserTaskStats,
  HeatmapData,
  UserTaskFilters,
  ExecutionFilters,
  QueueData,
  Queue,
  CreateQueueData,
  UpdateQueueData,
  ReviewTask,
  CreateReviewTaskData,
  UpdateReviewTaskData,
  ReviewTaskStats,
  PendingReviewTask,
  SyncStudyDurationData,
  SyncTaskCompletionData,
  TaskProgressSummary,
  RecordActivityData,
  GetActivitiesOptions,
  AutoGenerateTaskData,
} from "./modules/scheduler";
