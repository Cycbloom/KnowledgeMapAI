/**
 * AUTO-GENERATED TYPES - DO NOT EDIT MANUALLY
 *
 * TODO: 本地 supabase 未运行，生成失败。请运行 npm run db:local:start && npm run db:gen-types 重新生成
 *
 * 此文件为降级方案手动创建的骨架。表名与 supabase/migrations 实际定义保持一致：
 *   - knowledge_graphs（非 graphs）
 *   - graph_nodes
 *   - study_cards
 *   - graph_relations
 *   - domains
 *
 * 字段可空性以原 shared/types/database.ts 中手写 Row 类型为准（保持向后兼容），
 * 并包含 schema 中存在但原手写类型未列出的字段（如 knowledge_graphs.is_branch、
 * embedding）。当本地 supabase 可用时运行 `npm run db:gen-types` 覆盖此文件。
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      knowledge_graphs: {
        Row: {
          id: string;
          user_id?: string | null;
          title: string;
          description?: string | null;
          domain?: string | null;
          settings?: Record<string, unknown> | null;
          is_public?: boolean;
          is_favorite?: boolean;
          podcast_script?: string | null;
          parent_graph_id?: string | null;
          is_branch?: boolean | null;
          last_used_at?: string | null;
          embedding?: unknown | null;
          deleted_at?: string | null;
          created_at: string;
          updated_at?: string | null;
          reference_books?: Record<string, unknown>[] | null;
          external_links?: Record<string, unknown>[] | null;
          learning_guide?: string | null;
          template_type?: string | null;
          // 迁移 07 添加
          task_id?: string | null;
          // RPC get_user_graphs_with_counts 返回的派生字段
          nodes_count?: number;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          title: string;
          description?: string | null;
          domain?: string | null;
          settings?: Record<string, unknown> | null;
          is_public?: boolean | null;
          is_favorite?: boolean | null;
          podcast_script?: string | null;
          parent_graph_id?: string | null;
          is_branch?: boolean | null;
          last_used_at?: string | null;
          embedding?: unknown | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string | null;
          reference_books?: Record<string, unknown>[] | null;
          external_links?: Record<string, unknown>[] | null;
          learning_guide?: string | null;
          template_type?: string | null;
          task_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          title?: string;
          description?: string | null;
          domain?: string | null;
          settings?: Record<string, unknown> | null;
          is_public?: boolean | null;
          is_favorite?: boolean | null;
          podcast_script?: string | null;
          parent_graph_id?: string | null;
          is_branch?: boolean | null;
          last_used_at?: string | null;
          embedding?: unknown | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string | null;
          reference_books?: Record<string, unknown>[] | null;
          external_links?: Record<string, unknown>[] | null;
          learning_guide?: string | null;
          template_type?: string | null;
          task_id?: string | null;
        };
        Relationships: [];
      };
      graph_nodes: {
        Row: {
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
        };
        Insert: {
          id?: string;
          graph_id: string;
          knowledge_point_id: string;
          x_position?: number;
          y_position?: number;
          level?: string;
          is_accepted?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          graph_id?: string;
          knowledge_point_id?: string;
          x_position?: number;
          y_position?: number;
          level?: string;
          is_accepted?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      study_cards: {
        Row: {
          id: string;
          knowledge_point_id: string;
          user_id: string;
          graph_id: string;
          source_graph_id?: string;
          question: string;
          answer: string;
          explanation?: string | null;
          card_type: string;
          options?: string[] | null;
          correct_indices?: number[] | null;
          difficulty: number;
          last_reviewed?: string | null;
          next_review: string;
          review_count?: number;
          fsrs_state: string;
          fsrs_stability: number;
          fsrs_difficulty: number;
          fsrs_elapsed_days: number;
          fsrs_scheduled_days: number;
          fsrs_retrievability: number;
          fsrs_last_review?: string | null;
          last_rating?: number | null;
          quiz_set_id?: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          knowledge_point_id?: string | null;
          user_id?: string | null;
          graph_id?: string | null;
          source_graph_id?: string | null;
          question: string;
          answer: string;
          explanation?: string | null;
          card_type?: string;
          options?: string[] | null;
          correct_indices?: number[] | null;
          difficulty?: number;
          last_reviewed?: string | null;
          next_review?: string;
          review_count?: number;
          fsrs_state?: string;
          fsrs_stability?: number;
          fsrs_difficulty?: number;
          fsrs_elapsed_days?: number;
          fsrs_scheduled_days?: number;
          fsrs_retrievability?: number;
          fsrs_last_review?: string | null;
          last_rating?: number | null;
          quiz_set_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          knowledge_point_id?: string | null;
          user_id?: string | null;
          graph_id?: string | null;
          source_graph_id?: string | null;
          question?: string;
          answer?: string;
          explanation?: string | null;
          card_type?: string;
          options?: string[] | null;
          correct_indices?: number[] | null;
          difficulty?: number;
          last_reviewed?: string | null;
          next_review?: string;
          review_count?: number;
          fsrs_state?: string;
          fsrs_stability?: number;
          fsrs_difficulty?: number;
          fsrs_elapsed_days?: number;
          fsrs_scheduled_days?: number;
          fsrs_retrievability?: number;
          fsrs_last_review?: string | null;
          last_rating?: number | null;
          quiz_set_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      graph_relations: {
        Row: {
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
        };
        Insert: {
          id?: string;
          source_graph_id?: string | null;
          target_graph_id?: string | null;
          relation_type: string;
          context?: string | null;
          metadata?: Record<string, unknown> | null;
          confidence?: number | null;
          source?: string | null;
          shared_concepts?: string[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          source_graph_id?: string | null;
          target_graph_id?: string | null;
          relation_type?: string;
          context?: string | null;
          metadata?: Record<string, unknown> | null;
          confidence?: number | null;
          source?: string | null;
          shared_concepts?: string[] | null;
          created_at?: string;
        };
        Relationships: [];
      };
      domains: {
        Row: {
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
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          color?: string;
          icon?: string | null;
          parent_id?: string | null;
          sort_order?: number;
          user_id?: string | null;
          is_system?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          color?: string;
          icon?: string | null;
          parent_id?: string | null;
          sort_order?: number;
          user_id?: string | null;
          is_system?: boolean;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [key: string]: {
        Row: Record<string, unknown>;
      };
    };
    Functions: {
      [key: string]: {
        Args: Record<string, unknown>;
        Returns: unknown;
      };
    };
    Enums: {
      [key: string]: string;
    };
    CompositeTypes: {
      [key: string]: Record<string, unknown>;
    };
  };
}
