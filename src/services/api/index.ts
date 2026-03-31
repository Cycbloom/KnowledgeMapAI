export { initCsrf, request, getAIConfig, getCookie, getHeaders, handleResponse } from './client';
export type { AIAction, AIActionVariables } from '@shared/types';

export { authApi } from './auth';
export { graphsApi } from './graphs';
export { nodesApi, edgesApi } from './nodes';
export { knowledgePointsApi, graphNodesApi, combinedViewApi, publicKnowledgePointsApi } from './knowledgePoints';
export { aiApi, aiActionsApi } from './ai';
export { ttsApi } from './tts';
export { studyApi, dashboardApi, statisticsApi } from './study';
export { tasksApi, searchApi, dataApi } from './tasks';
export { templatesApi, promptsApi, focusApi, achievementsApi, periodicTasksApi } from './templates';
export { learningPathsApi, learningPathApi } from './learningPaths';
export type { LearningPathStatus, NodeStatus, GoalType } from './learningPaths';
export { ragApi } from './rag';
export { autoGraphApi } from './autoGraph';
export { healthApi } from './health';
export { backupApi } from './backup';
export { schedulerApi } from './modules/scheduler';
export { quizApi } from './quiz';
export { agentApi } from './agent';
export type {
  ScheduledTask,
  CreateScheduledTaskData,
  UpdateScheduledTaskData,
  TaskExecution,
  TaskSettings,
  UpdateTaskSettingsData,
  TaskStats,
  HeatmapData,
  TaskFilters,
  ExecutionFilters,
  QueueData,
  Queue,
  CreateQueueData,
  UpdateQueueData,
} from './modules/scheduler';

import { authApi } from './auth';
import { graphsApi } from './graphs';
import { nodesApi, edgesApi } from './nodes';
import { knowledgePointsApi, graphNodesApi, combinedViewApi } from './knowledgePoints';
import { aiApi, aiActionsApi } from './ai';
import { ttsApi } from './tts';
import { studyApi, dashboardApi, statisticsApi } from './study';
import { tasksApi, searchApi, dataApi } from './tasks';
import { templatesApi, promptsApi, focusApi, achievementsApi, periodicTasksApi } from './templates';
import { learningPathsApi, learningPathApi } from './learningPaths';
import { ragApi } from './rag';
import { autoGraphApi } from './autoGraph';
import { healthApi } from './health';
import { backupApi } from './backup';
import { schedulerApi } from './modules/scheduler';
import { quizApi } from './quiz';
import { agentApi } from './agent';

export const api = {
  aiActions: aiActionsApi,
  auth: authApi,
  graphs: graphsApi,
  nodes: nodesApi,
  edges: edgesApi,
  knowledgePoints: knowledgePointsApi,
  graphNodes: graphNodesApi,
  combinedView: combinedViewApi,
  ai: aiApi,
  tts: ttsApi,
  study: studyApi,
  dashboard: dashboardApi,
  statistics: statisticsApi,
  search: searchApi,
  tasks: tasksApi,
  data: dataApi,
  templates: templatesApi,
  prompts: promptsApi,
  focus: focusApi,
  achievements: achievementsApi,
  periodicTasks: periodicTasksApi,
  learningPaths: learningPathsApi,
  rag: ragApi,
  autoGraph: autoGraphApi,
  learningPath: learningPathApi,
  health: healthApi,
  backup: backupApi,
  scheduler: schedulerApi,
  quiz: quizApi,
  agent: agentApi,
};
