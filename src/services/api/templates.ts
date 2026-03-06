import { request } from './client';

export const templatesApi = {
  list: (category?: string) => request(`/templates${category ? `?category=${category}` : ''}`),
  
  get: (id: string) => request(`/templates/${id}`),
  
  create: (data: unknown) => request('/templates', { method: 'POST', body: JSON.stringify(data) }),
  
  update: (id: string, data: unknown) => request(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  
  delete: (id: string) => request(`/templates/${id}`, { method: 'DELETE' }),
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
    request('/focus/sessions', { method: 'POST', body: JSON.stringify(data) }),
  
  getStats: () => request('/focus/stats'),
};

export const achievementsApi = {
  list: () => request('/achievements'),
  
  check: (type: string, value: number) => 
    request('/achievements/check', { method: 'POST', body: JSON.stringify({ type, value }) }),
  
  getDailyTasks: () => request('/achievements/daily-tasks'),
  
  checkIn: () => request('/achievements/daily-tasks/check-in', { method: 'POST' }),
};

export const periodicTasksApi = {
  list: () => request('/periodic-tasks'),
  
  check: (taskType: string, value: number) => 
    request('/periodic-tasks/check', { method: 'POST', body: JSON.stringify({ taskType, value }) }),
  
  getPass: () => request('/periodic-tasks/pass'),
  
  claimReward: (passId: string, level: number) => 
    request('/periodic-tasks/pass/claim', { method: 'POST', body: JSON.stringify({ passId, level }) }),
  
  checkStreak: () => request('/periodic-tasks/streak/check', { method: 'POST' }),
};
