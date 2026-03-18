import { mobileGraphsApi } from './graphs';
import { mobileNodesApi } from './nodes';
import { mobileEdgesApi } from './edges';
import { mobileAiApi } from './ai';
import { mobileStudyApi, mobileDashboardApi, mobileStatisticsApi } from './study';

export { getMobileSupabaseClient, resetMobileSupabaseClient } from './client';
export { mobileAuthApi } from './auth';
export { mobileGraphsApi } from './graphs';
export { mobileNodesApi } from './nodes';
export { mobileEdgesApi } from './edges';
export { mobileRealtimeApi } from './realtime';
export { mobileAiApi } from './ai';
export { mobileStudyApi, mobileDashboardApi, mobileStatisticsApi } from './study';

export type { AuthResponse, RegisterData, LoginData, UpdateProfileData } from './auth';

export const mobileApi = {
  graphs: mobileGraphsApi,
  nodes: mobileNodesApi,
  edges: mobileEdgesApi,
  ai: mobileAiApi,
  study: mobileStudyApi,
  dashboard: mobileDashboardApi,
  statistics: mobileStatisticsApi,
};
