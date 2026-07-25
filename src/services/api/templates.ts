import { request } from './client';
import type {
  Template,
  TemplateCategory,
  TemplateNode,
  TemplateEdge,
  TemplateLayout,
  TemplateDifficulty,
  LayoutSuggestion,
} from '@shared/types/graph';
import type { IAchievementsApi, IPeriodicTasksApi } from './contracts';

export interface SaveTemplateData {
  name: string;
  description?: string;
  category?: TemplateCategory;
  nodes: TemplateNode[];
  edges?: TemplateEdge[];
  layout?: TemplateLayout;
  tags?: string[];
  difficulty?: TemplateDifficulty;
  estimated_nodes?: number;
  layout_suggestion?: LayoutSuggestion;
}

export interface UpdateTemplateData {
  name?: string;
  description?: string;
  category?: TemplateCategory;
  nodes?: TemplateNode[];
  edges?: TemplateEdge[];
  layout?: TemplateLayout;
  tags?: string[];
  difficulty?: TemplateDifficulty;
  estimated_nodes?: number;
  layout_suggestion?: LayoutSuggestion;
}

export const templatesApi = {
  list: (category?: TemplateCategory): Promise<Template[]> =>
    request<Template[]>(`/templates${category ? `?category=${category}` : ''}`),

  get: (id: string): Promise<Template> => request<Template>(`/templates/${id}`),

  create: (data: SaveTemplateData): Promise<Template> =>
    request<Template>('/templates', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: UpdateTemplateData): Promise<Template> =>
    request<Template>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string): Promise<{ message: string }> =>
    request<{ message: string }>(`/templates/${id}`, { method: 'DELETE' }),

  saveTemplate: (data: SaveTemplateData): Promise<Template> =>
    request<Template>('/templates', { method: 'POST', body: JSON.stringify(data) }),

  updateTemplate: (id: string, data: UpdateTemplateData): Promise<Template> =>
    request<Template>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const promptsApi = {
  list: (graphId?: string) => request(`/prompts${graphId ? `?graph_id=${graphId}` : ''}`),
  
  save: (data: { code: string; scope: 'user'|'graph'; template_content: string; graph_id?: string }) => 
    request('/prompts', { method: 'POST', body: JSON.stringify(data) }),
  
  reset: (id: string) => request(`/prompts/${id}`, { method: 'DELETE' }),
  
  optimize: (data: { template_content: string; instruction?: string }) => 
    request('/prompts/optimize', { method: 'POST', body: JSON.stringify(data) }),
};

export const focusApi = {
  saveSession: (data: { duration: number; mode: string; start_time: string; end_time: string; task_id?: string }) => 
    request('/scheduler/focus-sessions', { method: 'POST', body: JSON.stringify(data) }),
  
  getStats: () => request('/scheduler/focus-sessions/stats'),
};

export const achievementsApi: IAchievementsApi = {
  list: () => request('/achievements'),
  
  check: (type: string, value: number) => 
    request('/achievements/check', { method: 'POST', body: JSON.stringify({ type, value }) }),
  
  getDailyTasks: () => request('/achievements/daily-tasks'),
  
  checkIn: () => request('/achievements/daily-tasks/check-in', { method: 'POST' }),
};

export const periodicTasksApi: IPeriodicTasksApi = {
  list: () => request('/periodic-tasks'),
  
  check: (taskType: string, value: number) => 
    request('/periodic-tasks/check', { method: 'POST', body: JSON.stringify({ taskType, value }) }),
  
  getPass: () => request('/periodic-tasks/pass'),
  
  claimReward: (passId: string, level: number) => 
    request('/periodic-tasks/pass/claim', { method: 'POST', body: JSON.stringify({ passId, level }) }),
  
  checkStreak: () => request('/periodic-tasks/streak/check', { method: 'POST' }),
};
