export { initCsrf, request, getAIConfig, getCookie, getHeaders, handleResponse } from './client';
export type { AIAction, AIActionVariables } from './types';

export { authApi } from './auth';
export { graphsApi } from './graphs';
export { nodesApi, edgesApi } from './nodes';
export { aiApi, aiActionsApi } from './ai';
export { ttsApi } from './tts';
export { studyApi, dashboardApi, statisticsApi } from './study';
export { tasksApi, searchApi, dataApi } from './tasks';
export { templatesApi, promptsApi, focusApi, achievementsApi } from './templates';
export { learningPathsApi, learningPathApi } from './learningPaths';
export { ragApi } from './rag';
export { autoGraphApi } from './autoGraph';
export { healthApi } from './health';
export { backupApi } from './backup';

import { authApi } from './auth';
import { graphsApi } from './graphs';
import { nodesApi, edgesApi } from './nodes';
import { aiApi, aiActionsApi } from './ai';
import { ttsApi } from './tts';
import { studyApi, dashboardApi, statisticsApi } from './study';
import { tasksApi, searchApi, dataApi } from './tasks';
import { templatesApi, promptsApi, focusApi, achievementsApi } from './templates';
import { learningPathsApi, learningPathApi } from './learningPaths';
import { ragApi } from './rag';
import { autoGraphApi } from './autoGraph';
import { healthApi } from './health';
import { backupApi } from './backup';

export const api = {
  aiActions: aiActionsApi,
  auth: authApi,
  graphs: graphsApi,
  nodes: nodesApi,
  edges: edgesApi,
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
  learningPaths: learningPathsApi,
  rag: ragApi,
  autoGraph: autoGraphApi,
  learningPath: learningPathApi,
  health: healthApi,
  backup: backupApi,
};
