import { request } from './client';

export const healthApi = {
  getOverview: () => request('/health/overview'),
  
  getHeatmap: () => request('/health/heatmap'),
  
  getWeakPoints: () => request('/health/weak-points'),
  
  getWeeklyActivity: (days?: number) => request(`/health/weekly-activity${days ? `?days=${days}` : ''}`),
  
  getPredictions: () => request('/health/predictions'),
};
