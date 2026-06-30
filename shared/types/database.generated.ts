/**
 * AUTO-GENERATED TYPES - DO NOT EDIT MANUALLY
 *
 * TODO: 本地 supabase 未运行时为降级方案手动维护的骨架。
 * 请运行 npm run db:local:start && npm run db:gen-types 重新生成。
 *
 * 表名与 supabase/migrations 实际定义保持一致。
 * 当本地 supabase 可用时运行 `npm run db:gen-types` 覆盖此文件。
 * 手动补充的表标注了 TODO: 需自动生成 注释。
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
      // ===== 核心表（由降级骨架保留） =====
      knowledge_graphs: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          domain: string | null;
          settings: Record<string, unknown> | null;
          is_public: boolean | null;
          is_favorite: boolean | null;
          podcast_script: string | null;
          parent_graph_id: string | null;
          is_branch: boolean | null;
          last_used_at: string | null;
          embedding: unknown | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string | null;
          reference_books: Record<string, unknown>[] | null;
          external_links: Record<string, unknown>[] | null;
          learning_guide: string | null;
          template_type: string | null;
          task_id: string | null;
          branch_name: string | null;
          branch_source_snapshot_id: string | null;
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
          branch_name?: string | null;
          branch_source_snapshot_id?: string | null;
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
          branch_name?: string | null;
          branch_source_snapshot_id?: string | null;
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
          deleted_at: string | null;
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
          knowledge_point_id: string | null;
          user_id: string | null;
          graph_id: string | null;
          source_graph_id: string | null;
          question: string;
          answer: string;
          explanation: string | null;
          card_type: string | null;
          options: Json | null;
          correct_indices: number[] | null;
          difficulty: number | null;
          last_reviewed: string | null;
          next_review: string | null;
          review_count: number | null;
          fsrs_state: string | null;
          fsrs_stability: number | null;
          fsrs_difficulty: number | null;
          fsrs_elapsed_days: number | null;
          fsrs_scheduled_days: number | null;
          fsrs_retrievability: number | null;
          fsrs_last_review: string | null;
          last_rating: number | null;
          quiz_set_id: string | null;
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
          card_type?: string | null;
          options?: Json | null;
          correct_indices?: number[] | null;
          difficulty?: number | null;
          last_reviewed?: string | null;
          next_review?: string | null;
          review_count?: number | null;
          fsrs_state?: string | null;
          fsrs_stability?: number | null;
          fsrs_difficulty?: number | null;
          fsrs_elapsed_days?: number | null;
          fsrs_scheduled_days?: number | null;
          fsrs_retrievability?: number | null;
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
          card_type?: string | null;
          options?: Json | null;
          correct_indices?: number[] | null;
          difficulty?: number | null;
          last_reviewed?: string | null;
          next_review?: string | null;
          review_count?: number | null;
          fsrs_state?: string | null;
          fsrs_stability?: number | null;
          fsrs_difficulty?: number | null;
          fsrs_elapsed_days?: number | null;
          fsrs_scheduled_days?: number | null;
          fsrs_retrievability?: number | null;
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
          source_graph_id: string | null;
          target_graph_id: string | null;
          relation_type: string;
          context: string | null;
          metadata: Record<string, unknown> | null;
          confidence: number | null;
          source: string | null;
          shared_concepts: string[] | null;
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
          description: string | null;
          color: string;
          icon: string | null;
          parent_id: string | null;
          sort_order: number;
          user_id: string | null;
          is_system: boolean;
          deleted_at: string | null;
          created_at: string;
          updated_at: string | null;
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

      // ===== TODO: 需自动生成 - 以下为手动补充的表定义 =====

      graph_domains: {
        Row: {
          id: string;
          graph_id: string;
          domain_id: string;
          is_primary: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          graph_id: string;
          domain_id: string;
          is_primary?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          graph_id?: string;
          domain_id?: string;
          is_primary?: boolean | null;
          created_at?: string | null;
        };
        Relationships: [];
      };

      user_tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          queue_id: string | null;
          queue_level: number | null;
          position: number;
          estimated_duration: number | null;
          actual_duration: number | null;
          deadline: string | null;
          status: string;
          tags: string[] | null;
          knowledge_point_id: string | null;
          priority: number | null;
          task_type: string | null;
          total_duration: number | null;
          progress_mode: string | null;
          progress_percentage: number;
          parent_task_id: string | null;
          context: Record<string, unknown> | null;
          scheduled_start: string | null;
          scheduled_end: string | null;
          notes: string | null;
          source: string | null;
          created_at: string | null;
          updated_at: string | null;
          deleted_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          queue_id?: string | null;
          queue_level?: number;
          position?: number;
          estimated_duration?: number | null;
          actual_duration?: number | null;
          deadline?: string | null;
          status?: string;
          tags?: string[] | null;
          knowledge_point_id?: string | null;
          priority?: number;
          task_type?: string | null;
          total_duration?: number | null;
          progress_mode?: string | null;
          progress_percentage?: number;
          parent_task_id?: string | null;
          context?: Record<string, unknown> | null;
          scheduled_start?: string | null;
          scheduled_end?: string | null;
          notes?: string | null;
          source?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          queue_id?: string | null;
          queue_level?: number;
          position?: number;
          estimated_duration?: number | null;
          actual_duration?: number | null;
          deadline?: string | null;
          status?: string;
          tags?: string[] | null;
          knowledge_point_id?: string | null;
          priority?: number;
          task_type?: string | null;
          total_duration?: number | null;
          progress_mode?: string | null;
          progress_percentage?: number;
          parent_task_id?: string | null;
          context?: Record<string, unknown> | null;
          scheduled_start?: string | null;
          scheduled_end?: string | null;
          notes?: string | null;
          source?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };

      task_dependencies: {
        Row: {
          id: string;
          task_id: string;
          depends_on_task_id: string;
          dependency_type: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          task_id: string;
          depends_on_task_id: string;
          dependency_type?: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string;
          depends_on_task_id?: string;
          dependency_type?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };

      task_executions: {
        Row: {
          id: string;
          task_id: string;
          user_id: string;
          started_at: string;
          ended_at: string | null;
          duration: number | null;
          queue_level: number | null;
          status: string | null;
        };
        Insert: {
          id?: string;
          task_id: string;
          user_id: string;
          started_at: string;
          ended_at?: string | null;
          duration?: number | null;
          queue_level?: number | null;
          status?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string;
          user_id?: string;
          started_at?: string;
          ended_at?: string | null;
          duration?: number | null;
          queue_level?: number | null;
          status?: string | null;
        };
        Relationships: [];
      };

      task_subtasks: {
        Row: {
          id: string;
          task_id: string;
          title: string;
          description: string | null;
          status: string | null;
          priority: number | null;
          position: number | null;
          estimated_duration: number | null;
          actual_duration: number | null;
          due_date: string | null;
          completed_at: string | null;
          learning_path_node_id: string | null;
          knowledge_point_id: string;
          learning_state: string | null;
          mastery_level: number | null;
          last_state_change_at: string | null;
          state_history: Record<string, unknown>[] | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          task_id: string;
          title: string;
          description?: string | null;
          status?: string | null;
          priority?: number;
          position?: number;
          estimated_duration?: number | null;
          actual_duration?: number | null;
          due_date?: string | null;
          completed_at?: string | null;
          learning_path_node_id?: string | null;
          knowledge_point_id: string;
          learning_state?: string | null;
          mastery_level?: number;
          last_state_change_at?: string | null;
          state_history?: Record<string, unknown>[] | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string;
          title?: string;
          description?: string | null;
          status?: string | null;
          priority?: number;
          position?: number;
          estimated_duration?: number | null;
          actual_duration?: number | null;
          due_date?: string | null;
          completed_at?: string | null;
          learning_path_node_id?: string | null;
          knowledge_point_id?: string;
          learning_state?: string | null;
          mastery_level?: number;
          last_state_change_at?: string | null;
          state_history?: Record<string, unknown>[] | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };

      achievements: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          category: string;
          icon: string | null;
          color: string | null;
          xp_reward: number | null;
          condition_type: string;
          condition_value: number;
          is_hidden: boolean | null;
          trigger_events: string[] | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          category: string;
          icon?: string | null;
          color?: string | null;
          xp_reward?: number | null;
          condition_type: string;
          condition_value: number;
          is_hidden?: boolean | null;
          trigger_events?: string[] | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          description?: string | null;
          category?: string;
          icon?: string | null;
          color?: string | null;
          xp_reward?: number | null;
          condition_type?: string;
          condition_value?: number;
          is_hidden?: boolean | null;
          trigger_events?: string[] | null;
          created_at?: string | null;
        };
        Relationships: [];
      };

      user_achievements: {
        Row: {
          id: string;
          user_id: string | null;
          achievement_id: string | null;
          progress: number | null;
          metadata: Record<string, unknown> | null;
          unlocked_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          achievement_id?: string | null;
          progress?: number | null;
          metadata?: Record<string, unknown> | null;
          unlocked_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          achievement_id?: string | null;
          progress?: number | null;
          metadata?: Record<string, unknown> | null;
          unlocked_at?: string | null;
        };
        Relationships: [];
      };

      focus_sessions: {
        Row: {
          id: string;
          user_id: string;
          task_id: string | null;
          started_at: string;
          ended_at: string;
          duration: number;
          mode: string | null;
          completed: boolean | null;
          pomodoro_count: number | null;
          white_noise_type: string | null;
          is_break: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_id?: string | null;
          started_at?: string;
          ended_at?: string;
          duration?: number;
          mode?: string | null;
          completed?: boolean | null;
          pomodoro_count?: number | null;
          white_noise_type?: string | null;
          is_break?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          task_id?: string | null;
          started_at?: string;
          ended_at?: string;
          duration?: number;
          mode?: string | null;
          completed?: boolean | null;
          pomodoro_count?: number | null;
          white_noise_type?: string | null;
          is_break?: boolean | null;
          created_at?: string | null;
        };
        Relationships: [];
      };

      periodic_tasks: {
        Row: {
          id: string;
          user_id: string;
          period_type: string;
          period_start: string;
          period_end: string;
          task_type: string;
          target: number;
          progress: number | null;
          status: string | null;
          xp_reward: number;
          pass_points: number | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          period_type: string;
          period_start: string;
          period_end: string;
          task_type: string;
          target: number;
          progress?: number | null;
          status?: string | null;
          xp_reward: number;
          pass_points?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          period_type?: string;
          period_start?: string;
          period_end?: string;
          task_type?: string;
          target?: number;
          progress?: number | null;
          status?: string | null;
          xp_reward?: number;
          pass_points?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };

      user_focus_stats: {
        Row: {
          id: string;
          user_id: string;
          total_focus_seconds: number | null;
          total_sessions: number | null;
          total_pomodoros: number | null;
          total_tasks_completed: number | null;
          current_streak: number | null;
          longest_streak: number | null;
          weekly_streak: number | null;
          monthly_streak: number | null;
          quarterly_streak: number | null;
          daily_task_streak: number | null;
          last_daily_completion: string | null;
          last_focus_date: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          total_focus_seconds?: number | null;
          total_sessions?: number | null;
          total_pomodoros?: number | null;
          total_tasks_completed?: number | null;
          current_streak?: number | null;
          longest_streak?: number | null;
          weekly_streak?: number | null;
          monthly_streak?: number | null;
          quarterly_streak?: number | null;
          daily_task_streak?: number | null;
          last_daily_completion?: string | null;
          last_focus_date?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          total_focus_seconds?: number | null;
          total_sessions?: number | null;
          total_pomodoros?: number | null;
          total_tasks_completed?: number | null;
          current_streak?: number | null;
          longest_streak?: number | null;
          weekly_streak?: number | null;
          monthly_streak?: number | null;
          quarterly_streak?: number | null;
          daily_task_streak?: number | null;
          last_daily_completion?: string | null;
          last_focus_date?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };

      task_knowledge_points: {
        Row: {
          id: string;
          task_id: string;
          knowledge_point_id: string;
          relevance_score: number | null;
          is_primary: boolean | null;
          notes: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          task_id: string;
          knowledge_point_id: string;
          relevance_score?: number;
          is_primary?: boolean;
          notes?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string;
          knowledge_point_id?: string;
          relevance_score?: number;
          is_primary?: boolean;
          notes?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };

      task_links: {
        Row: {
          id: string;
          task_id: string;
          link_type: string;
          title: string | null;
          url: string;
          description: string | null;
          icon: string | null;
          metadata: Record<string, unknown> | null;
          position: number | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          task_id: string;
          link_type?: string;
          title?: string | null;
          url: string;
          description?: string | null;
          icon?: string | null;
          metadata?: Record<string, unknown> | null;
          position?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string;
          link_type?: string;
          title?: string | null;
          url?: string;
          description?: string | null;
          icon?: string | null;
          metadata?: Record<string, unknown> | null;
          position?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };

      queues: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          time_slice: number;
          priority: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string;
          time_slice?: number;
          priority: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string;
          time_slice?: number;
          priority?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      task_settings: {
        Row: {
          id: string;
          user_id: string;
          q0_time_slice: number | null;
          q1_time_slice: number | null;
          q2_time_slice: number | null;
          break_duration: number | null;
          sound_enabled: boolean | null;
          notification_enabled: boolean | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          q0_time_slice?: number;
          q1_time_slice?: number;
          q2_time_slice?: number;
          break_duration?: number;
          sound_enabled?: boolean;
          notification_enabled?: boolean;
        };
        Update: {
          id?: string;
          user_id?: string;
          q0_time_slice?: number;
          q1_time_slice?: number;
          q2_time_slice?: number;
          break_duration?: number;
          sound_enabled?: boolean;
          notification_enabled?: boolean;
        };
        Relationships: [];
      };

      user_time_slots: {
        Row: {
          id: string;
          user_id: string;
          day_of_week: number | null;
          start_time: string;
          end_time: string;
          is_available: boolean | null;
          label: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          day_of_week?: number | null;
          start_time: string;
          end_time: string;
          is_available?: boolean;
          label?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          day_of_week?: number | null;
          start_time?: string;
          end_time?: string;
          is_available?: boolean;
          label?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };

      task_schedules: {
        Row: {
          id: string;
          user_id: string;
          task_template_id: string;
          schedule_type: string;
          schedule_config: Record<string, unknown> | null;
          next_run_at: string | null;
          last_run_at: string | null;
          is_active: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          task_template_id: string;
          schedule_type: string;
          schedule_config?: Record<string, unknown> | null;
          next_run_at?: string | null;
          last_run_at?: string | null;
          is_active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          task_template_id?: string;
          schedule_type?: string;
          schedule_config?: Record<string, unknown> | null;
          next_run_at?: string | null;
          last_run_at?: string | null;
          is_active?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };

      task_progress_plans: {
        Row: {
          id: string;
          task_id: string;
          plan_date: string;
          planned_percentage: number;
          actual_percentage: number | null;
          status: string | null;
          notes: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          task_id: string;
          plan_date: string;
          planned_percentage: number;
          actual_percentage?: number;
          status?: string;
          notes?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          task_id?: string;
          plan_date?: string;
          planned_percentage?: number;
          actual_percentage?: number;
          status?: string;
          notes?: string | null;
          created_at?: string | null;
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
