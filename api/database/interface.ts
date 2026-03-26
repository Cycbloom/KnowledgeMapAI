import type {
  User,
  Graph,
  GraphNode,
  KnowledgePoint,
  KnowledgePointVisibility,
  Edge,
  Template,
  RelationshipTypeConfig,
  GraphRelation,
  GraphCollaborator,
  CollaboratorRole,
  NodeLevel,
  EdgeLineStyle,
} from '../../shared/types/index';

import type {
  ScheduledTask,
  TaskExecution,
  TaskSettings,
  Queue,
  FocusSession,
  UserFocusStats,
  Achievement,
  UserAchievement,
} from '../../shared/types/scheduler';

import type {
  StudyCard,
  LearningPath,
  LearningPathNodeRef,
  Notification,
  NotificationSettings,
  Task,
} from '../../shared/types/common';

import type { QuizSet } from '../../shared/types/quiz';

export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page?: number;
  limit?: number;
}

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'ilike';
  value: unknown;
}

export interface QueryOptions {
  filters?: QueryFilter[];
  orderBy?: { field: string; direction: 'asc' | 'desc' }[];
  limit?: number;
  offset?: number;
}

export interface TransactionContext {
  execute: <T>(fn: () => Promise<T>) => Promise<T>;
}

export interface CreateUserInput {
  id: string;
  email: string;
  password_hash?: string;
  name?: string;
  settings?: Record<string, unknown>;
}

export interface UpdateUserInput {
  name?: string;
  settings?: Record<string, unknown>;
  xp?: number;
  level?: number;
}

export interface CreateGraphInput {
  user_id: string;
  title: string;
  description?: string;
  settings?: Record<string, unknown>;
  is_public?: boolean;
}

export interface UpdateGraphInput {
  title?: string;
  description?: string;
  settings?: Record<string, unknown>;
  is_public?: boolean;
  is_favorite?: boolean;
}

export interface CreateKnowledgePointInput {
  title: string;
  content?: string;
  learning_material?: string;
  properties?: Record<string, unknown>;
  visibility?: KnowledgePointVisibility;
  owner_id: string;
  embedding?: number[];
}

export interface UpdateKnowledgePointInput {
  title?: string;
  content?: string;
  learning_material?: string;
  properties?: Record<string, unknown>;
  visibility?: KnowledgePointVisibility;
}

export interface CreateGraphNodeInput {
  graph_id: string;
  knowledge_point_id: string;
  x_position: number;
  y_position: number;
  level: NodeLevel;
  is_accepted?: boolean;
}

export interface UpdateGraphNodeInput {
  x_position?: number;
  y_position?: number;
  level?: NodeLevel;
  is_accepted?: boolean;
}

export interface CreateEdgeInput {
  graph_id: string;
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
  relationship_type?: string;
  weight?: number;
  custom_label?: string;
  custom_color?: string;
  custom_line_style?: EdgeLineStyle;
  show_arrow?: boolean;
}

export interface UpdateEdgeInput {
  relationship_type?: string;
  weight?: number;
  custom_label?: string;
  custom_color?: string;
  custom_line_style?: EdgeLineStyle;
  show_arrow?: boolean;
}

export interface CreateScheduledTaskInput {
  user_id: string;
  title: string;
  description?: string;
  queue_level?: number;
  position?: number;
  estimated_duration?: number;
  deadline?: string;
  tags?: string[];
  knowledge_point_id?: string;
  priority?: number;
  task_type?: string;
  total_duration?: number;
  progress_mode?: string;
  parent_task_id?: string;
  context?: string;
}

export interface UpdateScheduledTaskInput {
  title?: string;
  description?: string;
  queue_level?: number;
  position?: number;
  estimated_duration?: number;
  actual_duration?: number;
  deadline?: string;
  status?: string;
  tags?: string[];
  priority?: number;
  task_type?: string;
  total_duration?: number;
  progress_mode?: string;
  progress_percentage?: number;
  parent_task_id?: string;
  context?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  notes?: string;
}

export interface CreateStudyCardInput {
  user_id: string;
  knowledge_point_id: string;
  graph_id: string;
  source_graph_id?: string;
  question: string;
  answer: string;
  explanation?: string;
  card_type?: string;
  options?: string[];
  difficulty?: number;
  quiz_set_id?: string;
}

export interface UpdateStudyCardInput {
  question?: string;
  answer?: string;
  explanation?: string;
  card_type?: string;
  options?: string[];
  difficulty?: number;
  last_reviewed?: string;
  next_review?: string;
  review_count?: number;
  fsrs_state?: number;
  fsrs_stability?: number;
  fsrs_difficulty?: number;
  fsrs_elapsed_days?: number;
  fsrs_scheduled_days?: number;
  fsrs_retrievability?: number;
  fsrs_last_review?: string;
}

export interface CreateFocusSessionInput {
  user_id: string;
  task_id?: string;
  start_time: string;
  end_time?: string;
  duration: number;
  mode: string;
  pomodoro_count?: number;
  white_noise_type?: string;
  is_break?: boolean;
}

export interface DatabaseInterface {
  isConnected(): Promise<boolean>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;

  transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;

  getUser(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  createUser(data: CreateUserInput): Promise<User>;
  updateUser(id: string, data: UpdateUserInput): Promise<User>;
  deleteUser(id: string): Promise<void>;

  getGraphs(userId: string, options?: QueryOptions): Promise<Graph[]>;
  getGraph(id: string): Promise<Graph | null>;
  createGraph(data: CreateGraphInput): Promise<Graph>;
  updateGraph(id: string, data: UpdateGraphInput): Promise<Graph>;
  deleteGraph(id: string, userId: string): Promise<void>;
  restoreGraph(id: string, userId: string): Promise<void>;
  permanentDeleteGraph(id: string, userId: string): Promise<void>;
  getGraphsWithCounts(userId: string): Promise<Array<Graph & { nodes_count: number }>>;
  getTrashedGraphs(userId: string): Promise<Array<Graph & { nodes_count: number }>>;

  getKnowledgePoints(userId: string, options?: QueryOptions): Promise<KnowledgePoint[]>;
  getKnowledgePoint(id: string): Promise<KnowledgePoint | null>;
  createKnowledgePoint(data: CreateKnowledgePointInput): Promise<KnowledgePoint>;
  updateKnowledgePoint(id: string, data: UpdateKnowledgePointInput): Promise<KnowledgePoint>;
  deleteKnowledgePoint(id: string, userId: string): Promise<{
    success: boolean;
    affected_graphs: number;
    deleted_graph_nodes: number;
    deleted_edges: number;
    deleted_cards: number;
  }>;
  getAccessibleKnowledgePoints(userId: string): Promise<KnowledgePoint[]>;
  searchSimilarKnowledgePoints(
    embedding: number[],
    userId: string,
    threshold: number,
    limit: number
  ): Promise<Array<{
    id: string;
    title: string;
    content?: string;
    similarity: number;
    visibility: KnowledgePointVisibility;
  }>>;

  getGraphNodes(graphId: string): Promise<GraphNode[]>;
  getGraphNode(id: string): Promise<GraphNode | null>;
  createGraphNode(data: CreateGraphNodeInput): Promise<GraphNode>;
  updateGraphNode(id: string, data: UpdateGraphNodeInput): Promise<GraphNode>;
  deleteGraphNode(id: string): Promise<void>;

  getEdges(graphId: string): Promise<Edge[]>;
  getEdge(id: string): Promise<Edge | null>;
  createEdge(data: CreateEdgeInput): Promise<Edge>;
  updateEdge(id: string, data: UpdateEdgeInput): Promise<Edge>;
  deleteEdge(id: string): Promise<void>;

  getScheduledTasks(userId: string, options?: QueryOptions): Promise<ScheduledTask[]>;
  getScheduledTask(id: string): Promise<ScheduledTask | null>;
  createScheduledTask(data: CreateScheduledTaskInput): Promise<ScheduledTask>;
  updateScheduledTask(id: string, data: UpdateScheduledTaskInput): Promise<ScheduledTask>;
  deleteScheduledTask(id: string, userId: string): Promise<void>;
  getTasksByQueue(userId: string, queueLevel: number): Promise<ScheduledTask[]>;
  reorderTasks(userId: string, queueLevel: number, taskIds: string[]): Promise<void>;

  getTaskExecutions(taskId: string): Promise<TaskExecution[]>;
  createTaskExecution(data: {
    task_id: string;
    user_id: string;
    started_at: string;
    queue_level: number;
    status: string;
  }): Promise<TaskExecution>;
  updateTaskExecution(id: string, data: {
    ended_at?: string;
    duration?: number;
    status?: string;
  }): Promise<TaskExecution>;

  getTaskSettings(userId: string): Promise<TaskSettings | null>;
  updateTaskSettings(userId: string, data: Partial<TaskSettings>): Promise<TaskSettings>;

  getStudyCards(userId: string, options?: {
    graphId?: string;
    knowledgePointId?: string;
    dueOnly?: boolean;
  }): Promise<StudyCard[]>;
  getStudyCard(id: string): Promise<StudyCard | null>;
  createStudyCard(data: CreateStudyCardInput): Promise<StudyCard>;
  createStudyCardsBatch(data: CreateStudyCardInput[]): Promise<StudyCard[]>;
  updateStudyCard(id: string, data: UpdateStudyCardInput): Promise<StudyCard>;
  deleteStudyCard(id: string): Promise<void>;
  deleteStudyCardsBatch(ids: string[]): Promise<void>;

  getFocusSessions(userId: string, options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<FocusSession[]>;
  createFocusSession(data: CreateFocusSessionInput): Promise<FocusSession>;

  getUserFocusStats(userId: string): Promise<UserFocusStats | null>;
  updateUserFocusStats(userId: string, data: Partial<UserFocusStats>): Promise<UserFocusStats>;

  getAchievements(): Promise<Achievement[]>;
  getUserAchievements(userId: string): Promise<UserAchievement[]>;
  unlockAchievement(userId: string, achievementId: string): Promise<UserAchievement>;

  getTemplates(userId: string, options?: { isSystem?: boolean }): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | null>;
  createTemplate(data: Omit<Template, 'id' | 'created_at' | 'updated_at'>): Promise<Template>;
  updateTemplate(id: string, data: Partial<Template>): Promise<Template>;
  deleteTemplate(id: string): Promise<void>;

  getRelationshipTypes(userId?: string): Promise<RelationshipTypeConfig[]>;
  createRelationshipType(data: Omit<RelationshipTypeConfig, 'id' | 'created_at' | 'updated_at'>): Promise<RelationshipTypeConfig>;
  updateRelationshipType(id: string, data: Partial<RelationshipTypeConfig>): Promise<RelationshipTypeConfig>;
  deleteRelationshipType(id: string): Promise<void>;

  getGraphRelations(graphId: string): Promise<GraphRelation[]>;
  createGraphRelation(data: {
    source_graph_id: string;
    target_graph_id: string;
    relation_type: string;
    context?: string;
    metadata?: Record<string, unknown>;
  }): Promise<GraphRelation>;
  deleteGraphRelation(id: string): Promise<void>;

  getGraphCollaborators(graphId: string): Promise<GraphCollaborator[]>;
  addGraphCollaborator(data: {
    graph_id: string;
    user_id: string;
    role: CollaboratorRole;
    invited_by?: string;
  }): Promise<GraphCollaborator>;
  updateGraphCollaborator(id: string, data: { role: CollaboratorRole }): Promise<GraphCollaborator>;
  removeGraphCollaborator(id: string): Promise<void>;

  getQueues(userId: string): Promise<Queue[]>;
  createQueue(data: {
    user_id: string;
    name: string;
    color: string;
    time_slice: number;
    priority: number;
  }): Promise<Queue>;
  updateQueue(id: string, data: Partial<Queue>): Promise<Queue>;
  deleteQueue(id: string): Promise<void>;

  getQuizSets(userId: string): Promise<QuizSet[]>;
  getQuizSet(id: string): Promise<QuizSet | null>;
  createQuizSet(data: {
    user_id: string;
    title: string;
    description?: string;
    graph_id?: string;
    config: Record<string, unknown>;
  }): Promise<QuizSet>;
  updateQuizSet(id: string, data: Partial<QuizSet>): Promise<QuizSet>;
  deleteQuizSet(id: string): Promise<void>;

  getLearningPaths(userId: string): Promise<LearningPath[]>;
  getLearningPath(id: string): Promise<LearningPath | null>;
  createLearningPath(data: {
    user_id: string;
    title: string;
    description?: string;
    goal?: string;
    target_date?: string;
    source_graph_id?: string;
    daily_minutes_target?: number;
  }): Promise<LearningPath>;
  updateLearningPath(id: string, data: Partial<LearningPath>): Promise<LearningPath>;
  deleteLearningPath(id: string): Promise<void>;

  getLearningPathNodes(pathId: string): Promise<LearningPathNodeRef[]>;
  createLearningPathNode(data: {
    path_id: string;
    knowledge_point_id?: string;
    order_index: number;
    title: string;
    description?: string;
    estimated_time?: number;
  }): Promise<LearningPathNodeRef>;
  updateLearningPathNode(id: string, data: Partial<LearningPathNodeRef>): Promise<LearningPathNodeRef>;
  deleteLearningPathNode(id: string): Promise<void>;

  getNotifications(userId: string, options?: { unreadOnly?: boolean }): Promise<Notification[]>;
  createNotification(data: {
    user_id: string;
    type: string;
    title: string;
    message?: string;
    data?: Record<string, unknown>;
    expires_at?: string;
  }): Promise<Notification>;
  markNotificationRead(id: string): Promise<void>;
  deleteNotification(id: string): Promise<void>;

  getNotificationSettings(userId: string): Promise<NotificationSettings | null>;
  updateNotificationSettings(userId: string, data: Partial<NotificationSettings>): Promise<NotificationSettings>;

  getAsyncTasks(userId: string, options?: { status?: string }): Promise<Task[]>;
  getAsyncTask(id: string): Promise<Task | null>;
  createAsyncTask(data: {
    user_id: string;
    type: string;
    name?: string;
    payload?: Record<string, unknown>;
  }): Promise<Task>;
  updateAsyncTask(id: string, data: {
    status?: string;
    result?: Record<string, unknown>;
    error?: string;
  }): Promise<Task>;
  deleteAsyncTask(id: string): Promise<void>;

  raw<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  rawOne<T = unknown>(sql: string, params?: unknown[]): Promise<T | null>;
  execute(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertRowid: unknown }>;
}

export type DatabaseMode = 'cloud';

export interface DatabaseConfig {
  supabase: {
    url: string;
    key: string;
  };
}
