import type { User, Graph, GraphNode, KnowledgePoint, Edge, Template } from '../shared/types/index.js';
import type { UserTask, Queue, FocusSession, Achievement, UserAchievement } from '../shared/types/scheduler.js';
import type { StudyCard, LearningPath, Notification } from '../shared/types/common.js';
import type { QuizSet } from '../shared/types/quiz.js';

export interface ExportedData {
  version: string;
  exported_at: string;
  source: 'supabase';
  users: ExportedUser[];
  knowledge_graphs: ExportedGraph[];
  knowledge_points: ExportedKnowledgePoint[];
  graph_nodes: ExportedGraphNode[];
  edges: ExportedEdge[];
  study_cards: ExportedStudyCard[];
  user_tasks: ExportedScheduledTask[];
  focus_sessions: ExportedFocusSession[];
  templates: ExportedTemplate[];
  achievements: ExportedAchievement[];
  user_achievements: ExportedUserAchievement[];
  queues: ExportedQueue[];
  quiz_sets: ExportedQuizSet[];
  learning_paths: ExportedLearningPath[];
  notifications: ExportedNotification[];
}

export interface ExportedUser {
  id: string;
  email: string;
  name: string;
  password_hash: string | null;
  settings: Record<string, unknown>;
  xp: number;
  level: number;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface ExportedGraph {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  settings: Record<string, unknown>;
  is_public: boolean;
  is_favorite: boolean;
  parent_graph_id: string | null;
  last_used_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExportedKnowledgePoint {
  id: string;
  title: string;
  content: string | null;
  learning_material: string | null;
  properties: Record<string, unknown>;
  visibility: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface ExportedGraphNode {
  id: string;
  graph_id: string;
  knowledge_point_id: string;
  x_position: number;
  y_position: number;
  level: string;
  is_accepted: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExportedEdge {
  id: string;
  graph_id: string;
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  relationship_type: string;
  weight: number;
  custom_label: string | null;
  custom_color: string | null;
  custom_line_style: string;
  show_arrow: boolean | null;
  deleted_at: string | null;
  created_at: string;
}

export interface ExportedStudyCard {
  id: string;
  knowledge_point_id: string | null;
  user_id: string;
  graph_id: string | null;
  source_graph_id: string | null;
  question: string;
  answer: string;
  explanation: string | null;
  card_type: string;
  options: string[] | null;
  difficulty: number;
  last_reviewed: string | null;
  next_review: string;
  review_count: number;
  fsrs_state: number;
  fsrs_stability: number;
  fsrs_difficulty: number;
  fsrs_elapsed_days: number;
  fsrs_scheduled_days: number;
  fsrs_retrievability: number;
  fsrs_last_review: string | null;
  quiz_set_id: string | null;
  created_at: string;
}

export interface ExportedScheduledTask {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  queue_id: string | null;
  queue_level: number;
  position: number;
  estimated_duration: number | null;
  actual_duration: number | null;
  deadline: string | null;
  status: string;
  tags: string[];
  knowledge_point_id: string | null;
  priority: number;
  task_type: string;
  total_duration: number | null;
  progress_mode: string | null;
  progress_percentage: number;
  parent_task_id: string | null;
  context: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  completed_at: string | null;
}

export interface ExportedFocusSession {
  id: string;
  user_id: string;
  task_id: string | null;
  start_time: string;
  end_time: string;
  duration: number;
  mode: string;
  completed: boolean;
  pomodoro_count: number;
  white_noise_type: string | null;
  is_break: boolean;
  created_at: string;
}

export interface ExportedTemplate {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  category: string;
  is_system: boolean;
  nodes: unknown[];
  edges: unknown[];
  layout: unknown | null;
  created_at: string;
  updated_at: string;
}

export interface ExportedAchievement {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  icon: string | null;
  color: string;
  xp_reward: number;
  condition_type: string;
  condition_value: number;
  is_hidden: boolean;
  created_at: string;
}

export interface ExportedUserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  progress: number;
  metadata: Record<string, unknown>;
  unlocked_at: string;
}

export interface ExportedQueue {
  id: string;
  user_id: string;
  name: string;
  color: string;
  time_slice: number;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface ExportedQuizSet {
  id: string;
  user_id: string;
  graph_id: string | null;
  title: string;
  description: string | null;
  config: Record<string, unknown>;
  status: string;
  card_count: number;
  created_at: string;
  updated_at: string;
}

export interface ExportedLearningPath {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  goal: string | null;
  target_date: string | null;
  source_graph_id: string | null;
  total_estimated_time: number;
  ai_generated: boolean;
  status: string;
  daily_minutes_target: number;
  created_at: string;
  updated_at: string;
}

export interface ExportedNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export function convertUserToExport(user: any): ExportedUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name || 'User',
    password_hash: user.password_hash || null,
    settings: user.settings || user.user_metadata || {},
    xp: user.xp || user.profile?.xp || 0,
    level: user.level || user.profile?.level || 1,
    role: user.role || user.profile?.role || 'user',
    created_at: user.created_at || new Date().toISOString(),
    updated_at: user.updated_at || new Date().toISOString(),
  };
}

export function convertGraphToExport(graph: any): ExportedGraph {
  return {
    id: graph.id,
    user_id: graph.user_id,
    title: graph.title,
    description: graph.description || null,
    settings: graph.settings || {},
    is_public: graph.is_public || false,
    is_favorite: graph.is_favorite || false,
    parent_graph_id: graph.parent_graph_id || null,
    last_used_at: graph.last_used_at || null,
    deleted_at: graph.deleted_at || null,
    created_at: graph.created_at || new Date().toISOString(),
    updated_at: graph.updated_at || new Date().toISOString(),
  };
}

export function convertKnowledgePointToExport(kp: any): ExportedKnowledgePoint {
  return {
    id: kp.id,
    title: kp.title,
    content: kp.content || null,
    learning_material: kp.learning_material || null,
    properties: kp.properties || {},
    visibility: kp.visibility || 'private',
    owner_id: kp.owner_id,
    created_at: kp.created_at || new Date().toISOString(),
    updated_at: kp.updated_at || new Date().toISOString(),
  };
}

export function convertGraphNodeToExport(node: any): ExportedGraphNode {
  return {
    id: node.id,
    graph_id: node.graph_id,
    knowledge_point_id: node.knowledge_point_id,
    x_position: node.x_position || 0,
    y_position: node.y_position || 0,
    level: node.level || 'normal',
    is_accepted: node.is_accepted !== false,
    deleted_at: node.deleted_at || null,
    created_at: node.created_at || new Date().toISOString(),
    updated_at: node.updated_at || new Date().toISOString(),
  };
}

export function convertEdgeToExport(edge: any): ExportedEdge {
  return {
    id: edge.id,
    graph_id: edge.graph_id,
    source_knowledge_point_id: edge.source_knowledge_point_id,
    target_knowledge_point_id: edge.target_knowledge_point_id,
    relationship_type: edge.relationship_type || 'related',
    weight: edge.weight || 1,
    custom_label: edge.custom_label || null,
    custom_color: edge.custom_color || null,
    custom_line_style: edge.custom_line_style || 'solid',
    show_arrow: edge.show_arrow ?? null,
    deleted_at: edge.deleted_at || null,
    created_at: edge.created_at || new Date().toISOString(),
  };
}

export function convertStudyCardToExport(card: any): ExportedStudyCard {
  return {
    id: card.id,
    knowledge_point_id: card.knowledge_point_id || null,
    user_id: card.user_id,
    graph_id: card.graph_id || null,
    source_graph_id: card.source_graph_id || null,
    question: card.question,
    answer: card.answer,
    explanation: card.explanation || null,
    card_type: card.card_type || 'qa',
    options: card.options || null,
    difficulty: card.difficulty || 1,
    last_reviewed: card.last_reviewed || null,
    next_review: card.next_review || new Date().toISOString(),
    review_count: card.review_count || 0,
    fsrs_state: card.fsrs_state || "New",
    fsrs_stability: card.fsrs_stability || 0,
    fsrs_difficulty: card.fsrs_difficulty || 0,
    fsrs_elapsed_days: card.fsrs_elapsed_days || 0,
    fsrs_scheduled_days: card.fsrs_scheduled_days || 0,
    fsrs_retrievability: card.fsrs_retrievability || 0,
    fsrs_last_review: card.fsrs_last_review || null,
    quiz_set_id: card.quiz_set_id || null,
    created_at: card.created_at || new Date().toISOString(),
  };
}

export function convertScheduledTaskToExport(task: any): ExportedScheduledTask {
  return {
    id: task.id,
    user_id: task.user_id,
    title: task.title,
    description: task.description || null,
    queue_id: task.queue_id || null,
    queue_level: task.queue_level || 0,
    position: task.position || 0,
    estimated_duration: task.estimated_duration || null,
    actual_duration: task.actual_duration || null,
    deadline: task.deadline || null,
    status: task.status || 'pending',
    tags: task.tags || [],
    knowledge_point_id: task.knowledge_point_id || null,
    priority: task.priority || 0,
    task_type: task.task_type || 'one_time',
    total_duration: task.total_duration || null,
    progress_mode: task.progress_mode || null,
    progress_percentage: task.progress_percentage || 0,
    parent_task_id: task.parent_task_id || null,
    context: task.context || null,
    scheduled_start: task.scheduled_start || null,
    scheduled_end: task.scheduled_end || null,
    notes: task.notes || null,
    created_at: task.created_at || new Date().toISOString(),
    updated_at: task.updated_at || new Date().toISOString(),
    deleted_at: task.deleted_at || null,
    completed_at: task.completed_at || null,
  };
}

export function convertFocusSessionToExport(session: any): ExportedFocusSession {
  return {
    id: session.id,
    user_id: session.user_id,
    task_id: session.task_id || null,
    start_time: session.start_time || session.started_at || new Date().toISOString(),
    end_time: session.end_time || session.ended_at || new Date().toISOString(),
    duration: session.duration || 0,
    mode: session.mode || 'focus',
    completed: session.completed !== false,
    pomodoro_count: session.pomodoro_count || 0,
    white_noise_type: session.white_noise_type || null,
    is_break: session.is_break || false,
    created_at: session.created_at || new Date().toISOString(),
  };
}

export function convertTemplateToExport(template: any): ExportedTemplate {
  return {
    id: template.id,
    user_id: template.user_id || null,
    name: template.name,
    description: template.description || null,
    category: template.category || 'custom',
    is_system: template.is_system || false,
    nodes: template.nodes || [],
    edges: template.edges || [],
    layout: template.layout || null,
    created_at: template.created_at || new Date().toISOString(),
    updated_at: template.updated_at || new Date().toISOString(),
  };
}

export function convertAchievementToExport(achievement: any): ExportedAchievement {
  return {
    id: achievement.id,
    code: achievement.code,
    name: achievement.name,
    description: achievement.description || null,
    category: achievement.category,
    icon: achievement.icon || null,
    color: achievement.color || '#3B82F6',
    xp_reward: achievement.xp_reward || 100,
    condition_type: achievement.condition_type,
    condition_value: achievement.condition_value,
    is_hidden: achievement.is_hidden || false,
    created_at: achievement.created_at || new Date().toISOString(),
  };
}

export function convertUserAchievementToExport(ua: any): ExportedUserAchievement {
  return {
    id: ua.id,
    user_id: ua.user_id,
    achievement_id: ua.achievement_id,
    progress: ua.progress || 0,
    metadata: ua.metadata || {},
    unlocked_at: ua.unlocked_at || new Date().toISOString(),
  };
}

export function convertQueueToExport(queue: any): ExportedQueue {
  return {
    id: queue.id,
    user_id: queue.user_id,
    name: queue.name,
    color: queue.color || 'blue',
    time_slice: queue.time_slice || 30,
    priority: queue.priority || 0,
    created_at: queue.created_at || new Date().toISOString(),
    updated_at: queue.updated_at || new Date().toISOString(),
  };
}

export function convertQuizSetToExport(quizSet: any): ExportedQuizSet {
  return {
    id: quizSet.id,
    user_id: quizSet.user_id,
    graph_id: quizSet.graph_id || null,
    title: quizSet.title,
    description: quizSet.description || null,
    config: quizSet.config || {},
    status: quizSet.status || 'draft',
    card_count: quizSet.card_count || 0,
    created_at: quizSet.created_at || new Date().toISOString(),
    updated_at: quizSet.updated_at || new Date().toISOString(),
  };
}

export function convertLearningPathToExport(path: any): ExportedLearningPath {
  return {
    id: path.id,
    user_id: path.user_id,
    title: path.title,
    description: path.description || null,
    goal: path.goal || path.goal_content || null,
    target_date: path.target_date || path.target_completion_date || null,
    source_graph_id: path.source_graph_id || null,
    total_estimated_time: path.total_estimated_time || (path.estimated_hours ? path.estimated_hours * 60 : 0),
    ai_generated: path.ai_generated || false,
    status: path.status || 'active',
    daily_minutes_target: path.daily_minutes_target || 30,
    created_at: path.created_at || new Date().toISOString(),
    updated_at: path.updated_at || new Date().toISOString(),
  };
}

export function convertNotificationToExport(notification: any): ExportedNotification {
  return {
    id: notification.id,
    user_id: notification.user_id,
    type: notification.type,
    title: notification.title,
    message: notification.message || null,
    data: notification.data || {},
    read_at: notification.read_at || null,
    created_at: notification.created_at || new Date().toISOString(),
    expires_at: notification.expires_at || null,
  };
}

export function createEmptyExportData(): ExportedData {
  return {
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    source: 'supabase',
    users: [],
    knowledge_graphs: [],
    knowledge_points: [],
    graph_nodes: [],
    edges: [],
    study_cards: [],
    user_tasks: [],
    focus_sessions: [],
    templates: [],
    achievements: [],
    user_achievements: [],
    queues: [],
    quiz_sets: [],
    learning_paths: [],
    notifications: [],
  };
}

export function validateExportData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.version) {
    errors.push('Missing version field');
  }

  if (!data.exported_at) {
    errors.push('Missing exported_at field');
  }

  if (!data.source) {
    errors.push('Missing source field');
  }

  const requiredArrays = [
    'users', 'knowledge_graphs', 'knowledge_points', 'graph_nodes',
    'edges', 'study_cards', 'user_tasks', 'focus_sessions',
    'templates', 'achievements', 'user_achievements', 'queues',
    'quiz_sets', 'learning_paths', 'notifications'
  ];

  for (const field of requiredArrays) {
    if (!Array.isArray(data[field])) {
      errors.push(`Missing or invalid ${field} array`);
    }
  }

  if (data.users && Array.isArray(data.users)) {
    for (let i = 0; i < data.users.length; i++) {
      const user = data.users[i];
      if (!user.id) errors.push(`users[${i}]: missing id`);
      if (!user.email) errors.push(`users[${i}]: missing email`);
    }
  }

  if (data.knowledge_graphs && Array.isArray(data.knowledge_graphs)) {
    for (let i = 0; i < data.knowledge_graphs.length; i++) {
      const graph = data.knowledge_graphs[i];
      if (!graph.id) errors.push(`knowledge_graphs[${i}]: missing id`);
      if (!graph.user_id) errors.push(`knowledge_graphs[${i}]: missing user_id`);
      if (!graph.title) errors.push(`knowledge_graphs[${i}]: missing title`);
    }
  }

  if (data.knowledge_points && Array.isArray(data.knowledge_points)) {
    for (let i = 0; i < data.knowledge_points.length; i++) {
      const kp = data.knowledge_points[i];
      if (!kp.id) errors.push(`knowledge_points[${i}]: missing id`);
      if (!kp.owner_id) errors.push(`knowledge_points[${i}]: missing owner_id`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function getExportStats(data: ExportedData): Record<string, number> {
  return {
    users: data.users.length,
    knowledge_graphs: data.knowledge_graphs.length,
    knowledge_points: data.knowledge_points.length,
    graph_nodes: data.graph_nodes.length,
    edges: data.edges.length,
    study_cards: data.study_cards.length,
    user_tasks: data.user_tasks.length,
    focus_sessions: data.focus_sessions.length,
    templates: data.templates.length,
    achievements: data.achievements.length,
    user_achievements: data.user_achievements.length,
    queues: data.queues.length,
    quiz_sets: data.quiz_sets.length,
    learning_paths: data.learning_paths.length,
    notifications: data.notifications.length,
  };
}
