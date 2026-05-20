import type { Graph, Domain, GraphDomain } from './graph';
import type { User } from './user';

export interface KnowledgeGraphRow {
  id: string;
  title: string;
  description?: string | null;
  domain?: string | null;
  user_id?: string | null;
  settings?: Record<string, unknown> | null;
  tags?: string[] | null;
  is_favorite?: boolean;
  is_public?: boolean;
  podcast_script?: string | null;
  nodes_count?: number;
  deleted_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface GraphNodeRow {
  id: string;
  graph_id: string;
  knowledge_point_id: string;
  x_position: number;
  y_position: number;
  level: string;
  is_accepted: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudyCardRow {
  id: string;
  user_id: string;
  knowledge_point_id: string;
  graph_id: string;
  source_graph_id?: string;
  question: string;
  answer: string;
  explanation?: string | null;
  card_type: string;
  options?: string[] | null;
  correct_indices?: number[] | null;
  next_review: string;
  difficulty: number;
  fsrs_state: string;
  fsrs_stability: number;
  fsrs_difficulty: number;
  fsrs_elapsed_days: number;
  fsrs_scheduled_days: number;
  fsrs_retrievability: number;
  review_count?: number;
  created_at: string;
  updated_at: string;
}

export interface GraphRelationRow {
  id: string;
  source_graph_id: string;
  target_graph_id: string;
  relation_type: string;
  context?: string | null;
  metadata?: Record<string, unknown> | null;
  confidence?: number;
  source?: string | null;
  shared_concepts?: string[] | null;
  created_at: string;
}

export interface DomainRow {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  icon?: string | null;
  parent_id?: string | null;
  sort_order: number;
  user_id?: string | null;
  is_system: boolean;
  deleted_at?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface GraphDomainRow {
  id: string;
  graph_id: string;
  domain_id: string;
  is_primary: boolean;
  created_at: string;
}

export function toGraph(row: KnowledgeGraphRow): Graph {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    domain: row.domain ?? undefined,
    user_id: row.user_id ?? undefined,
    settings: row.settings as Graph['settings'] ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
    nodes_count: row.nodes_count ?? undefined,
    podcast_script: row.podcast_script ?? undefined,
    is_favorite: row.is_favorite ?? undefined,
  };
}

export function toUser(supabaseUser: { id: string; email?: string; user_metadata?: Record<string, unknown> }): User {
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    name: supabaseUser.user_metadata?.name as string | undefined,
    user_metadata: supabaseUser.user_metadata ? {
      name: supabaseUser.user_metadata.name as string | undefined,
      avatar_url: supabaseUser.user_metadata.avatar_url as string | undefined,
      theme: supabaseUser.user_metadata.theme as string | undefined,
      ...supabaseUser.user_metadata,
    } : undefined,
  };
}

export function toDomain(row: DomainRow): Domain {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    color: row.color,
    icon: row.icon ?? undefined,
    parent_id: row.parent_id ?? undefined,
    sort_order: row.sort_order,
    user_id: row.user_id ?? undefined,
    is_system: row.is_system,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
  };
}

export function toGraphDomain(row: GraphDomainRow): GraphDomain {
  return {
    id: row.id,
    graph_id: row.graph_id,
    domain_id: row.domain_id,
    is_primary: row.is_primary,
    created_at: row.created_at,
  };
}
