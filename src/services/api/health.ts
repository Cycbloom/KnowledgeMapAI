import { request } from './client';

export const healthApi = {
  getOverview: () => request<unknown>('/health/overview'),

  getHeatmap: () => request<unknown>('/health/heatmap'),

  getWeakPoints: () => request<unknown>('/health/weak-points'),

  getWeeklyActivity: (days?: number) =>
    request<unknown>(
      `/health/weekly-activity${days ? `?days=${days}` : ''}`,
    ),

  getPredictions: () => request<unknown>('/health/predictions'),
};
