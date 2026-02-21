import { request } from './client';

export const learningPathsApi = {
  list: () => request('/learning-paths'),
  
  get: (id: string) => request(`/learning-paths/${id}`),
  
  create: (data: {
    title: string;
    description?: string;
    goal_type: 'natural_language' | 'graph_node' | 'template';
    goal_content?: string;
    target_knowledge_point_id?: string;
    template_id?: string;
    daily_minutes_target?: number;
    target_completion_date?: string;
  }) => request('/learning-paths', { method: 'POST', body: JSON.stringify(data) }),
  
  generate: (data: {
    goal: string;
    context?: string;
    goal_type?: 'natural_language' | 'graph_node' | 'template';
    target_knowledge_point_id?: string;
    template_id?: string;
    daily_minutes_target?: number;
    target_completion_date?: string;
    conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  }) => request('/learning-paths/generate', { method: 'POST', body: JSON.stringify(data) }),
  
  update: (id: string, data: Partial<{
    title: string;
    description: string;
    status: 'active' | 'completed' | 'paused' | 'archived';
    daily_minutes_target: number;
    target_completion_date: string;
  }>) => request(`/learning-paths/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  
  delete: (id: string) => request(`/learning-paths/${id}`, { method: 'DELETE' }),
  
  adjust: (id: string, data: {
    reason: string;
    node_ref_id?: string;
    adjustment_type: 'insert' | 'remove' | 'reorder' | 'difficulty';
  }) => request(`/learning-paths/${id}/adjust`, { method: 'POST', body: JSON.stringify(data) }),
  
  updateNodeStatus: (pathId: string, nodeRefId: string, status: 'pending' | 'in_progress' | 'completed' | 'skipped') => 
    request(`/learning-paths/${pathId}/nodes/${nodeRefId}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  
  reorderNodes: (pathId: string, nodeRefIds: string[]) => 
    request(`/learning-paths/${pathId}/nodes/reorder`, { method: 'PUT', body: JSON.stringify({ node_order: nodeRefIds }) }),
  
  addNode: (pathId: string, data: { node_id: string; estimated_minutes?: number; difficulty_level?: number }) =>
    request(`/learning-paths/${pathId}/nodes`, { method: 'POST', body: JSON.stringify(data) }),
  
  removeNode: (pathId: string, nodeRefId: string) =>
    request(`/learning-paths/${pathId}/nodes/${nodeRefId}`, { method: 'DELETE' }),
  
  getProgress: (id: string) => request(`/learning-paths/${id}/progress`),
  
  getRecommendations: (graphId: string) => request(`/learning-paths/recommendations?graph_id=${graphId}`),
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
