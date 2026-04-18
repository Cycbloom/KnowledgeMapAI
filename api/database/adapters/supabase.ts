import { SupabaseClient, createClient } from '@supabase/supabase-js';
import type {
  DatabaseInterface,
  TransactionContext,
  QueryOptions,
  CreateUserInput,
  UpdateUserInput,
  CreateGraphInput,
  UpdateGraphInput,
  CreateKnowledgePointInput,
  UpdateKnowledgePointInput,
  CreateGraphNodeInput,
  UpdateGraphNodeInput,
  CreateEdgeInput,
  UpdateEdgeInput,
  CreateScheduledTaskInput,
  UpdateScheduledTaskInput,
  CreateStudyCardInput,
  UpdateStudyCardInput,
  CreateFocusSessionInput,
} from '../interface';

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
} from '../../../shared/types/index';

import type {
  ScheduledTask,
  TaskExecution,
  TaskSettings,
  Queue,
  FocusSession,
  UserFocusStats,
  Achievement,
  UserAchievement,
} from '../../../shared/types/scheduler';

import type {
  StudyCard,
  LearningPath,
  LearningPathNodeRef,
  Notification,
  NotificationSettings,
  Task,
} from '../../../shared/types/common';

import type { QuizSet } from '../../../shared/types/quiz';
import { logger } from '../../utils/logger';

function now(): string {
  return new Date().toISOString();
}

export class SupabaseAdapter implements DatabaseInterface {
  private client: SupabaseClient;
  private connected: boolean = false;

  constructor(url: string, key: string) {
    this.client = createClient(url, key);
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  isConnected(): Promise<boolean> {
    return Promise.resolve(this.connected);
  }

  async connect(): Promise<void> {
    const { error } = await this.client.from('users').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      logger.warn('Supabase connection check:', error.message);
    }
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    return fn({
      execute: async <U>(innerFn: () => Promise<U>) => innerFn()
    });
  }

  async getUser(id: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      user_metadata: data.settings || {},
      profile: {
        xp: data.xp || 0,
        level: data.level || 1,
        role: data.role || 'user',
      },
    };
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.client
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      user_metadata: data.settings || {},
      profile: {
        xp: data.xp || 0,
        level: data.level || 1,
        role: data.role || 'user',
      },
    };
  }

  async createUser(data: CreateUserInput): Promise<User> {
    const { data: user, error } = await this.client
      .from('users')
      .insert({
        id: data.id,
        email: data.email,
        password_hash: data.password_hash,
        name: data.name || 'User',
        settings: data.settings || {},
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      user_metadata: user.settings || {},
      profile: {
        xp: user.xp || 0,
        level: user.level || 1,
        role: user.role || 'user',
      },
    };
  }

  async updateUser(id: string, data: UpdateUserInput): Promise<User> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.settings !== undefined) updateData.settings = data.settings;
    if (data.xp !== undefined) updateData.xp = data.xp;
    if (data.level !== undefined) updateData.level = data.level;

    const { data: user, error } = await this.client
      .from('users')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      user_metadata: user.settings || {},
      profile: {
        xp: user.xp || 0,
        level: user.level || 1,
        role: user.role || 'user',
      },
    };
  }

  async deleteUser(id: string): Promise<void> {
    const { error } = await this.client
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getGraphs(userId: string, options?: QueryOptions): Promise<Graph[]> {
    let query = this.client
      .from('knowledge_graphs')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (options?.orderBy) {
      for (const order of options.orderBy) {
        query = query.order(order.field, { ascending: order.direction === 'asc' });
      }
    } else {
      query = query.order('last_used_at', { ascending: false });
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      user_id: row.user_id,
      settings: row.settings || {},
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_favorite: row.is_favorite,
    }));
  }

  async getGraph(id: string): Promise<Graph | null> {
    const { data, error } = await this.client
      .from('knowledge_graphs')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      title: data.title,
      description: data.description,
      user_id: data.user_id,
      settings: data.settings || {},
      created_at: data.created_at,
      updated_at: data.updated_at,
      is_favorite: data.is_favorite,
    };
  }

  async createGraph(data: CreateGraphInput): Promise<Graph> {
    const { data: graph, error } = await this.client
      .from('knowledge_graphs')
      .insert({
        user_id: data.user_id,
        title: data.title,
        description: data.description,
        settings: data.settings || {},
        is_public: data.is_public || false,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: graph.id,
      title: graph.title,
      description: graph.description,
      user_id: graph.user_id,
      settings: graph.settings || {},
      created_at: graph.created_at,
      updated_at: graph.updated_at,
      is_favorite: graph.is_favorite,
    };
  }

  async updateGraph(id: string, data: UpdateGraphInput): Promise<Graph> {
    const updateData: Record<string, unknown> = { updated_at: now() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.settings !== undefined) updateData.settings = data.settings;
    if (data.is_public !== undefined) updateData.is_public = data.is_public;
    if (data.is_favorite !== undefined) updateData.is_favorite = data.is_favorite;

    const { data: graph, error } = await this.client
      .from('knowledge_graphs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: graph.id,
      title: graph.title,
      description: graph.description,
      user_id: graph.user_id,
      settings: graph.settings || {},
      created_at: graph.created_at,
      updated_at: graph.updated_at,
      is_favorite: graph.is_favorite,
    };
  }

  async deleteGraph(id: string, _userId: string): Promise<void> {
    const { error } = await this.client
      .from('knowledge_graphs')
      .update({ deleted_at: now(), updated_at: now() })
      .eq('id', id);

    if (error) throw error;
  }

  async restoreGraph(id: string, _userId: string): Promise<void> {
    const { error } = await this.client
      .from('knowledge_graphs')
      .update({ deleted_at: null, updated_at: now() })
      .eq('id', id);

    if (error) throw error;
  }

  async permanentDeleteGraph(id: string, _userId: string): Promise<void> {
    const { error } = await this.client
      .from('knowledge_graphs')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getGraphsWithCounts(userId: string): Promise<Array<Graph & { nodes_count: number }>> {
    const { data, error } = await this.client.rpc('get_user_graphs_with_counts', {
      p_user_id: userId,
    });

    if (error) {
      const { data: graphs } = await this.client
        .from('knowledge_graphs')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('is_favorite', { ascending: false })
        .order('last_used_at', { ascending: false });

      if (!graphs) return [];

      const graphIds = graphs.map(g => g.id);
      const { data: nodeCounts } = await this.client
        .from('graph_nodes')
        .select('graph_id')
        .in('graph_id', graphIds)
        .is('deleted_at', null);

      const countMap = new Map<string, number>();
      (nodeCounts || []).forEach(n => {
        countMap.set(n.graph_id, (countMap.get(n.graph_id) || 0) + 1);
      });

      return graphs.map(g => ({
        id: g.id,
        title: g.title,
        description: g.description,
        user_id: g.user_id,
        settings: g.settings || {},
        created_at: g.created_at,
        updated_at: g.updated_at,
        is_favorite: g.is_favorite,
        nodes_count: countMap.get(g.id) || 0,
      }));
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      user_id: row.user_id,
      settings: row.settings || {},
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_favorite: row.is_favorite,
      nodes_count: row.nodes_count || 0,
    }));
  }

  async getTrashedGraphs(userId: string): Promise<Array<Graph & { nodes_count: number }>> {
    const { data, error } = await this.client.rpc('get_user_trashed_graphs', {
      p_user_id: userId,
    });

    if (error) {
      const { data: graphs } = await this.client
        .from('knowledge_graphs')
        .select('*')
        .eq('user_id', userId)
        .not('deleted_at', 'is', null)
        .order('deleted_at', { ascending: false });

      if (!graphs) return [];

      const graphIds = graphs.map(g => g.id);
      const { data: nodeCounts } = await this.client
        .from('graph_nodes')
        .select('graph_id')
        .in('graph_id', graphIds)
        .is('deleted_at', null);

      const countMap = new Map<string, number>();
      (nodeCounts || []).forEach(n => {
        countMap.set(n.graph_id, (countMap.get(n.graph_id) || 0) + 1);
      });

      return graphs.map(g => ({
        id: g.id,
        title: g.title,
        description: g.description,
        user_id: g.user_id,
        settings: g.settings || {},
        created_at: g.created_at,
        updated_at: g.updated_at,
        is_favorite: g.is_favorite,
        nodes_count: countMap.get(g.id) || 0,
      }));
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      user_id: row.user_id,
      settings: row.settings || {},
      created_at: row.created_at,
      updated_at: row.updated_at,
      is_favorite: row.is_favorite,
      nodes_count: row.nodes_count || 0,
    }));
  }

  async getKnowledgePoints(userId: string, options?: QueryOptions): Promise<KnowledgePoint[]> {
    let query = this.client
      .from('knowledge_points')
      .select('*')
      .or(`owner_id.eq.${userId},visibility.eq.public`);

    if (options?.orderBy) {
      for (const order of options.orderBy) {
        query = query.order(order.field, { ascending: order.direction === 'asc' });
      }
    } else {
      query = query.order('updated_at', { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      title: row.title,
      content: row.content,
      learning_material: row.learning_material,
      properties: row.properties || {},
      visibility: row.visibility,
      owner_id: row.owner_id,
      embedding: row.embedding,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  async getKnowledgePoint(id: string): Promise<KnowledgePoint | null> {
    const { data, error } = await this.client
      .from('knowledge_points')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      title: data.title,
      content: data.content,
      learning_material: data.learning_material,
      properties: data.properties || {},
      visibility: data.visibility,
      owner_id: data.owner_id,
      embedding: data.embedding,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async createKnowledgePoint(data: CreateKnowledgePointInput): Promise<KnowledgePoint> {
    const { data: kp, error } = await this.client
      .from('knowledge_points')
      .insert({
        title: data.title,
        content: data.content || '',
        learning_material: data.learning_material || '',
        properties: data.properties || {},
        visibility: data.visibility || 'private',
        owner_id: data.owner_id,
        embedding: data.embedding,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: kp.id,
      title: kp.title,
      content: kp.content,
      learning_material: kp.learning_material,
      properties: kp.properties || {},
      visibility: kp.visibility,
      owner_id: kp.owner_id,
      embedding: kp.embedding,
      created_at: kp.created_at,
      updated_at: kp.updated_at,
    };
  }

  async updateKnowledgePoint(id: string, data: UpdateKnowledgePointInput): Promise<KnowledgePoint> {
    const updateData: Record<string, unknown> = { updated_at: now() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.learning_material !== undefined) updateData.learning_material = data.learning_material;
    if (data.properties !== undefined) updateData.properties = data.properties;
    if (data.visibility !== undefined) updateData.visibility = data.visibility;

    const { data: kp, error } = await this.client
      .from('knowledge_points')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: kp.id,
      title: kp.title,
      content: kp.content,
      learning_material: kp.learning_material,
      properties: kp.properties || {},
      visibility: kp.visibility,
      owner_id: kp.owner_id,
      embedding: kp.embedding,
      created_at: kp.created_at,
      updated_at: kp.updated_at,
    };
  }

  async deleteKnowledgePoint(id: string, userId: string): Promise<{
    success: boolean;
    affected_graphs: number;
    deleted_graph_nodes: number;
    deleted_edges: number;
    deleted_cards: number;
  }> {
    const { data, error } = await this.client.rpc('hard_delete_knowledge_point', {
      p_knowledge_point_id: id,
      p_user_id: userId,
    });

    if (error) throw error;

    return {
      success: data?.success ?? false,
      affected_graphs: data?.affected_graphs ?? 0,
      deleted_graph_nodes: data?.deleted_graph_nodes ?? 0,
      deleted_edges: data?.deleted_edges ?? 0,
      deleted_cards: data?.deleted_cards ?? 0,
    };
  }

  async getAccessibleKnowledgePoints(userId: string): Promise<KnowledgePoint[]> {
    const { data, error } = await this.client
      .from('knowledge_points')
      .select('*')
      .or(`owner_id.eq.${userId},visibility.eq.public`)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      title: row.title,
      content: row.content,
      learning_material: row.learning_material,
      properties: row.properties || {},
      visibility: row.visibility,
      owner_id: row.owner_id,
      embedding: row.embedding,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  async searchSimilarKnowledgePoints(
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
  }>> {
    const { data, error } = await this.client.rpc('search_similar_knowledge_points', {
      p_query_embedding: embedding,
      p_user_id: userId,
      p_match_threshold: threshold,
      p_match_count: limit,
    });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      similarity: row.similarity,
      visibility: row.visibility,
    }));
  }

  async getGraphNodes(graphId: string): Promise<GraphNode[]> {
    const { data, error } = await this.client
      .from('graph_nodes')
      .select('*')
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      graph_id: row.graph_id,
      knowledge_point_id: row.knowledge_point_id,
      x_position: row.x_position,
      y_position: row.y_position,
      level: row.level,
      is_accepted: row.is_accepted,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  async getGraphNode(id: string): Promise<GraphNode | null> {
    const { data, error } = await this.client
      .from('graph_nodes')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      graph_id: data.graph_id,
      knowledge_point_id: data.knowledge_point_id,
      x_position: data.x_position,
      y_position: data.y_position,
      level: data.level,
      is_accepted: data.is_accepted,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async createGraphNode(data: CreateGraphNodeInput): Promise<GraphNode> {
    const { data: node, error } = await this.client
      .from('graph_nodes')
      .insert({
        graph_id: data.graph_id,
        knowledge_point_id: data.knowledge_point_id,
        x_position: data.x_position,
        y_position: data.y_position,
        level: data.level,
        is_accepted: data.is_accepted ?? true,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: node.id,
      graph_id: node.graph_id,
      knowledge_point_id: node.knowledge_point_id,
      x_position: node.x_position,
      y_position: node.y_position,
      level: node.level,
      is_accepted: node.is_accepted,
      created_at: node.created_at,
      updated_at: node.updated_at,
    };
  }

  async updateGraphNode(id: string, data: UpdateGraphNodeInput): Promise<GraphNode> {
    const updateData: Record<string, unknown> = { updated_at: now() };
    if (data.x_position !== undefined) updateData.x_position = data.x_position;
    if (data.y_position !== undefined) updateData.y_position = data.y_position;
    if (data.level !== undefined) updateData.level = data.level;
    if (data.is_accepted !== undefined) updateData.is_accepted = data.is_accepted;

    const { data: node, error } = await this.client
      .from('graph_nodes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: node.id,
      graph_id: node.graph_id,
      knowledge_point_id: node.knowledge_point_id,
      x_position: node.x_position,
      y_position: node.y_position,
      level: node.level,
      is_accepted: node.is_accepted,
      created_at: node.created_at,
      updated_at: node.updated_at,
    };
  }

  async deleteGraphNode(id: string): Promise<void> {
    const { error } = await this.client
      .from('graph_nodes')
      .update({ deleted_at: now(), updated_at: now() })
      .eq('id', id);

    if (error) throw error;
  }

  async getEdges(graphId: string): Promise<Edge[]> {
    const { data, error } = await this.client
      .from('edges')
      .select('*')
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      graph_id: row.graph_id,
      source_knowledge_point_id: row.source_knowledge_point_id,
      target_knowledge_point_id: row.target_knowledge_point_id,
      relationship_type: row.relationship_type,
      weight: row.weight,
      custom_label: row.custom_label,
      custom_color: row.custom_color,
      custom_line_style: row.custom_line_style,
      show_arrow: row.show_arrow,
      created_at: row.created_at,
    }));
  }

  async getEdge(id: string): Promise<Edge | null> {
    const { data, error } = await this.client
      .from('edges')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      graph_id: data.graph_id,
      source_knowledge_point_id: data.source_knowledge_point_id,
      target_knowledge_point_id: data.target_knowledge_point_id,
      relationship_type: data.relationship_type,
      weight: data.weight,
      custom_label: data.custom_label,
      custom_color: data.custom_color,
      custom_line_style: data.custom_line_style,
      show_arrow: data.show_arrow,
      created_at: data.created_at,
    };
  }

  async createEdge(data: CreateEdgeInput): Promise<Edge> {
    const { data: edge, error } = await this.client
      .from('edges')
      .insert({
        graph_id: data.graph_id,
        source_knowledge_point_id: data.source_knowledge_point_id,
        target_knowledge_point_id: data.target_knowledge_point_id,
        relationship_type: data.relationship_type || 'related',
        weight: data.weight || 1,
        custom_label: data.custom_label,
        custom_color: data.custom_color,
        custom_line_style: data.custom_line_style || 'solid',
        show_arrow: data.show_arrow,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: edge.id,
      graph_id: edge.graph_id,
      source_knowledge_point_id: edge.source_knowledge_point_id,
      target_knowledge_point_id: edge.target_knowledge_point_id,
      relationship_type: edge.relationship_type,
      weight: edge.weight,
      custom_label: edge.custom_label,
      custom_color: edge.custom_color,
      custom_line_style: edge.custom_line_style,
      show_arrow: edge.show_arrow,
      created_at: edge.created_at,
    };
  }

  async updateEdge(id: string, data: UpdateEdgeInput): Promise<Edge> {
    const updateData: Record<string, unknown> = {};
    if (data.relationship_type !== undefined) updateData.relationship_type = data.relationship_type;
    if (data.weight !== undefined) updateData.weight = data.weight;
    if (data.custom_label !== undefined) updateData.custom_label = data.custom_label;
    if (data.custom_color !== undefined) updateData.custom_color = data.custom_color;
    if (data.custom_line_style !== undefined) updateData.custom_line_style = data.custom_line_style;
    if (data.show_arrow !== undefined) updateData.show_arrow = data.show_arrow;

    const { data: edge, error } = await this.client
      .from('edges')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: edge.id,
      graph_id: edge.graph_id,
      source_knowledge_point_id: edge.source_knowledge_point_id,
      target_knowledge_point_id: edge.target_knowledge_point_id,
      relationship_type: edge.relationship_type,
      weight: edge.weight,
      custom_label: edge.custom_label,
      custom_color: edge.custom_color,
      custom_line_style: edge.custom_line_style,
      show_arrow: edge.show_arrow,
      created_at: edge.created_at,
    };
  }

  async deleteEdge(id: string): Promise<void> {
    const { error } = await this.client
      .from('edges')
      .update({ deleted_at: now() })
      .eq('id', id);

    if (error) throw error;
  }

  async getScheduledTasks(userId: string, options?: QueryOptions): Promise<ScheduledTask[]> {
    let query = this.client
      .from('scheduled_tasks')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('queue_level', { ascending: true })
      .order('position', { ascending: true });

    if (options?.filters) {
      for (const filter of options.filters) {
        if (filter.operator === 'eq') {
          query = query.eq(filter.field, filter.value);
        }
      }
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      description: row.description,
      queue_level: row.queue_level,
      position: row.position,
      estimated_duration: row.estimated_duration,
      actual_duration: row.actual_duration,
      deadline: row.deadline,
      status: row.status,
      tags: row.tags || [],
      knowledge_point_id: row.knowledge_point_id,
      priority: row.priority,
      queue_id: row.queue_id,
      task_type: row.task_type,
      total_duration: row.total_duration,
      progress_mode: row.progress_mode,
      progress_percentage: row.progress_percentage,
      parent_task_id: row.parent_task_id,
      context: row.context,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      completed_at: row.completed_at,
    }));
  }

  async getScheduledTask(id: string): Promise<ScheduledTask | null> {
    const { data, error } = await this.client
      .from('scheduled_tasks')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      user_id: data.user_id,
      title: data.title,
      description: data.description,
      queue_level: data.queue_level,
      position: data.position,
      estimated_duration: data.estimated_duration,
      actual_duration: data.actual_duration,
      deadline: data.deadline,
      status: data.status,
      tags: data.tags || [],
      knowledge_point_id: data.knowledge_point_id,
      priority: data.priority,
      queue_id: data.queue_id,
      task_type: data.task_type,
      total_duration: data.total_duration,
      progress_mode: data.progress_mode,
      progress_percentage: data.progress_percentage,
      parent_task_id: data.parent_task_id,
      context: data.context,
      created_at: data.created_at,
      updated_at: data.updated_at,
      deleted_at: data.deleted_at,
      completed_at: data.completed_at,
    };
  }

  async createScheduledTask(data: CreateScheduledTaskInput): Promise<ScheduledTask> {
    const { data: maxPos } = await this.client
      .from('scheduled_tasks')
      .select('position')
      .eq('user_id', data.user_id)
      .eq('queue_level', data.queue_level || 0)
      .is('deleted_at', null)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const position = (maxPos?.position ?? -1) + 1;

    const { data: task, error } = await this.client
      .from('scheduled_tasks')
      .insert({
        user_id: data.user_id,
        title: data.title,
        description: data.description,
        queue_level: data.queue_level || 0,
        position,
        estimated_duration: data.estimated_duration,
        deadline: data.deadline,
        tags: data.tags || [],
        knowledge_point_id: data.knowledge_point_id,
        priority: data.priority || 0,
        task_type: data.task_type || 'one_time',
        total_duration: data.total_duration,
        progress_mode: data.progress_mode,
        parent_task_id: data.parent_task_id,
        context: data.context,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: task.id,
      user_id: task.user_id,
      title: task.title,
      description: task.description,
      queue_level: task.queue_level,
      position: task.position,
      estimated_duration: task.estimated_duration,
      actual_duration: task.actual_duration,
      deadline: task.deadline,
      status: task.status,
      tags: task.tags || [],
      knowledge_point_id: task.knowledge_point_id,
      priority: task.priority,
      queue_id: task.queue_id,
      task_type: task.task_type,
      total_duration: task.total_duration,
      progress_mode: task.progress_mode,
      progress_percentage: task.progress_percentage,
      parent_task_id: task.parent_task_id,
      context: task.context,
      created_at: task.created_at,
      updated_at: task.updated_at,
      deleted_at: task.deleted_at,
      completed_at: task.completed_at,
    };
  }

  async updateScheduledTask(id: string, data: UpdateScheduledTaskInput): Promise<ScheduledTask> {
    const updateData: Record<string, unknown> = { updated_at: now() };
    const fields: (keyof UpdateScheduledTaskInput)[] = [
      'title', 'description', 'queue_level', 'position', 'estimated_duration',
      'actual_duration', 'deadline', 'status', 'tags', 'priority', 'task_type',
      'total_duration', 'progress_mode', 'progress_percentage', 'parent_task_id',
      'context', 'scheduled_start', 'scheduled_end', 'notes'
    ];

    for (const field of fields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    const { data: task, error } = await this.client
      .from('scheduled_tasks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: task.id,
      user_id: task.user_id,
      title: task.title,
      description: task.description,
      queue_level: task.queue_level,
      position: task.position,
      estimated_duration: task.estimated_duration,
      actual_duration: task.actual_duration,
      deadline: task.deadline,
      status: task.status,
      tags: task.tags || [],
      knowledge_point_id: task.knowledge_point_id,
      priority: task.priority,
      queue_id: task.queue_id,
      task_type: task.task_type,
      total_duration: task.total_duration,
      progress_mode: task.progress_mode,
      progress_percentage: task.progress_percentage,
      parent_task_id: task.parent_task_id,
      context: task.context,
      created_at: task.created_at,
      updated_at: task.updated_at,
      deleted_at: task.deleted_at,
      completed_at: task.completed_at,
    };
  }

  async deleteScheduledTask(id: string, _userId: string): Promise<void> {
    const { error } = await this.client
      .from('scheduled_tasks')
      .update({ deleted_at: now(), updated_at: now() })
      .eq('id', id);

    if (error) throw error;
  }

  async getTasksByQueue(userId: string, queueLevel: number): Promise<ScheduledTask[]> {
    const { data, error } = await this.client
      .from('scheduled_tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('queue_level', queueLevel)
      .is('deleted_at', null)
      .order('position', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      description: row.description,
      queue_level: row.queue_level,
      position: row.position,
      estimated_duration: row.estimated_duration,
      actual_duration: row.actual_duration,
      deadline: row.deadline,
      status: row.status,
      tags: row.tags || [],
      knowledge_point_id: row.knowledge_point_id,
      priority: row.priority,
      queue_id: row.queue_id,
      task_type: row.task_type,
      total_duration: row.total_duration,
      progress_mode: row.progress_mode,
      progress_percentage: row.progress_percentage,
      parent_task_id: row.parent_task_id,
      context: row.context,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      completed_at: row.completed_at,
    }));
  }

  async reorderTasks(_userId: string, queueLevel: number, taskIds: string[]): Promise<void> {
    for (let i = 0; i < taskIds.length; i++) {
      const { error } = await this.client
        .from('scheduled_tasks')
        .update({ position: i, queue_level: queueLevel, updated_at: now() })
        .eq('id', taskIds[i]);

      if (error) throw error;
    }
  }

  async getTaskExecutions(taskId: string): Promise<TaskExecution[]> {
    const { data, error } = await this.client
      .from('task_executions')
      .select('*')
      .eq('task_id', taskId)
      .order('started_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      task_id: row.task_id,
      user_id: row.user_id,
      started_at: row.started_at,
      ended_at: row.ended_at,
      duration: row.duration,
      queue_level: row.queue_level,
      status: row.status,
    }));
  }

  async createTaskExecution(data: {
    task_id: string;
    user_id: string;
    started_at: string;
    queue_level: number;
    status: string;
  }): Promise<TaskExecution> {
    const { data: execution, error } = await this.client
      .from('task_executions')
      .insert({
        task_id: data.task_id,
        user_id: data.user_id,
        started_at: data.started_at,
        queue_level: data.queue_level,
        status: data.status,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: execution.id,
      task_id: execution.task_id,
      user_id: execution.user_id,
      started_at: execution.started_at,
      ended_at: execution.ended_at,
      duration: execution.duration,
      queue_level: execution.queue_level,
      status: execution.status,
    };
  }

  async updateTaskExecution(id: string, data: {
    ended_at?: string;
    duration?: number;
    status?: string;
  }): Promise<TaskExecution> {
    const updateData: Record<string, unknown> = {};
    if (data.ended_at !== undefined) updateData.ended_at = data.ended_at;
    if (data.duration !== undefined) updateData.duration = data.duration;
    if (data.status !== undefined) updateData.status = data.status;

    const { data: execution, error } = await this.client
      .from('task_executions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: execution.id,
      task_id: execution.task_id,
      user_id: execution.user_id,
      started_at: execution.started_at,
      ended_at: execution.ended_at,
      duration: execution.duration,
      queue_level: execution.queue_level,
      status: execution.status,
    };
  }

  async getTaskSettings(userId: string): Promise<TaskSettings | null> {
    const { data, error } = await this.client
      .from('task_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      user_id: data.user_id,
      q0_time_slice: data.q0_time_slice,
      q1_time_slice: data.q1_time_slice,
      q2_time_slice: data.q2_time_slice,
      break_duration: data.break_duration,
      sound_enabled: data.sound_enabled,
      notification_enabled: data.notification_enabled,
    };
  }

  async updateTaskSettings(userId: string, data: Partial<TaskSettings>): Promise<TaskSettings> {
    const existing = await this.getTaskSettings(userId);

    if (!existing) {
      const { data: settings, error } = await this.client
        .from('task_settings')
        .insert({
          user_id: userId,
          q0_time_slice: data.q0_time_slice || 25,
          q1_time_slice: data.q1_time_slice || 50,
          q2_time_slice: data.q2_time_slice || 100,
          break_duration: data.break_duration || 5,
          sound_enabled: data.sound_enabled ?? true,
          notification_enabled: data.notification_enabled ?? true,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: settings.id,
        user_id: settings.user_id,
        q0_time_slice: settings.q0_time_slice,
        q1_time_slice: settings.q1_time_slice,
        q2_time_slice: settings.q2_time_slice,
        break_duration: settings.break_duration,
        sound_enabled: settings.sound_enabled,
        notification_enabled: settings.notification_enabled,
      };
    }

    const updateData: Record<string, unknown> = {};
    const fields: (keyof Partial<TaskSettings>)[] = ['q0_time_slice', 'q1_time_slice', 'q2_time_slice', 'break_duration', 'sound_enabled', 'notification_enabled'];
    for (const field of fields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    const { data: settings, error } = await this.client
      .from('task_settings')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return {
      id: settings.id,
      user_id: settings.user_id,
      q0_time_slice: settings.q0_time_slice,
      q1_time_slice: settings.q1_time_slice,
      q2_time_slice: settings.q2_time_slice,
      break_duration: settings.break_duration,
      sound_enabled: settings.sound_enabled,
      notification_enabled: settings.notification_enabled,
    };
  }

  async getStudyCards(userId: string, options?: {
    graphId?: string;
    knowledgePointId?: string;
    dueOnly?: boolean;
  }): Promise<StudyCard[]> {
    let query = this.client
      .from('study_cards')
      .select('*')
      .eq('user_id', userId);

    if (options?.graphId) {
      query = query.eq('graph_id', options.graphId);
    }
    if (options?.knowledgePointId) {
      query = query.eq('knowledge_point_id', options.knowledgePointId);
    }
    if (options?.dueOnly) {
      query = query.lte('next_review', now());
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      knowledge_point_id: row.knowledge_point_id,
      user_id: row.user_id,
      graph_id: row.graph_id,
      source_graph_id: row.source_graph_id,
      question: row.question,
      answer: row.answer,
      explanation: row.explanation,
      card_type: row.card_type,
      options: row.options,
      difficulty: row.difficulty,
      last_reviewed: row.last_reviewed,
      next_review: row.next_review,
      review_count: row.review_count,
      fsrs_state: row.fsrs_state,
      fsrs_stability: row.fsrs_stability,
      fsrs_difficulty: row.fsrs_difficulty,
      fsrs_elapsed_days: row.fsrs_elapsed_days,
      fsrs_scheduled_days: row.fsrs_scheduled_days,
      fsrs_retrievability: row.fsrs_retrievability,
      fsrs_last_review: row.fsrs_last_review,
      created_at: row.created_at,
    }));
  }

  async getStudyCard(id: string): Promise<StudyCard | null> {
    const { data, error } = await this.client
      .from('study_cards')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      knowledge_point_id: data.knowledge_point_id,
      user_id: data.user_id,
      graph_id: data.graph_id,
      source_graph_id: data.source_graph_id,
      question: data.question,
      answer: data.answer,
      explanation: data.explanation,
      card_type: data.card_type,
      options: data.options,
      difficulty: data.difficulty,
      last_reviewed: data.last_reviewed,
      next_review: data.next_review,
      review_count: data.review_count,
      fsrs_state: data.fsrs_state,
      fsrs_stability: data.fsrs_stability,
      fsrs_difficulty: data.fsrs_difficulty,
      fsrs_elapsed_days: data.fsrs_elapsed_days,
      fsrs_scheduled_days: data.fsrs_scheduled_days,
      fsrs_retrievability: data.fsrs_retrievability,
      fsrs_last_review: data.fsrs_last_review,
      created_at: data.created_at,
    };
  }

  async createStudyCard(data: CreateStudyCardInput): Promise<StudyCard> {
    const { data: card, error } = await this.client
      .from('study_cards')
      .insert({
        user_id: data.user_id,
        knowledge_point_id: data.knowledge_point_id,
        graph_id: data.graph_id,
        source_graph_id: data.source_graph_id,
        question: data.question,
        answer: data.answer,
        explanation: data.explanation,
        card_type: data.card_type || 'qa',
        options: data.options,
        difficulty: data.difficulty || 1,
        next_review: now(),
        fsrs_state: 0,
        fsrs_stability: 0,
        fsrs_difficulty: 0,
        fsrs_elapsed_days: 0,
        fsrs_scheduled_days: 0,
        fsrs_retrievability: 0,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: card.id,
      knowledge_point_id: card.knowledge_point_id,
      user_id: card.user_id,
      graph_id: card.graph_id,
      source_graph_id: card.source_graph_id,
      question: card.question,
      answer: card.answer,
      explanation: card.explanation,
      card_type: card.card_type,
      options: card.options,
      difficulty: card.difficulty,
      last_reviewed: card.last_reviewed,
      next_review: card.next_review,
      review_count: card.review_count,
      fsrs_state: card.fsrs_state,
      fsrs_stability: card.fsrs_stability,
      fsrs_difficulty: card.fsrs_difficulty,
      fsrs_elapsed_days: card.fsrs_elapsed_days,
      fsrs_scheduled_days: card.fsrs_scheduled_days,
      fsrs_retrievability: card.fsrs_retrievability,
      fsrs_last_review: card.fsrs_last_review,
      created_at: card.created_at,
    };
  }

  async createStudyCardsBatch(data: CreateStudyCardInput[]): Promise<StudyCard[]> {
    const cardsToInsert = data.map(item => ({
      user_id: item.user_id,
      knowledge_point_id: item.knowledge_point_id,
      graph_id: item.graph_id,
      source_graph_id: item.source_graph_id,
      question: item.question,
      answer: item.answer,
      explanation: item.explanation,
      card_type: item.card_type || 'qa',
      options: item.options,
      difficulty: item.difficulty || 1,
      next_review: now(),
      fsrs_state: 0,
      fsrs_stability: 0,
      fsrs_difficulty: 0,
      fsrs_elapsed_days: 0,
      fsrs_scheduled_days: 0,
      fsrs_retrievability: 0,
    }));

    const { data: cards, error } = await this.client
      .from('study_cards')
      .insert(cardsToInsert)
      .select();

    if (error) throw error;

    return (cards || []).map(row => ({
      id: row.id,
      knowledge_point_id: row.knowledge_point_id,
      user_id: row.user_id,
      graph_id: row.graph_id,
      source_graph_id: row.source_graph_id,
      question: row.question,
      answer: row.answer,
      explanation: row.explanation,
      card_type: row.card_type,
      options: row.options,
      difficulty: row.difficulty,
      last_reviewed: row.last_reviewed,
      next_review: row.next_review,
      review_count: row.review_count,
      fsrs_state: row.fsrs_state,
      fsrs_stability: row.fsrs_stability,
      fsrs_difficulty: row.fsrs_difficulty,
      fsrs_elapsed_days: row.fsrs_elapsed_days,
      fsrs_scheduled_days: row.fsrs_scheduled_days,
      fsrs_retrievability: row.fsrs_retrievability,
      fsrs_last_review: row.fsrs_last_review,
      created_at: row.created_at,
    }));
  }

  async updateStudyCard(id: string, data: UpdateStudyCardInput): Promise<StudyCard> {
    const updateData: Record<string, unknown> = {};
    const fields: (keyof UpdateStudyCardInput)[] = [
      'question', 'answer', 'explanation', 'card_type', 'options', 'difficulty',
      'last_reviewed', 'next_review', 'review_count', 'fsrs_state', 'fsrs_stability',
      'fsrs_difficulty', 'fsrs_elapsed_days', 'fsrs_scheduled_days', 'fsrs_retrievability', 'fsrs_last_review'
    ];

    for (const field of fields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    const { data: card, error } = await this.client
      .from('study_cards')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: card.id,
      knowledge_point_id: card.knowledge_point_id,
      user_id: card.user_id,
      graph_id: card.graph_id,
      source_graph_id: card.source_graph_id,
      question: card.question,
      answer: card.answer,
      explanation: card.explanation,
      card_type: card.card_type,
      options: card.options,
      difficulty: card.difficulty,
      last_reviewed: card.last_reviewed,
      next_review: card.next_review,
      review_count: card.review_count,
      fsrs_state: card.fsrs_state,
      fsrs_stability: card.fsrs_stability,
      fsrs_difficulty: card.fsrs_difficulty,
      fsrs_elapsed_days: card.fsrs_elapsed_days,
      fsrs_scheduled_days: card.fsrs_scheduled_days,
      fsrs_retrievability: card.fsrs_retrievability,
      fsrs_last_review: card.fsrs_last_review,
      created_at: card.created_at,
    };
  }

  async deleteStudyCard(id: string): Promise<void> {
    const { error } = await this.client
      .from('study_cards')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async deleteStudyCardsBatch(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await this.client
      .from('study_cards')
      .delete()
      .in('id', ids);

    if (error) throw error;
  }

  async getFocusSessions(userId: string, options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<FocusSession[]> {
    let query = this.client
      .from('focus_sessions')
      .select('*')
      .eq('user_id', userId);

    if (options?.startDate) {
      query = query.gte('start_time', options.startDate);
    }
    if (options?.endDate) {
      query = query.lte('start_time', options.endDate);
    }

    query = query.order('start_time', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      user_id: row.user_id,
      task_id: row.task_id,
      started_at: row.start_time,
      ended_at: row.end_time,
      duration: row.duration,
      pomodoro_count: row.pomodoro_count,
      white_noise_type: row.white_noise_type,
      is_break: row.is_break,
      created_at: row.created_at,
    }));
  }

  async createFocusSession(data: CreateFocusSessionInput): Promise<FocusSession> {
    const { data: session, error } = await this.client
      .from('focus_sessions')
      .insert({
        user_id: data.user_id,
        task_id: data.task_id,
        start_time: data.start_time,
        end_time: data.end_time || data.start_time,
        duration: data.duration,
        mode: data.mode,
        pomodoro_count: data.pomodoro_count || 0,
        white_noise_type: data.white_noise_type,
        is_break: data.is_break || false,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: session.id,
      user_id: session.user_id,
      task_id: session.task_id,
      started_at: session.start_time,
      ended_at: session.end_time,
      duration: session.duration,
      pomodoro_count: session.pomodoro_count,
      white_noise_type: session.white_noise_type,
      is_break: session.is_break,
      created_at: session.created_at,
    };
  }

  async getUserFocusStats(userId: string): Promise<UserFocusStats | null> {
    const { data, error } = await this.client
      .from('user_focus_stats')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      user_id: data.user_id,
      total_focus_seconds: data.total_focus_seconds,
      total_sessions: data.total_sessions,
      total_pomodoros: data.total_pomodoros,
      total_tasks_completed: data.total_tasks_completed,
      current_streak: data.current_streak,
      longest_streak: data.longest_streak,
      last_focus_date: data.last_focus_date,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async updateUserFocusStats(userId: string, data: Partial<UserFocusStats>): Promise<UserFocusStats> {
    const existing = await this.getUserFocusStats(userId);

    if (!existing) {
      const { data: stats, error } = await this.client
        .from('user_focus_stats')
        .insert({
          user_id: userId,
          total_focus_seconds: data.total_focus_seconds || 0,
          total_sessions: data.total_sessions || 0,
          total_pomodoros: data.total_pomodoros || 0,
          total_tasks_completed: data.total_tasks_completed || 0,
          current_streak: data.current_streak || 0,
          longest_streak: data.longest_streak || 0,
          last_focus_date: data.last_focus_date,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: stats.id,
        user_id: stats.user_id,
        total_focus_seconds: stats.total_focus_seconds,
        total_sessions: stats.total_sessions,
        total_pomodoros: stats.total_pomodoros,
        total_tasks_completed: stats.total_tasks_completed,
        current_streak: stats.current_streak,
        longest_streak: stats.longest_streak,
        last_focus_date: stats.last_focus_date,
        created_at: stats.created_at,
        updated_at: stats.updated_at,
      };
    }

    const updateData: Record<string, unknown> = { updated_at: now() };
    const fields: (keyof Partial<UserFocusStats>)[] = ['total_focus_seconds', 'total_sessions', 'total_pomodoros', 'total_tasks_completed', 'current_streak', 'longest_streak', 'last_focus_date'];
    for (const field of fields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    const { data: stats, error } = await this.client
      .from('user_focus_stats')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return {
      id: stats.id,
      user_id: stats.user_id,
      total_focus_seconds: stats.total_focus_seconds,
      total_sessions: stats.total_sessions,
      total_pomodoros: stats.total_pomodoros,
      total_tasks_completed: stats.total_tasks_completed,
      current_streak: stats.current_streak,
      longest_streak: stats.longest_streak,
      last_focus_date: stats.last_focus_date,
      created_at: stats.created_at,
      updated_at: stats.updated_at,
    };
  }

  async getAchievements(): Promise<Achievement[]> {
    const { data, error } = await this.client
      .from('achievements')
      .select('*');

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      category: row.category,
      icon: row.icon,
      color: row.color,
      xp_reward: row.xp_reward,
      condition_type: row.condition_type,
      condition_value: row.condition_value,
      is_hidden: row.is_hidden,
      created_at: row.created_at,
    }));
  }

  async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    const { data, error } = await this.client
      .from('user_achievements')
      .select('*, achievement:achievements(*)')
      .eq('user_id', userId);

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      user_id: row.user_id,
      achievement_id: row.achievement_id,
      achievement: row.achievement,
      unlocked_at: row.unlocked_at,
      progress: row.progress,
      metadata: row.metadata || {},
    }));
  }

  async unlockAchievement(userId: string, achievementId: string): Promise<UserAchievement> {
    const { data, error } = await this.client
      .from('user_achievements')
      .insert({
        user_id: userId,
        achievement_id: achievementId,
        progress: 100,
        metadata: {},
      })
      .select('*, achievement:achievements(*)')
      .single();

    if (error) throw error;

    return {
      id: data.id,
      user_id: data.user_id,
      achievement_id: data.achievement_id,
      achievement: data.achievement,
      unlocked_at: data.unlocked_at,
      progress: data.progress,
      metadata: data.metadata || {},
    };
  }

  async getTemplates(userId: string, options?: { isSystem?: boolean }): Promise<Template[]> {
    let query = this.client
      .from('templates')
      .select('*');

    if (options?.isSystem) {
      query = query.eq('is_system', true);
    } else {
      query = query.or(`user_id.eq.${userId},is_system.eq.true`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      is_system: row.is_system,
      user_id: row.user_id,
      nodes: row.nodes || [],
      edges: row.edges || [],
      layout: row.layout,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  async getTemplate(id: string): Promise<Template | null> {
    const { data, error } = await this.client
      .from('templates')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      category: data.category,
      is_system: data.is_system,
      user_id: data.user_id,
      nodes: data.nodes || [],
      edges: data.edges || [],
      layout: data.layout,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async createTemplate(data: Omit<Template, 'id' | 'created_at' | 'updated_at'>): Promise<Template> {
    const { data: template, error } = await this.client
      .from('templates')
      .insert({
        user_id: data.user_id,
        name: data.name,
        description: data.description,
        category: data.category,
        is_system: data.is_system,
        nodes: data.nodes,
        edges: data.edges,
        layout: data.layout,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      is_system: template.is_system,
      user_id: template.user_id,
      nodes: template.nodes || [],
      edges: template.edges || [],
      layout: template.layout,
      created_at: template.created_at,
      updated_at: template.updated_at,
    };
  }

  async updateTemplate(id: string, data: Partial<Template>): Promise<Template> {
    const updateData: Record<string, unknown> = { updated_at: now() };
    const fields: (keyof Partial<Template>)[] = ['name', 'description', 'category', 'nodes', 'edges', 'layout'];
    for (const field of fields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    const { data: template, error } = await this.client
      .from('templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      is_system: template.is_system,
      user_id: template.user_id,
      nodes: template.nodes || [],
      edges: template.edges || [],
      layout: template.layout,
      created_at: template.created_at,
      updated_at: template.updated_at,
    };
  }

  async deleteTemplate(id: string): Promise<void> {
    const { error } = await this.client
      .from('templates')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getRelationshipTypes(userId?: string): Promise<RelationshipTypeConfig[]> {
    let query = this.client
      .from('relationship_types')
      .select('*');

    if (userId) {
      query = query.or(`is_builtin.eq.true,user_id.eq.${userId}`);
    } else {
      query = query.eq('is_builtin', true);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      name: row.name,
      display_name: row.display_name,
      category: row.category,
      color: row.color,
      line_style: row.line_style,
      show_arrow: row.show_arrow,
      is_builtin: row.is_builtin,
      user_id: row.user_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  async createRelationshipType(data: Omit<RelationshipTypeConfig, 'id' | 'created_at' | 'updated_at'>): Promise<RelationshipTypeConfig> {
    const { data: relType, error } = await this.client
      .from('relationship_types')
      .insert({
        name: data.name,
        display_name: data.display_name,
        category: data.category,
        color: data.color,
        line_style: data.line_style,
        show_arrow: data.show_arrow,
        is_builtin: data.is_builtin,
        user_id: data.user_id,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: relType.id,
      name: relType.name,
      display_name: relType.display_name,
      category: relType.category,
      color: relType.color,
      line_style: relType.line_style,
      show_arrow: relType.show_arrow,
      is_builtin: relType.is_builtin,
      user_id: relType.user_id,
      created_at: relType.created_at,
      updated_at: relType.updated_at,
    };
  }

  async updateRelationshipType(id: string, data: Partial<RelationshipTypeConfig>): Promise<RelationshipTypeConfig> {
    const updateData: Record<string, unknown> = { updated_at: now() };
    const fields: (keyof Partial<RelationshipTypeConfig>)[] = ['name', 'display_name', 'category', 'color', 'line_style', 'show_arrow'];
    for (const field of fields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    const { data: relType, error } = await this.client
      .from('relationship_types')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: relType.id,
      name: relType.name,
      display_name: relType.display_name,
      category: relType.category,
      color: relType.color,
      line_style: relType.line_style,
      show_arrow: relType.show_arrow,
      is_builtin: relType.is_builtin,
      user_id: relType.user_id,
      created_at: relType.created_at,
      updated_at: relType.updated_at,
    };
  }

  async deleteRelationshipType(id: string): Promise<void> {
    const { error } = await this.client
      .from('relationship_types')
      .delete()
      .eq('id', id)
      .eq('is_builtin', false);

    if (error) throw error;
  }

  async getGraphRelations(graphId: string): Promise<GraphRelation[]> {
    const { data, error } = await this.client
      .from('graph_relations')
      .select('*')
      .or(`source_graph_id.eq.${graphId},target_graph_id.eq.${graphId}`);

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      source_graph_id: row.source_graph_id,
      target_graph_id: row.target_graph_id,
      relation_type: row.relation_type,
      context: row.context,
      metadata: row.metadata || {},
      created_at: row.created_at,
    }));
  }

  async createGraphRelation(data: {
    source_graph_id: string;
    target_graph_id: string;
    relation_type: string;
    context?: string;
    metadata?: Record<string, unknown>;
  }): Promise<GraphRelation> {
    const { data: relation, error } = await this.client
      .from('graph_relations')
      .insert({
        source_graph_id: data.source_graph_id,
        target_graph_id: data.target_graph_id,
        relation_type: data.relation_type,
        context: data.context,
        metadata: data.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: relation.id,
      source_graph_id: relation.source_graph_id,
      target_graph_id: relation.target_graph_id,
      relation_type: relation.relation_type,
      context: relation.context,
      metadata: relation.metadata || {},
      created_at: relation.created_at,
    };
  }

  async deleteGraphRelation(id: string): Promise<void> {
    const { error } = await this.client
      .from('graph_relations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getGraphCollaborators(graphId: string): Promise<GraphCollaborator[]> {
    const { data, error } = await this.client
      .from('graph_collaborators')
      .select('*, user:users(id, email, name)')
      .eq('graph_id', graphId);

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      graph_id: row.graph_id,
      user_id: row.user_id,
      role: row.role,
      invited_by: row.invited_by,
      invitation_token: row.invitation_token,
      invited_at: row.invited_at,
      accepted_at: row.accepted_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user: row.user,
    }));
  }

  async addGraphCollaborator(data: {
    graph_id: string;
    user_id: string;
    role: CollaboratorRole;
    invited_by?: string;
  }): Promise<GraphCollaborator> {
    const { data: collaborator, error } = await this.client
      .from('graph_collaborators')
      .insert({
        graph_id: data.graph_id,
        user_id: data.user_id,
        role: data.role,
        invited_by: data.invited_by,
      })
      .select('*, user:users(id, email, name)')
      .single();

    if (error) throw error;

    return {
      id: collaborator.id,
      graph_id: collaborator.graph_id,
      user_id: collaborator.user_id,
      role: collaborator.role,
      invited_by: collaborator.invited_by,
      invitation_token: collaborator.invitation_token,
      invited_at: collaborator.invited_at,
      accepted_at: collaborator.accepted_at,
      created_at: collaborator.created_at,
      updated_at: collaborator.updated_at,
      user: collaborator.user,
    };
  }

  async updateGraphCollaborator(id: string, data: { role: CollaboratorRole }): Promise<GraphCollaborator> {
    const { data: collaborator, error } = await this.client
      .from('graph_collaborators')
      .update({ role: data.role, updated_at: now() })
      .eq('id', id)
      .select('*, user:users(id, email, name)')
      .single();

    if (error) throw error;

    return {
      id: collaborator.id,
      graph_id: collaborator.graph_id,
      user_id: collaborator.user_id,
      role: collaborator.role,
      invited_by: collaborator.invited_by,
      invitation_token: collaborator.invitation_token,
      invited_at: collaborator.invited_at,
      accepted_at: collaborator.accepted_at,
      created_at: collaborator.created_at,
      updated_at: collaborator.updated_at,
      user: collaborator.user,
    };
  }

  async removeGraphCollaborator(id: string): Promise<void> {
    const { error } = await this.client
      .from('graph_collaborators')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getQueues(userId: string): Promise<Queue[]> {
    const { data, error } = await this.client
      .from('queues')
      .select('*')
      .eq('user_id', userId)
      .order('priority', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      color: row.color,
      time_slice: row.time_slice,
      priority: row.priority,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  async createQueue(data: {
    user_id: string;
    name: string;
    color: string;
    time_slice: number;
    priority: number;
  }): Promise<Queue> {
    const { data: queue, error } = await this.client
      .from('queues')
      .insert({
        user_id: data.user_id,
        name: data.name,
        color: data.color,
        time_slice: data.time_slice,
        priority: data.priority,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: queue.id,
      user_id: queue.user_id,
      name: queue.name,
      color: queue.color,
      time_slice: queue.time_slice,
      priority: queue.priority,
      created_at: queue.created_at,
      updated_at: queue.updated_at,
    };
  }

  async updateQueue(id: string, data: Partial<Queue>): Promise<Queue> {
    const updateData: Record<string, unknown> = { updated_at: now() };
    const fields: (keyof Partial<Queue>)[] = ['name', 'color', 'time_slice', 'priority'];
    for (const field of fields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    const { data: queue, error } = await this.client
      .from('queues')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: queue.id,
      user_id: queue.user_id,
      name: queue.name,
      color: queue.color,
      time_slice: queue.time_slice,
      priority: queue.priority,
      created_at: queue.created_at,
      updated_at: queue.updated_at,
    };
  }

  async deleteQueue(id: string): Promise<void> {
    const { error } = await this.client
      .from('queues')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getQuizSets(userId: string): Promise<QuizSet[]> {
    const { data, error } = await this.client
      .from('quiz_sets')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      user_id: row.user_id,
      graph_id: row.graph_id,
      title: row.title,
      description: row.description,
      config: row.config || {},
      status: row.status,
      card_count: row.card_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  async getQuizSet(id: string): Promise<QuizSet | null> {
    const { data, error } = await this.client
      .from('quiz_sets')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      user_id: data.user_id,
      graph_id: data.graph_id,
      title: data.title,
      description: data.description,
      config: data.config || {},
      status: data.status,
      card_count: data.card_count,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async createQuizSet(data: {
    user_id: string;
    title: string;
    description?: string;
    graph_id?: string;
    config: Record<string, unknown>;
  }): Promise<QuizSet> {
    const { data: quizSet, error } = await this.client
      .from('quiz_sets')
      .insert({
        user_id: data.user_id,
        title: data.title,
        description: data.description,
        graph_id: data.graph_id,
        config: data.config,
        status: 'draft',
        card_count: 0,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: quizSet.id,
      user_id: quizSet.user_id,
      graph_id: quizSet.graph_id,
      title: quizSet.title,
      description: quizSet.description,
      config: quizSet.config || {},
      status: quizSet.status,
      card_count: quizSet.card_count,
      created_at: quizSet.created_at,
      updated_at: quizSet.updated_at,
    };
  }

  async updateQuizSet(id: string, data: Partial<QuizSet>): Promise<QuizSet> {
    const updateData: Record<string, unknown> = { updated_at: now() };
    const fields: (keyof Partial<QuizSet>)[] = ['title', 'description', 'config', 'status', 'card_count'];
    for (const field of fields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    const { data: quizSet, error } = await this.client
      .from('quiz_sets')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: quizSet.id,
      user_id: quizSet.user_id,
      graph_id: quizSet.graph_id,
      title: quizSet.title,
      description: quizSet.description,
      config: quizSet.config || {},
      status: quizSet.status,
      card_count: quizSet.card_count,
      created_at: quizSet.created_at,
      updated_at: quizSet.updated_at,
    };
  }

  async deleteQuizSet(id: string): Promise<void> {
    const { error } = await this.client
      .from('quiz_sets')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getLearningPaths(userId: string): Promise<LearningPath[]> {
    const { data, error } = await this.client
      .from('learning_paths')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      description: row.description,
      goal_type: 'natural_language',
      goal_content: row.goal,
      target_knowledge_point_id: undefined,
      template_id: undefined,
      status: row.status,
      total_nodes: 0,
      completed_nodes: 0,
      progress_percentage: 0,
      estimated_hours: row.total_estimated_time ? Math.floor(row.total_estimated_time / 60) : undefined,
      daily_minutes_target: row.daily_minutes_target,
      target_completion_date: row.target_date,
      settings: undefined,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  async getLearningPath(id: string): Promise<LearningPath | null> {
    const { data, error } = await this.client
      .from('learning_paths')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      user_id: data.user_id,
      title: data.title,
      description: data.description,
      goal_type: 'natural_language',
      goal_content: data.goal,
      target_knowledge_point_id: undefined,
      template_id: undefined,
      status: data.status,
      total_nodes: 0,
      completed_nodes: 0,
      progress_percentage: 0,
      estimated_hours: data.total_estimated_time ? Math.floor(data.total_estimated_time / 60) : undefined,
      daily_minutes_target: data.daily_minutes_target,
      target_completion_date: data.target_date,
      settings: undefined,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async createLearningPath(data: {
    user_id: string;
    title: string;
    description?: string;
    goal?: string;
    target_date?: string;
    source_graph_id?: string;
    daily_minutes_target?: number;
  }): Promise<LearningPath> {
    const { data: path, error } = await this.client
      .from('learning_paths')
      .insert({
        user_id: data.user_id,
        title: data.title,
        description: data.description,
        goal: data.goal,
        target_date: data.target_date,
        source_graph_id: data.source_graph_id,
        daily_minutes_target: data.daily_minutes_target || 30,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: path.id,
      user_id: path.user_id,
      title: path.title,
      description: path.description,
      goal_type: 'natural_language',
      goal_content: path.goal,
      target_knowledge_point_id: undefined,
      template_id: undefined,
      status: path.status,
      total_nodes: 0,
      completed_nodes: 0,
      progress_percentage: 0,
      estimated_hours: path.total_estimated_time ? Math.floor(path.total_estimated_time / 60) : undefined,
      daily_minutes_target: path.daily_minutes_target,
      target_completion_date: path.target_date,
      settings: undefined,
      created_at: path.created_at,
      updated_at: path.updated_at,
    };
  }

  async updateLearningPath(id: string, data: Partial<LearningPath>): Promise<LearningPath> {
    const updateData: Record<string, unknown> = { updated_at: now() };
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.goal_content !== undefined) updateData.goal = data.goal_content;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.daily_minutes_target !== undefined) updateData.daily_minutes_target = data.daily_minutes_target;

    const { data: path, error } = await this.client
      .from('learning_paths')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: path.id,
      user_id: path.user_id,
      title: path.title,
      description: path.description,
      goal_type: 'natural_language',
      goal_content: path.goal,
      target_knowledge_point_id: undefined,
      template_id: undefined,
      status: path.status,
      total_nodes: 0,
      completed_nodes: 0,
      progress_percentage: 0,
      estimated_hours: path.total_estimated_time ? Math.floor(path.total_estimated_time / 60) : undefined,
      daily_minutes_target: path.daily_minutes_target,
      target_completion_date: path.target_date,
      settings: undefined,
      created_at: path.created_at,
      updated_at: path.updated_at,
    };
  }

  async deleteLearningPath(id: string): Promise<void> {
    const { error } = await this.client
      .from('learning_paths')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getLearningPathNodes(pathId: string): Promise<LearningPathNodeRef[]> {
    const { data, error } = await this.client
      .from('learning_path_nodes')
      .select('*')
      .eq('path_id', pathId)
      .order('order_index', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      path_id: row.path_id,
      node_id: row.knowledge_point_id || row.id,
      status: row.status,
      user_notes: row.description,
      estimated_minutes: row.estimated_time,
      difficulty_level: 1,
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  async createLearningPathNode(data: {
    path_id: string;
    knowledge_point_id?: string;
    order_index: number;
    title: string;
    description?: string;
    estimated_time?: number;
  }): Promise<LearningPathNodeRef> {
    const { data: node, error } = await this.client
      .from('learning_path_nodes')
      .insert({
        path_id: data.path_id,
        knowledge_point_id: data.knowledge_point_id,
        order_index: data.order_index,
        title: data.title,
        description: data.description,
        estimated_time: data.estimated_time || 30,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: node.id,
      path_id: node.path_id,
      node_id: node.knowledge_point_id || node.id,
      status: node.status,
      user_notes: node.description,
      estimated_minutes: node.estimated_time,
      difficulty_level: 1,
      completed_at: node.completed_at,
      created_at: node.created_at,
      updated_at: node.updated_at,
    };
  }

  async updateLearningPathNode(id: string, data: Partial<LearningPathNodeRef>): Promise<LearningPathNodeRef> {
    const updateData: Record<string, unknown> = { updated_at: now() };
    if (data.status !== undefined) updateData.status = data.status;
    if (data.user_notes !== undefined) updateData.description = data.user_notes;
    if (data.estimated_minutes !== undefined) updateData.estimated_time = data.estimated_minutes;
    if (data.completed_at !== undefined) updateData.completed_at = data.completed_at;

    const { data: node, error } = await this.client
      .from('learning_path_nodes')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: node.id,
      path_id: node.path_id,
      node_id: node.knowledge_point_id || node.id,
      status: node.status,
      user_notes: node.description,
      estimated_minutes: node.estimated_time,
      difficulty_level: 1,
      completed_at: node.completed_at,
      created_at: node.created_at,
      updated_at: node.updated_at,
    };
  }

  async deleteLearningPathNode(id: string): Promise<void> {
    const { error } = await this.client
      .from('learning_path_nodes')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getNotifications(userId: string, options?: { unreadOnly?: boolean }): Promise<Notification[]> {
    let query = this.client
      .from('notifications')
      .select('*')
      .eq('user_id', userId);

    if (options?.unreadOnly) {
      query = query.is('read_at', null);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      user_id: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      data: row.data || {},
      read_at: row.read_at,
      created_at: row.created_at,
      expires_at: row.expires_at,
    }));
  }

  async createNotification(data: {
    user_id: string;
    type: string;
    title: string;
    message?: string;
    data?: Record<string, unknown>;
    expires_at?: string;
  }): Promise<Notification> {
    const { data: notification, error } = await this.client
      .from('notifications')
      .insert({
        user_id: data.user_id,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data || {},
        expires_at: data.expires_at,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: notification.id,
      user_id: notification.user_id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data || {},
      expires_at: notification.expires_at,
      created_at: notification.created_at,
    };
  }

  async markNotificationRead(id: string): Promise<void> {
    const { error } = await this.client
      .from('notifications')
      .update({ read_at: now() })
      .eq('id', id);

    if (error) throw error;
  }

  async deleteNotification(id: string): Promise<void> {
    const { error } = await this.client
      .from('notifications')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async getNotificationSettings(userId: string): Promise<NotificationSettings | null> {
    const { data, error } = await this.client
      .from('notification_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      user_id: data.user_id,
      browser_enabled: data.browser_enabled,
      sound_enabled: data.sound_enabled,
      sound_volume: data.sound_volume,
      task_start_enabled: data.task_start_enabled,
      task_complete_enabled: data.task_complete_enabled,
      time_slice_end_enabled: data.time_slice_end_enabled,
      deadline_enabled: data.deadline_enabled,
      break_enabled: data.break_enabled,
      daily_summary_enabled: data.daily_summary_enabled,
      deadline_reminder_minutes: data.deadline_reminder_minutes || [30, 60],
      do_not_disturb_enabled: data.do_not_disturb_enabled,
      do_not_disturb_start: data.do_not_disturb_start,
      do_not_disturb_end: data.do_not_disturb_end,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async updateNotificationSettings(userId: string, data: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const existing = await this.getNotificationSettings(userId);

    if (!existing) {
      const { data: settings, error } = await this.client
        .from('notification_settings')
        .insert({
          user_id: userId,
          browser_enabled: data.browser_enabled ?? true,
          sound_enabled: data.sound_enabled ?? true,
          sound_volume: data.sound_volume || 50,
          task_start_enabled: data.task_start_enabled ?? true,
          task_complete_enabled: data.task_complete_enabled ?? true,
          time_slice_end_enabled: data.time_slice_end_enabled ?? false,
          deadline_enabled: data.deadline_enabled ?? true,
          break_enabled: data.break_enabled ?? true,
          daily_summary_enabled: data.daily_summary_enabled ?? false,
          deadline_reminder_minutes: data.deadline_reminder_minutes || [30, 60],
          do_not_disturb_enabled: data.do_not_disturb_enabled ?? false,
          do_not_disturb_start: data.do_not_disturb_start || '22:00',
          do_not_disturb_end: data.do_not_disturb_end || '08:00',
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: settings.id,
        user_id: settings.user_id,
        browser_enabled: settings.browser_enabled,
        sound_enabled: settings.sound_enabled,
        sound_volume: settings.sound_volume,
        task_start_enabled: settings.task_start_enabled,
        task_complete_enabled: settings.task_complete_enabled,
        time_slice_end_enabled: settings.time_slice_end_enabled,
        deadline_enabled: settings.deadline_enabled,
        break_enabled: settings.break_enabled,
        daily_summary_enabled: settings.daily_summary_enabled,
        deadline_reminder_minutes: settings.deadline_reminder_minutes || [30, 60],
        do_not_disturb_enabled: settings.do_not_disturb_enabled,
        do_not_disturb_start: settings.do_not_disturb_start,
        do_not_disturb_end: settings.do_not_disturb_end,
        created_at: settings.created_at,
        updated_at: settings.updated_at,
      };
    }

    const updateData: Record<string, unknown> = { updated_at: now() };
    const fields: (keyof Partial<NotificationSettings>)[] = [
      'browser_enabled', 'sound_enabled', 'sound_volume', 'task_start_enabled',
      'task_complete_enabled', 'time_slice_end_enabled', 'deadline_enabled',
      'break_enabled', 'daily_summary_enabled', 'deadline_reminder_minutes',
      'do_not_disturb_enabled', 'do_not_disturb_start', 'do_not_disturb_end'
    ];
    for (const field of fields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    const { data: settings, error } = await this.client
      .from('notification_settings')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    return {
      id: settings.id,
      user_id: settings.user_id,
      browser_enabled: settings.browser_enabled,
      sound_enabled: settings.sound_enabled,
      sound_volume: settings.sound_volume,
      task_start_enabled: settings.task_start_enabled,
      task_complete_enabled: settings.task_complete_enabled,
      time_slice_end_enabled: settings.time_slice_end_enabled,
      deadline_enabled: settings.deadline_enabled,
      break_enabled: settings.break_enabled,
      daily_summary_enabled: settings.daily_summary_enabled,
      deadline_reminder_minutes: settings.deadline_reminder_minutes || [30, 60],
      do_not_disturb_enabled: settings.do_not_disturb_enabled,
      do_not_disturb_start: settings.do_not_disturb_start,
      do_not_disturb_end: settings.do_not_disturb_end,
      created_at: settings.created_at,
      updated_at: settings.updated_at,
    };
  }

  async getAsyncTasks(userId: string, options?: { status?: string }): Promise<Task[]> {
    let query = this.client
      .from('scheduled_tasks')
      .select('*')
      .eq('user_id', userId);

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      description: row.description,
      queue_id: row.queue_id,
      queue_level: row.queue_level,
      position: row.position,
      estimated_duration: row.estimated_duration,
      actual_duration: row.actual_duration,
      deadline: row.deadline,
      status: row.status,
      tags: row.tags,
      knowledge_point_id: row.knowledge_point_id,
      priority: row.priority,
      task_type: row.task_type,
      total_duration: row.total_duration,
      progress_mode: row.progress_mode,
      progress_percentage: row.progress_percentage,
      parent_task_id: row.parent_task_id,
      context: row.context,
      scheduled_start: row.scheduled_start,
      scheduled_end: row.scheduled_end,
      notes: row.notes,
      completed_at: row.completed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    }));
  }

  async getAsyncTask(id: string): Promise<Task | null> {
    const { data, error } = await this.client
      .from('scheduled_tasks')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      user_id: data.user_id,
      title: data.title,
      description: data.description,
      queue_id: data.queue_id,
      queue_level: data.queue_level,
      position: data.position,
      estimated_duration: data.estimated_duration,
      actual_duration: data.actual_duration,
      deadline: data.deadline,
      status: data.status,
      tags: data.tags,
      knowledge_point_id: data.knowledge_point_id,
      priority: data.priority,
      task_type: data.task_type,
      total_duration: data.total_duration,
      progress_mode: data.progress_mode,
      progress_percentage: data.progress_percentage,
      parent_task_id: data.parent_task_id,
      context: data.context,
      scheduled_start: data.scheduled_start,
      scheduled_end: data.scheduled_end,
      notes: data.notes,
      completed_at: data.completed_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
      deleted_at: data.deleted_at,
    };
  }

  async createAsyncTask(data: {
    user_id: string;
    task_type: string;
    title?: string;
    description?: string;
    context?: string;
    notes?: string;
  }): Promise<Task> {
    const { data: task, error } = await this.client
      .from('scheduled_tasks')
      .insert({
        user_id: data.user_id,
        task_type: data.task_type,
        title: data.title,
        description: data.description,
        context: data.context,
        notes: data.notes,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: task.id,
      user_id: task.user_id,
      title: task.title,
      description: task.description,
      queue_id: task.queue_id,
      queue_level: task.queue_level,
      position: task.position,
      estimated_duration: task.estimated_duration,
      actual_duration: task.actual_duration,
      deadline: task.deadline,
      status: task.status,
      tags: task.tags,
      knowledge_point_id: task.knowledge_point_id,
      priority: task.priority,
      task_type: task.task_type,
      total_duration: task.total_duration,
      progress_mode: task.progress_mode,
      progress_percentage: task.progress_percentage,
      parent_task_id: task.parent_task_id,
      context: task.context,
      scheduled_start: task.scheduled_start,
      scheduled_end: task.scheduled_end,
      notes: task.notes,
      completed_at: task.completed_at,
      created_at: task.created_at,
      updated_at: task.updated_at,
      deleted_at: task.deleted_at,
    };
  }

  async updateAsyncTask(id: string, data: {
    status?: string;
    notes?: string;
  }): Promise<Task> {
    const updateData: Record<string, unknown> = { updated_at: now() };
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const { data: task, error } = await this.client
      .from('scheduled_tasks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return {
      id: task.id,
      user_id: task.user_id,
      title: task.title,
      description: task.description,
      queue_id: task.queue_id,
      queue_level: task.queue_level,
      position: task.position,
      estimated_duration: task.estimated_duration,
      actual_duration: task.actual_duration,
      deadline: task.deadline,
      status: task.status,
      tags: task.tags,
      knowledge_point_id: task.knowledge_point_id,
      priority: task.priority,
      task_type: task.task_type,
      total_duration: task.total_duration,
      progress_mode: task.progress_mode,
      progress_percentage: task.progress_percentage,
      parent_task_id: task.parent_task_id,
      context: task.context,
      scheduled_start: task.scheduled_start,
      scheduled_end: task.scheduled_end,
      notes: task.notes,
      completed_at: task.completed_at,
      created_at: task.created_at,
      updated_at: task.updated_at,
      deleted_at: task.deleted_at,
    };
  }

  async deleteAsyncTask(id: string): Promise<void> {
    const { error } = await this.client
      .from('scheduled_tasks')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  async raw<T = unknown>(_sql: string, _params?: unknown[]): Promise<T[]> {
    throw new Error('Raw SQL queries are not supported in Supabase adapter. Use the client methods instead.');
  }

  async rawOne<T = unknown>(_sql: string, _params?: unknown[]): Promise<T | null> {
    throw new Error('Raw SQL queries are not supported in Supabase adapter. Use the client methods instead.');
  }

  async execute(_sql: string, _params?: unknown[]): Promise<{ changes: number; lastInsertRowid: unknown }> {
    throw new Error('Raw SQL execution is not supported in Supabase adapter. Use the client methods instead.');
  }
}
