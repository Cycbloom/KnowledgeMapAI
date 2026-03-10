import { request } from './client';

export type LearningPathStatus = 'active' | 'completed' | 'paused' | 'archived';
export type NodeStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type GoalType = 'natural_language' | 'graph_node' | 'template';

export interface CreateLearningPathInput {
  title: string;
  description?: string;
  goal?: string;
  target_date?: string;
  source_graph_id?: string;
  total_estimated_time?: number;
  ai_generated?: boolean;
  daily_minutes_target?: number;
  nodes?: Array<{
    knowledge_point_id?: string;
    order_index: number;
    title: string;
    description?: string;
    estimated_time?: number;
    is_milestone?: boolean;
    prerequisites?: string[];
  }>;
}

export interface UpdateLearningPathInput {
  title?: string;
  description?: string;
  status?: LearningPathStatus;
  daily_minutes_target?: number;
  target_completion_date?: string;
}

export interface AddNodeInput {
  node_id: string;
  estimated_minutes?: number;
  difficulty_level?: number;
}

export interface UpdateProgressInput {
  completed_nodes?: number;
  total_time_spent?: number;
  last_activity_at?: string;
}

export interface CreatePlanInput {
  date: string;
  planned_nodes: string[];
  estimated_minutes?: number;
  notes?: string;
}

export interface UpdatePlanInput {
  actual_nodes?: string[];
  actual_minutes?: number;
  completed?: boolean;
  notes?: string;
}

export interface GeneratePathInput {
  goal: string;
  context?: string;
  goal_type?: GoalType;
  target_knowledge_point_id?: string;
  template_id?: string;
  daily_minutes_target?: number;
  target_completion_date?: string;
  conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export const learningPathsApi = {
  list: (status?: LearningPathStatus) => 
    request('/learning-paths' + (status ? `?status=${status}` : '')),
  
  get: (id: string) => request(`/learning-paths/${id}`),
  
  create: (data: CreateLearningPathInput) => 
    request('/learning-paths', { method: 'POST', body: JSON.stringify(data) }),
  
  update: (id: string, data: UpdateLearningPathInput) => 
    request(`/learning-paths/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  
  delete: (id: string) => request(`/learning-paths/${id}`, { method: 'DELETE' }),

  addNode: (pathId: string, data: AddNodeInput) => 
    request(`/learning-paths/${pathId}/nodes`, { method: 'POST', body: JSON.stringify(data) }),
  
  updateNodeStatus: (pathId: string, nodeId: string, status: NodeStatus) => 
    request(`/learning-paths/${pathId}/nodes/${nodeId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  
  reorderNodes: (pathId: string, nodeIds: string[]) => 
    request(`/learning-paths/${pathId}/nodes/reorder`, { method: 'PUT', body: JSON.stringify({ node_order: nodeIds }) }),
  
  removeNode: (pathId: string, nodeId: string) => 
    request(`/learning-paths/${pathId}/nodes/${nodeId}`, { method: 'DELETE' }),

  getProgress: (pathId: string) => request(`/learning-paths/${pathId}/progress`),
  
  updateProgress: (pathId: string, data: UpdateProgressInput) => 
    request(`/learning-paths/${pathId}/progress`, { method: 'PUT', body: JSON.stringify(data) }),

  createPlan: (pathId: string, data: CreatePlanInput) => 
    request(`/learning-paths/${pathId}/plans`, { method: 'POST', body: JSON.stringify(data) }),
  
  getPlans: (pathId: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const queryString = params.toString();
    return request(`/learning-paths/${pathId}/plans${queryString ? `?${queryString}` : ''}`);
  },
  
  getPlan: (pathId: string, date: string) => 
    request(`/learning-paths/${pathId}/plans/${date}`),
  
  updatePlan: (pathId: string, date: string, data: UpdatePlanInput) => 
    request(`/learning-paths/${pathId}/plans/${date}`, { method: 'PUT', body: JSON.stringify(data) }),

  generateFromGraph: (data: GeneratePathInput) => 
    request('/learning-paths/generate', { method: 'POST', body: JSON.stringify(data) }),

  adjust: (id: string, data: {
    reason: string;
    node_ref_id?: string;
    adjustment_type: 'insert' | 'remove' | 'reorder' | 'difficulty';
  }) => request(`/learning-paths/${id}/adjust`, { method: 'POST', body: JSON.stringify(data) }),

  getRecommendations: (graphId: string) => 
    request(`/learning-paths/recommendations?graph_id=${graphId}`),
};

export const learningPathApi = {
  getQuestions: (data: { graph_id: string }) => 
    request('/learning-path/questions', { method: 'POST', body: JSON.stringify(data) }),
  
  generate: (data: {
    graph_id: string;
    target_goal?: string;
    target_knowledge_point_id?: string;
    learning_style?: 'sequential' | 'exploratory' | 'focused' | 'custom';
    daily_time_minutes?: number;
    current_knowledge?: string;
    provider?: string;
    model?: string;
  }) => request('/learning-path/generate', { method: 'POST', body: JSON.stringify(data) }),
  
  getProgress: (graphId: string) => request(`/learning-path/progress/${graphId}`),
};
