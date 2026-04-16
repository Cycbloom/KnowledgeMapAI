import { request } from './client';
import type { ScheduledTask } from '@shared/types';

export interface TaskRecommendation {
  task: ScheduledTask;
  score: number;
  reasons: string[];
  urgencyLevel: 'low' | 'medium' | 'high' | 'critical';
  suggestedTimeSlot?: TimeSlot;
}

export interface TimeSlot {
  start: string;
  end: string;
  label: string;
  type: 'morning' | 'afternoon' | 'evening' | 'night';
}

export interface EfficiencyData {
  hourlyEfficiency: Record<number, number>;
  tagEfficiency: Record<string, { avgDuration: number; completionRate: number }>;
  queueEfficiency: Record<number, { avgDuration: number; completionRate: number }>;
  peakHours: number[];
  lowHours: number[];
}

export interface PrioritySuggestion {
  suggestedPriority: number;
  suggestedQueue: number;
  confidence: number;
  reasons: string[];
  keywords: string[];
}

export interface SmartSuggestions {
  topTasks: TaskRecommendation[];
  timeBasedSuggestions: string[];
  efficiencyTips: string[];
}

export interface DecisionFactor {
  name: string;
  weight: number;
  score: number;
  description: string;
}

export interface DecisionTaskRecommendation {
  taskId: string;
  title: string;
  queueLevel: number;
  priority: number;
  totalScore: number;
  factors: DecisionFactor[];
  reason: string;
}

export const taskRecommendationApi = {
  getRecommendations: () =>
    request<{ success: boolean; data: TaskRecommendation[] }>('/scheduler/recommendations'),

  getSmartSuggestions: () =>
    request<{ success: boolean; data: SmartSuggestions }>('/scheduler/smart-suggestions'),

  analyzePriority: (title: string, description?: string) =>
    request<{ success: boolean; data: PrioritySuggestion }>('/scheduler/analyze-priority', {
      method: 'POST',
      body: JSON.stringify({ title, description }),
    }),

  getEfficiencyData: (days: number = 30) =>
    request<{ success: boolean; data: EfficiencyData }>(`/scheduler/efficiency-data?days=${days}`),

  getDecisionRecommendations: (limit: number = 5) =>
    request<{ success: boolean; data: DecisionTaskRecommendation[] }>(`/scheduler/decision-engine/recommendations?limit=${limit}`),
};
