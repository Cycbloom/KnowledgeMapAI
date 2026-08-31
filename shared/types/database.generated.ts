export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          category: string
          code: string
          color: string | null
          condition_type: string
          condition_value: number
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_hidden: boolean | null
          name: string
          trigger_events: string[] | null
          xp_reward: number | null
        }
        Insert: {
          category: string
          code: string
          color?: string | null
          condition_type: string
          condition_value: number
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_hidden?: boolean | null
          name: string
          trigger_events?: string[] | null
          xp_reward?: number | null
        }
        Update: {
          category?: string
          code?: string
          color?: string | null
          condition_type?: string
          condition_value?: number
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_hidden?: boolean | null
          name?: string
          trigger_events?: string[] | null
          xp_reward?: number | null
        }
        Relationships: []
      }
      agent_messages: {
        Row: {
          content: string
          id: string
          role: string
          session_id: string
          timestamp: string
          tool_args: Json | null
          tool_name: string | null
          tool_result: Json | null
        }
        Insert: {
          content: string
          id?: string
          role: string
          session_id: string
          timestamp?: string
          tool_args?: Json | null
          tool_name?: string | null
          tool_result?: Json | null
        }
        Update: {
          content?: string
          id?: string
          role?: string
          session_id?: string
          timestamp?: string
          tool_args?: Json | null
          tool_name?: string | null
          tool_result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "agent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_pending_actions: {
        Row: {
          args: Json
          category: string
          created_at: string
          description: string
          executed_at: string | null
          id: string
          result: Json | null
          risk_level: string
          session_id: string
          status: string
          tool_name: string
        }
        Insert: {
          args?: Json
          category?: string
          created_at?: string
          description: string
          executed_at?: string | null
          id?: string
          result?: Json | null
          risk_level?: string
          session_id: string
          status?: string
          tool_name: string
        }
        Update: {
          args?: Json
          category?: string
          created_at?: string
          description?: string
          executed_at?: string | null
          id?: string
          result?: Json | null
          risk_level?: string
          session_id?: string
          status?: string
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_pending_actions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "agent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_sessions: {
        Row: {
          created_at: string
          graph_ids: string[] | null
          id: string
          result: string | null
          skill_id: string | null
          status: string
          structured_result: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          graph_ids?: string[] | null
          id?: string
          result?: string | null
          skill_id?: string | null
          status?: string
          structured_result?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          graph_ids?: string[] | null
          id?: string
          result?: string | null
          skill_id?: string | null
          status?: string
          structured_result?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tool_calls: {
        Row: {
          args: Json
          id: string
          result: Json | null
          session_id: string
          status: string
          timestamp: string
          tool_name: string
        }
        Insert: {
          args?: Json
          id?: string
          result?: Json | null
          session_id: string
          status?: string
          timestamp?: string
          tool_name: string
        }
        Update: {
          args?: Json
          id?: string
          result?: Json | null
          session_id?: string
          status?: string
          timestamp?: string
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tool_calls_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "agent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_actions: {
        Row: {
          created_at: string | null
          description: string | null
          graph_id: string | null
          icon: string | null
          id: string
          name: string
          prompt_template: string
          scope: string
          target_mode: string
          updated_at: string | null
          user_id: string | null
          variables: Json | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          graph_id?: string | null
          icon?: string | null
          id?: string
          name: string
          prompt_template: string
          scope: string
          target_mode: string
          updated_at?: string | null
          user_id?: string | null
          variables?: Json | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          graph_id?: string | null
          icon?: string | null
          id?: string
          name?: string
          prompt_template?: string
          scope?: string
          target_mode?: string
          updated_at?: string | null
          user_id?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_actions_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_performance_logs: {
        Row: {
          cache_hit_rate: number | null
          cached_input_tokens: number | null
          cost_breakdown: Json | null
          created_at: string | null
          duration: number
          error_message: string | null
          estimated_cost: number | null
          id: string
          input_tokens: number
          metadata: Json | null
          model: string
          operation: string
          output_tokens: number
          provider: string
          reasoning_tokens: number | null
          session_id: string | null
          success: boolean
          total_tokens: number
          uncached_input_tokens: number | null
          user_id: string | null
        }
        Insert: {
          cache_hit_rate?: number | null
          cached_input_tokens?: number | null
          cost_breakdown?: Json | null
          created_at?: string | null
          duration: number
          error_message?: string | null
          estimated_cost?: number | null
          id?: string
          input_tokens?: number
          metadata?: Json | null
          model: string
          operation: string
          output_tokens?: number
          provider: string
          reasoning_tokens?: number | null
          session_id?: string | null
          success?: boolean
          total_tokens?: number
          uncached_input_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          cache_hit_rate?: number | null
          cached_input_tokens?: number | null
          cost_breakdown?: Json | null
          created_at?: string | null
          duration?: number
          error_message?: string | null
          estimated_cost?: number | null
          id?: string
          input_tokens?: number
          metadata?: Json | null
          model?: string
          operation?: string
          output_tokens?: number
          provider?: string
          reasoning_tokens?: number | null
          session_id?: string | null
          success?: boolean
          total_tokens?: number
          uncached_input_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_performance_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          created_at: string
          details: Json | null
          event_type: string
          id: string
          ip: string | null
          timestamp: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          event_type: string
          id?: string
          ip?: string | null
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          event_type?: string
          id?: string
          ip?: string | null
          timestamp?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      backup_snapshots: {
        Row: {
          created_at: string | null
          file_path: string
          file_size: number | null
          graphs_count: number | null
          id: string
          nodes_count: number | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          file_path: string
          file_size?: number | null
          graphs_count?: number | null
          id?: string
          nodes_count?: number | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          file_path?: string
          file_size?: number | null
          graphs_count?: number | null
          id?: string
          nodes_count?: number | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      document_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string | null
          embedding: string | null
          id: string
          knowledge_point_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          knowledge_point_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          knowledge_point_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_knowledge_point_id_fkey"
            columns: ["knowledge_point_id"]
            isOneToOne: false
            referencedRelation: "knowledge_points"
            referencedColumns: ["id"]
          },
        ]
      }
      domains: {
        Row: {
          color: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_system: boolean | null
          name: string
          parent_id: string | null
          sort_order: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "domains_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
        ]
      }
      edges: {
        Row: {
          created_at: string | null
          custom_color: string | null
          custom_label: string | null
          custom_line_style: string | null
          deleted_at: string | null
          graph_id: string
          id: string
          relationship_type: string | null
          show_arrow: boolean | null
          source_knowledge_point_id: string | null
          target_knowledge_point_id: string | null
          updated_at: string | null
          weight: number | null
        }
        Insert: {
          created_at?: string | null
          custom_color?: string | null
          custom_label?: string | null
          custom_line_style?: string | null
          deleted_at?: string | null
          graph_id: string
          id?: string
          relationship_type?: string | null
          show_arrow?: boolean | null
          source_knowledge_point_id?: string | null
          target_knowledge_point_id?: string | null
          updated_at?: string | null
          weight?: number | null
        }
        Update: {
          created_at?: string | null
          custom_color?: string | null
          custom_label?: string | null
          custom_line_style?: string | null
          deleted_at?: string | null
          graph_id?: string
          id?: string
          relationship_type?: string | null
          show_arrow?: boolean | null
          source_knowledge_point_id?: string | null
          target_knowledge_point_id?: string | null
          updated_at?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "edges_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edges_source_knowledge_point_id_fkey"
            columns: ["source_knowledge_point_id"]
            isOneToOne: false
            referencedRelation: "knowledge_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "edges_target_knowledge_point_id_fkey"
            columns: ["target_knowledge_point_id"]
            isOneToOne: false
            referencedRelation: "knowledge_points"
            referencedColumns: ["id"]
          },
        ]
      }
      error_reports: {
        Row: {
          column_number: number | null
          component_stack: string | null
          created_at: string
          id: string
          line_number: number | null
          message: string
          metadata: Json | null
          stack: string | null
          timestamp: string
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          column_number?: number | null
          component_stack?: string | null
          created_at?: string
          id?: string
          line_number?: number | null
          message: string
          metadata?: Json | null
          stack?: string | null
          timestamp?: string
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          column_number?: number | null
          component_stack?: string | null
          created_at?: string
          id?: string
          line_number?: number | null
          message?: string
          metadata?: Json | null
          stack?: string | null
          timestamp?: string
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      focus_sessions: {
        Row: {
          completed: boolean | null
          created_at: string | null
          duration: number
          ended_at: string
          id: string
          is_break: boolean | null
          mode: string
          pomodoro_count: number | null
          started_at: string
          task_id: string | null
          user_id: string
          white_noise_type: string | null
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          duration: number
          ended_at?: string
          id?: string
          is_break?: boolean | null
          mode: string
          pomodoro_count?: number | null
          started_at?: string
          task_id?: string | null
          user_id: string
          white_noise_type?: string | null
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          duration?: number
          ended_at?: string
          id?: string
          is_break?: boolean | null
          mode?: string
          pomodoro_count?: number | null
          started_at?: string
          task_id?: string | null
          user_id?: string
          white_noise_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "focus_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "user_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      graph_backbone_modules: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          display_order: number
          graph_id: string
          icon: string | null
          id: string
          module_type: string
          title: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number
          graph_id: string
          icon?: string | null
          id?: string
          module_type: string
          title: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number
          graph_id?: string
          icon?: string | null
          id?: string
          module_type?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "graph_backbone_modules_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
        ]
      }
      graph_collaborators: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          graph_id: string
          id: string
          invitation_expires_at: string | null
          invitation_token: string | null
          invited_at: string | null
          invited_by: string | null
          role: Database["public"]["Enums"]["collaborator_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          graph_id: string
          id?: string
          invitation_expires_at?: string | null
          invitation_token?: string | null
          invited_at?: string | null
          invited_by?: string | null
          role?: Database["public"]["Enums"]["collaborator_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          graph_id?: string
          id?: string
          invitation_expires_at?: string | null
          invitation_token?: string | null
          invited_at?: string | null
          invited_by?: string | null
          role?: Database["public"]["Enums"]["collaborator_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "graph_collaborators_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
        ]
      }
      graph_domains: {
        Row: {
          created_at: string | null
          domain_id: string
          graph_id: string
          id: string
          is_primary: boolean | null
        }
        Insert: {
          created_at?: string | null
          domain_id: string
          graph_id: string
          id?: string
          is_primary?: boolean | null
        }
        Update: {
          created_at?: string | null
          domain_id?: string
          graph_id?: string
          id?: string
          is_primary?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "graph_domains_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "graph_domains_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
        ]
      }
      graph_events: {
        Row: {
          batch_id: string | null
          created_at: string
          event_data: Json
          event_type: Database["public"]["Enums"]["graph_event_type"]
          graph_id: string
          id: string
          operator_id: string | null
          snapshot_id: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          event_data?: Json
          event_type: Database["public"]["Enums"]["graph_event_type"]
          graph_id: string
          id?: string
          operator_id?: string | null
          snapshot_id?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          event_data?: Json
          event_type?: Database["public"]["Enums"]["graph_event_type"]
          graph_id?: string
          id?: string
          operator_id?: string | null
          snapshot_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "graph_events_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "graph_events_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "graph_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      graph_nodes: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          graph_id: string
          id: string
          is_accepted: boolean | null
          knowledge_point_id: string
          level: string | null
          updated_at: string | null
          x_position: number | null
          y_position: number | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          graph_id: string
          id?: string
          is_accepted?: boolean | null
          knowledge_point_id: string
          level?: string | null
          updated_at?: string | null
          x_position?: number | null
          y_position?: number | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          graph_id?: string
          id?: string
          is_accepted?: boolean | null
          knowledge_point_id?: string
          level?: string | null
          updated_at?: string | null
          x_position?: number | null
          y_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "graph_nodes_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "graph_nodes_knowledge_point_id_fkey"
            columns: ["knowledge_point_id"]
            isOneToOne: false
            referencedRelation: "knowledge_points"
            referencedColumns: ["id"]
          },
        ]
      }
      graph_relations: {
        Row: {
          confidence: number | null
          context: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          relation_type: string
          shared_concepts: string[] | null
          source: string | null
          source_graph_id: string | null
          target_graph_id: string | null
        }
        Insert: {
          confidence?: number | null
          context?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          relation_type: string
          shared_concepts?: string[] | null
          source?: string | null
          source_graph_id?: string | null
          target_graph_id?: string | null
        }
        Update: {
          confidence?: number | null
          context?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          relation_type?: string
          shared_concepts?: string[] | null
          source?: string | null
          source_graph_id?: string | null
          target_graph_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "graph_relations_source_graph_id_fkey"
            columns: ["source_graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "graph_relations_target_graph_id_fkey"
            columns: ["target_graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
        ]
      }
      graph_snapshots: {
        Row: {
          created_at: string
          description: string | null
          edge_count: number
          graph_id: string
          id: string
          node_count: number
          operator_id: string | null
          snapshot_data: Json
          snapshot_type: Database["public"]["Enums"]["graph_snapshot_type"]
        }
        Insert: {
          created_at?: string
          description?: string | null
          edge_count?: number
          graph_id: string
          id?: string
          node_count?: number
          operator_id?: string | null
          snapshot_data?: Json
          snapshot_type?: Database["public"]["Enums"]["graph_snapshot_type"]
        }
        Update: {
          created_at?: string
          description?: string | null
          edge_count?: number
          graph_id?: string
          id?: string
          node_count?: number
          operator_id?: string | null
          snapshot_data?: Json
          snapshot_type?: Database["public"]["Enums"]["graph_snapshot_type"]
        }
        Relationships: [
          {
            foreignKeyName: "graph_snapshots_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
        ]
      }
      installed_plugins: {
        Row: {
          id: string
          installed_at: string
          manifest: Json | null
          plugin_name: string
          state: string
          updated_at: string
          user_id: string
          version: string
        }
        Insert: {
          id?: string
          installed_at?: string
          manifest?: Json | null
          plugin_name: string
          state?: string
          updated_at?: string
          user_id: string
          version: string
        }
        Update: {
          id?: string
          installed_at?: string
          manifest?: Json | null
          plugin_name?: string
          state?: string
          updated_at?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
      knowledge_graph_contents: {
        Row: {
          external_links: Json | null
          graph_id: string
          learning_guide: string | null
          podcast_script: string | null
          reference_books: Json | null
          updated_at: string | null
        }
        Insert: {
          external_links?: Json | null
          graph_id: string
          learning_guide?: string | null
          podcast_script?: string | null
          reference_books?: Json | null
          updated_at?: string | null
        }
        Update: {
          external_links?: Json | null
          graph_id?: string
          learning_guide?: string | null
          podcast_script?: string | null
          reference_books?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_graph_contents_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: true
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_graphs: {
        Row: {
          branch_name: string | null
          branch_source_snapshot_id: string | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          domain: string | null
          embedding: string | null
          id: string
          is_branch: boolean | null
          is_favorite: boolean | null
          is_public: boolean | null
          last_used_at: string | null
          parent_graph_id: string | null
          settings: Json | null
          tags: string[] | null
          task_id: string | null
          template_type: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          branch_name?: string | null
          branch_source_snapshot_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          domain?: string | null
          embedding?: string | null
          id?: string
          is_branch?: boolean | null
          is_favorite?: boolean | null
          is_public?: boolean | null
          last_used_at?: string | null
          parent_graph_id?: string | null
          settings?: Json | null
          tags?: string[] | null
          task_id?: string | null
          template_type?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          branch_name?: string | null
          branch_source_snapshot_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          domain?: string | null
          embedding?: string | null
          id?: string
          is_branch?: boolean | null
          is_favorite?: boolean | null
          is_public?: boolean | null
          last_used_at?: string | null
          parent_graph_id?: string | null
          settings?: Json | null
          tags?: string[] | null
          task_id?: string | null
          template_type?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_graphs_branch_source_snapshot_id_fkey"
            columns: ["branch_source_snapshot_id"]
            isOneToOne: false
            referencedRelation: "graph_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_graphs_parent_graph_id_fkey"
            columns: ["parent_graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_graphs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "user_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_point_versions: {
        Row: {
          change_summary: string | null
          changed_by: string | null
          content: Json | null
          created_at: string | null
          id: string
          keywords: Json | null
          knowledge_point_id: string
          learning_material: Json | null
          properties: Json | null
          summary: Json | null
          title: Json
          version_number: number
        }
        Insert: {
          change_summary?: string | null
          changed_by?: string | null
          content?: Json | null
          created_at?: string | null
          id?: string
          keywords?: Json | null
          knowledge_point_id: string
          learning_material?: Json | null
          properties?: Json | null
          summary?: Json | null
          title: Json
          version_number: number
        }
        Update: {
          change_summary?: string | null
          changed_by?: string | null
          content?: Json | null
          created_at?: string | null
          id?: string
          keywords?: Json | null
          knowledge_point_id?: string
          learning_material?: Json | null
          properties?: Json | null
          summary?: Json | null
          title?: Json
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_point_versions_knowledge_point_id_fkey"
            columns: ["knowledge_point_id"]
            isOneToOne: false
            referencedRelation: "knowledge_points"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_points: {
        Row: {
          aliases: string[] | null
          content: Json | null
          created_at: string | null
          embedding: string | null
          id: string
          keywords: Json | null
          last_study_at: string | null
          learning_material: Json | null
          mastery_level: number | null
          owner_id: string
          properties: Json | null
          source_knowledge_point_id: string | null
          summary: Json | null
          title: Json
          total_study_duration: number | null
          updated_at: string | null
          visibility:
            | Database["public"]["Enums"]["knowledge_point_visibility"]
            | null
        }
        Insert: {
          aliases?: string[] | null
          content?: Json | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          keywords?: Json | null
          last_study_at?: string | null
          learning_material?: Json | null
          mastery_level?: number | null
          owner_id: string
          properties?: Json | null
          source_knowledge_point_id?: string | null
          summary?: Json | null
          title: Json
          total_study_duration?: number | null
          updated_at?: string | null
          visibility?:
            | Database["public"]["Enums"]["knowledge_point_visibility"]
            | null
        }
        Update: {
          aliases?: string[] | null
          content?: Json | null
          created_at?: string | null
          embedding?: string | null
          id?: string
          keywords?: Json | null
          last_study_at?: string | null
          learning_material?: Json | null
          mastery_level?: number | null
          owner_id?: string
          properties?: Json | null
          source_knowledge_point_id?: string | null
          summary?: Json | null
          title?: Json
          total_study_duration?: number | null
          updated_at?: string | null
          visibility?:
            | Database["public"]["Enums"]["knowledge_point_visibility"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_points_source_knowledge_point_id_fkey"
            columns: ["source_knowledge_point_id"]
            isOneToOne: false
            referencedRelation: "knowledge_points"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_loops: {
        Row: {
          config: Json | null
          created_at: string | null
          current_stage: string | null
          current_workflow_stage: string | null
          graph_id: string | null
          id: string
          knowledge_point_id: string | null
          last_stage_change_at: string | null
          loop_count: number | null
          mastery_level: number | null
          study_mode: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          config?: Json | null
          created_at?: string | null
          current_stage?: string | null
          current_workflow_stage?: string | null
          graph_id?: string | null
          id?: string
          knowledge_point_id?: string | null
          last_stage_change_at?: string | null
          loop_count?: number | null
          mastery_level?: number | null
          study_mode?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          config?: Json | null
          created_at?: string | null
          current_stage?: string | null
          current_workflow_stage?: string | null
          graph_id?: string | null
          id?: string
          knowledge_point_id?: string | null
          last_stage_change_at?: string | null
          loop_count?: number | null
          mastery_level?: number | null
          study_mode?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_loops_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_loops_knowledge_point_id_fkey"
            columns: ["knowledge_point_id"]
            isOneToOne: false
            referencedRelation: "knowledge_points"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_material_schemas: {
        Row: {
          created_at: string | null
          description: string | null
          graph_id: string | null
          id: string
          is_default: boolean | null
          name: string
          scope: Database["public"]["Enums"]["prompt_scope"]
          sections: Json
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          graph_id?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          scope: Database["public"]["Enums"]["prompt_scope"]
          sections?: Json
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          graph_id?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          scope?: Database["public"]["Enums"]["prompt_scope"]
          sections?: Json
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_material_schemas_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_path_nodes: {
        Row: {
          completed_at: string | null
          created_at: string | null
          description: string | null
          estimated_time: number | null
          graph_id: string | null
          id: string
          is_milestone: boolean | null
          knowledge_point_id: string | null
          order_index: number
          path_id: string
          prerequisites: string[] | null
          started_at: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          estimated_time?: number | null
          graph_id?: string | null
          id?: string
          is_milestone?: boolean | null
          knowledge_point_id?: string | null
          order_index?: number
          path_id: string
          prerequisites?: string[] | null
          started_at?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          estimated_time?: number | null
          graph_id?: string | null
          id?: string
          is_milestone?: boolean | null
          knowledge_point_id?: string | null
          order_index?: number
          path_id?: string
          prerequisites?: string[] | null
          started_at?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_path_nodes_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_path_nodes_knowledge_point_id_fkey"
            columns: ["knowledge_point_id"]
            isOneToOne: false
            referencedRelation: "knowledge_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_path_nodes_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_path_prerequisites: {
        Row: {
          created_at: string | null
          id: string
          path_node_id: string
          prerequisite_node_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          path_node_id: string
          prerequisite_node_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          path_node_id?: string
          prerequisite_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_path_prerequisites_path_node_id_fkey"
            columns: ["path_node_id"]
            isOneToOne: false
            referencedRelation: "learning_path_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_path_prerequisites_prerequisite_node_id_fkey"
            columns: ["prerequisite_node_id"]
            isOneToOne: false
            referencedRelation: "learning_path_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_path_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          id: string
          node_id: string
          notes: string | null
          path_id: string
          planned_duration: number | null
          planned_nodes: string[] | null
          progress_percentage: number | null
          started_at: string | null
          status: string | null
          time_spent: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          node_id: string
          notes?: string | null
          path_id: string
          planned_duration?: number | null
          planned_nodes?: string[] | null
          progress_percentage?: number | null
          started_at?: string | null
          status?: string | null
          time_spent?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          id?: string
          node_id?: string
          notes?: string | null
          path_id?: string
          planned_duration?: number | null
          planned_nodes?: string[] | null
          progress_percentage?: number | null
          started_at?: string | null
          status?: string | null
          time_spent?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_path_progress_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "learning_path_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_path_progress_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_paths: {
        Row: {
          ai_generated: boolean | null
          created_at: string | null
          daily_minutes_target: number | null
          description: string | null
          domain_id: string | null
          goal: string | null
          id: string
          path_type: string | null
          source_graph_id: string | null
          status: string | null
          target_date: string | null
          title: string
          total_estimated_time: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          ai_generated?: boolean | null
          created_at?: string | null
          daily_minutes_target?: number | null
          description?: string | null
          domain_id?: string | null
          goal?: string | null
          id?: string
          path_type?: string | null
          source_graph_id?: string | null
          status?: string | null
          target_date?: string | null
          title: string
          total_estimated_time?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          ai_generated?: boolean | null
          created_at?: string | null
          daily_minutes_target?: number | null
          description?: string | null
          domain_id?: string | null
          goal?: string | null
          id?: string
          path_type?: string | null
          source_graph_id?: string | null
          status?: string | null
          target_date?: string | null
          title?: string
          total_estimated_time?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_paths_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "domains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_paths_source_graph_id_fkey"
            columns: ["source_graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_session_results: {
        Row: {
          card_id: string
          correct: boolean
          created_at: string | null
          id: string
          session_id: string
          time_spent: number | null
          user_answer: string | null
        }
        Insert: {
          card_id: string
          correct: boolean
          created_at?: string | null
          id?: string
          session_id: string
          time_spent?: number | null
          user_answer?: string | null
        }
        Update: {
          card_id?: string
          correct?: boolean
          created_at?: string | null
          id?: string
          session_id?: string
          time_spent?: number | null
          user_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "learning_session_results_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "study_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_session_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "learning_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_sessions: {
        Row: {
          card_ids: string[] | null
          completed_at: string | null
          correct_count: number | null
          created_at: string | null
          id: string
          knowledge_point_id: string | null
          quiz_set_id: string | null
          score: number | null
          session_type: string
          started_at: string
          status: string | null
          subtask_id: string | null
          total_count: number | null
          total_time_spent: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          card_ids?: string[] | null
          completed_at?: string | null
          correct_count?: number | null
          created_at?: string | null
          id?: string
          knowledge_point_id?: string | null
          quiz_set_id?: string | null
          score?: number | null
          session_type: string
          started_at?: string
          status?: string | null
          subtask_id?: string | null
          total_count?: number | null
          total_time_spent?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          card_ids?: string[] | null
          completed_at?: string | null
          correct_count?: number | null
          created_at?: string | null
          id?: string
          knowledge_point_id?: string | null
          quiz_set_id?: string | null
          score?: number | null
          session_type?: string
          started_at?: string
          status?: string | null
          subtask_id?: string | null
          total_count?: number | null
          total_time_spent?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_sessions_knowledge_point_id_fkey"
            columns: ["knowledge_point_id"]
            isOneToOne: false
            referencedRelation: "knowledge_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_sessions_quiz_set_id_fkey"
            columns: ["quiz_set_id"]
            isOneToOne: false
            referencedRelation: "quiz_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_sessions_subtask_id_fkey"
            columns: ["subtask_id"]
            isOneToOne: false
            referencedRelation: "task_subtasks"
            referencedColumns: ["id"]
          },
        ]
      }
      literature_sources: {
        Row: {
          abstract: string | null
          authors: string[] | null
          created_at: string | null
          doi: string | null
          file_name: string | null
          graph_id: string
          id: string
          issue: string | null
          journal: string | null
          keywords: string[] | null
          notes: string | null
          pages: string | null
          processed_at: string | null
          publisher: string | null
          title: string
          type: string | null
          updated_at: string | null
          url: string | null
          volume: string | null
          year: number | null
        }
        Insert: {
          abstract?: string | null
          authors?: string[] | null
          created_at?: string | null
          doi?: string | null
          file_name?: string | null
          graph_id: string
          id?: string
          issue?: string | null
          journal?: string | null
          keywords?: string[] | null
          notes?: string | null
          pages?: string | null
          processed_at?: string | null
          publisher?: string | null
          title: string
          type?: string | null
          updated_at?: string | null
          url?: string | null
          volume?: string | null
          year?: number | null
        }
        Update: {
          abstract?: string | null
          authors?: string[] | null
          created_at?: string | null
          doi?: string | null
          file_name?: string | null
          graph_id?: string
          id?: string
          issue?: string | null
          journal?: string | null
          keywords?: string[] | null
          notes?: string | null
          pages?: string | null
          processed_at?: string | null
          publisher?: string | null
          title?: string
          type?: string | null
          updated_at?: string | null
          url?: string | null
          volume?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "literature_sources_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
        ]
      }
      note_block_refs: {
        Row: {
          created_at: string
          id: string
          source_block_id: string
          source_note_id: string
          target_block_id: string
          target_note_id: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          source_block_id: string
          source_note_id: string
          target_block_id: string
          target_note_id: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          source_block_id?: string
          source_note_id?: string
          target_block_id?: string
          target_note_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_block_refs_source_note_id_fkey"
            columns: ["source_note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_block_refs_target_note_id_fkey"
            columns: ["target_note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_embeddings: {
        Row: {
          chunk_text: string | null
          created_at: string
          embedding: string
          id: string
          note_id: string
          updated_at: string
        }
        Insert: {
          chunk_text?: string | null
          created_at?: string
          embedding: string
          id?: string
          note_id: string
          updated_at?: string
        }
        Update: {
          chunk_text?: string | null
          created_at?: string
          embedding?: string
          id?: string
          note_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_embeddings_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: true
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_node_links: {
        Row: {
          created_at: string
          graph_id: string
          id: string
          node_id: string
          note_id: string
        }
        Insert: {
          created_at?: string
          graph_id: string
          id?: string
          node_id: string
          note_id: string
        }
        Update: {
          created_at?: string
          graph_id?: string
          id?: string
          node_id?: string
          note_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_node_links_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_node_links_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "graph_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_node_links_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          is_default: boolean
          is_system: boolean
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_default?: boolean
          is_system?: boolean
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_default?: boolean
          is_system?: boolean
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      notes: {
        Row: {
          content: string
          created_at: string
          date: string | null
          deleted_at: string | null
          id: string
          is_archived: boolean
          is_pinned: boolean
          tags: string[] | null
          template_id: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          date?: string | null
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          tags?: string[] | null
          template_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          date?: string | null
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          tags?: string[] | null
          template_id?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "note_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          break_enabled: boolean | null
          browser_enabled: boolean | null
          created_at: string | null
          daily_summary_enabled: boolean | null
          deadline_enabled: boolean | null
          deadline_reminder_minutes: number[] | null
          do_not_disturb_enabled: boolean | null
          do_not_disturb_end: string | null
          do_not_disturb_start: string | null
          id: string
          sound_enabled: boolean | null
          sound_volume: number | null
          task_complete_enabled: boolean | null
          task_start_enabled: boolean | null
          time_slice_end_enabled: boolean | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          break_enabled?: boolean | null
          browser_enabled?: boolean | null
          created_at?: string | null
          daily_summary_enabled?: boolean | null
          deadline_enabled?: boolean | null
          deadline_reminder_minutes?: number[] | null
          do_not_disturb_enabled?: boolean | null
          do_not_disturb_end?: string | null
          do_not_disturb_start?: string | null
          id?: string
          sound_enabled?: boolean | null
          sound_volume?: number | null
          task_complete_enabled?: boolean | null
          task_start_enabled?: boolean | null
          time_slice_end_enabled?: boolean | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          break_enabled?: boolean | null
          browser_enabled?: boolean | null
          created_at?: string | null
          daily_summary_enabled?: boolean | null
          deadline_enabled?: boolean | null
          deadline_reminder_minutes?: number[] | null
          do_not_disturb_enabled?: boolean | null
          do_not_disturb_end?: string | null
          do_not_disturb_start?: string | null
          id?: string
          sound_enabled?: boolean | null
          sound_volume?: number | null
          task_complete_enabled?: boolean | null
          task_start_enabled?: boolean | null
          time_slice_end_enabled?: boolean | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          expires_at: string | null
          id: string
          message: string | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          expires_at?: string | null
          id?: string
          message?: string | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          expires_at?: string | null
          id?: string
          message?: string | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      pass_rewards: {
        Row: {
          achievement_code: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          level: number
          name: string
          period_type: string
          points_required: number
          reward_type: string
          reward_value: number | null
        }
        Insert: {
          achievement_code?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          level: number
          name: string
          period_type: string
          points_required: number
          reward_type: string
          reward_value?: number | null
        }
        Update: {
          achievement_code?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          level?: number
          name?: string
          period_type?: string
          points_required?: number
          reward_type?: string
          reward_value?: number | null
        }
        Relationships: []
      }
      path_node_tasks: {
        Row: {
          created_at: string | null
          id: string
          node_id: string
          path_id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          node_id: string
          path_id: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          node_id?: string
          path_id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "path_node_tasks_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "learning_path_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "path_node_tasks_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "path_node_tasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "user_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      periodic_passes: {
        Row: {
          created_at: string | null
          current_level: number | null
          id: string
          period_end: string
          period_start: string
          period_type: string
          total_points: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_level?: number | null
          id?: string
          period_end: string
          period_start: string
          period_type: string
          total_points?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_level?: number | null
          id?: string
          period_end?: string
          period_start?: string
          period_type?: string
          total_points?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      periodic_tasks: {
        Row: {
          created_at: string | null
          id: string
          pass_points: number
          period_end: string
          period_start: string
          period_type: string
          progress: number | null
          status: string | null
          target: number
          task_type: string
          updated_at: string | null
          user_id: string
          xp_reward: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          pass_points?: number
          period_end: string
          period_start: string
          period_type: string
          progress?: number | null
          status?: string | null
          target: number
          task_type: string
          updated_at?: string | null
          user_id: string
          xp_reward: number
        }
        Update: {
          created_at?: string | null
          id?: string
          pass_points?: number
          period_end?: string
          period_start?: string
          period_type?: string
          progress?: number | null
          status?: string | null
          target?: number
          task_type?: string
          updated_at?: string | null
          user_id?: string
          xp_reward?: number
        }
        Relationships: []
      }
      plugin_ratings: {
        Row: {
          created_at: string
          id: string
          plugin_name: string
          rating: number
          review: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plugin_name: string
          rating: number
          review?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plugin_name?: string
          rating?: number
          review?: string | null
          user_id?: string
        }
        Relationships: []
      }
      prompt_templates: {
        Row: {
          code: string
          created_at: string | null
          graph_id: string | null
          id: string
          scope: Database["public"]["Enums"]["prompt_scope"]
          template_content: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          graph_id?: string | null
          id?: string
          scope: Database["public"]["Enums"]["prompt_scope"]
          template_content: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          graph_id?: string | null
          id?: string
          scope?: Database["public"]["Enums"]["prompt_scope"]
          template_content?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_templates_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
        ]
      }
      queues: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          priority: number
          time_slice: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          priority: number
          time_slice?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          priority?: number
          time_slice?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_set_cards: {
        Row: {
          card_id: string
          created_at: string | null
          display_order: number | null
          id: string
          quiz_set_id: string
        }
        Insert: {
          card_id: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          quiz_set_id: string
        }
        Update: {
          card_id?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          quiz_set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_set_cards_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "study_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_set_cards_quiz_set_id_fkey"
            columns: ["quiz_set_id"]
            isOneToOne: false
            referencedRelation: "quiz_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_sets: {
        Row: {
          card_count: number | null
          config: Json | null
          created_at: string | null
          description: string | null
          graph_id: string | null
          id: string
          status: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          card_count?: number | null
          config?: Json | null
          created_at?: string | null
          description?: string | null
          graph_id?: string | null
          id?: string
          status?: string | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          card_count?: number | null
          config?: Json | null
          created_at?: string | null
          description?: string | null
          graph_id?: string | null
          id?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_sets_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
        ]
      }
      relationship_types: {
        Row: {
          category: string
          color: string
          created_at: string
          display_name: string
          id: string
          is_builtin: boolean
          line_style: string
          name: string
          show_arrow: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: string
          color?: string
          created_at?: string
          display_name: string
          id?: string
          is_builtin?: boolean
          line_style?: string
          name: string
          show_arrow?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          color?: string
          created_at?: string
          display_name?: string
          id?: string
          is_builtin?: boolean
          line_style?: string
          name?: string
          show_arrow?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      revoked_tokens: {
        Row: {
          expires_at: string
          id: string
          revoked_at: string
          token_hash: string
          user_id: string
        }
        Insert: {
          expires_at: string
          id?: string
          revoked_at?: string
          token_hash: string
          user_id: string
        }
        Update: {
          expires_at?: string
          id?: string
          revoked_at?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduler_weight_profiles: {
        Row: {
          auto_adjust_enabled: boolean | null
          chronotype: string | null
          created_at: string | null
          id: string
          last_auto_adjusted_at: string | null
          task_type_time_map: Json | null
          updated_at: string | null
          user_id: string
          weights: Json
        }
        Insert: {
          auto_adjust_enabled?: boolean | null
          chronotype?: string | null
          created_at?: string | null
          id?: string
          last_auto_adjusted_at?: string | null
          task_type_time_map?: Json | null
          updated_at?: string | null
          user_id: string
          weights?: Json
        }
        Update: {
          auto_adjust_enabled?: boolean | null
          chronotype?: string | null
          created_at?: string | null
          id?: string
          last_auto_adjusted_at?: string | null
          task_type_time_map?: Json | null
          updated_at?: string | null
          user_id?: string
          weights?: Json
        }
        Relationships: []
      }
      study_cards: {
        Row: {
          answer: string
          card_type: string | null
          created_at: string | null
          difficulty: number | null
          explanation: string | null
          focus_topic: string | null
          fsrs_difficulty: number | null
          fsrs_elapsed_days: number | null
          fsrs_last_review: string | null
          fsrs_retrievability: number | null
          fsrs_scheduled_days: number | null
          fsrs_stability: number | null
          fsrs_state: string | null
          graph_id: string | null
          id: string
          knowledge_point_id: string | null
          last_rating: number | null
          last_reviewed: string | null
          next_review: string | null
          options: Json | null
          question: string
          quiz_set_id: string | null
          review_count: number | null
          source_graph_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          answer: string
          card_type?: string | null
          created_at?: string | null
          difficulty?: number | null
          explanation?: string | null
          focus_topic?: string | null
          fsrs_difficulty?: number | null
          fsrs_elapsed_days?: number | null
          fsrs_last_review?: string | null
          fsrs_retrievability?: number | null
          fsrs_scheduled_days?: number | null
          fsrs_stability?: number | null
          fsrs_state?: string | null
          graph_id?: string | null
          id?: string
          knowledge_point_id?: string | null
          last_rating?: number | null
          last_reviewed?: string | null
          next_review?: string | null
          options?: Json | null
          question: string
          quiz_set_id?: string | null
          review_count?: number | null
          source_graph_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          answer?: string
          card_type?: string | null
          created_at?: string | null
          difficulty?: number | null
          explanation?: string | null
          focus_topic?: string | null
          fsrs_difficulty?: number | null
          fsrs_elapsed_days?: number | null
          fsrs_last_review?: string | null
          fsrs_retrievability?: number | null
          fsrs_scheduled_days?: number | null
          fsrs_stability?: number | null
          fsrs_state?: string | null
          graph_id?: string | null
          id?: string
          knowledge_point_id?: string | null
          last_rating?: number | null
          last_reviewed?: string | null
          next_review?: string | null
          options?: Json | null
          question?: string
          quiz_set_id?: string | null
          review_count?: number | null
          source_graph_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_cards_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_cards_knowledge_point_id_fkey"
            columns: ["knowledge_point_id"]
            isOneToOne: false
            referencedRelation: "knowledge_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_cards_quiz_set_id_fkey"
            columns: ["quiz_set_id"]
            isOneToOne: false
            referencedRelation: "quiz_sets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_cards_source_graph_id_fkey"
            columns: ["source_graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
        ]
      }
      study_progress: {
        Row: {
          graph_id: string | null
          id: string
          mastered_nodes: number | null
          progress_percentage: number | null
          study_streak: number | null
          total_nodes: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          graph_id?: string | null
          id?: string
          mastered_nodes?: number | null
          progress_percentage?: number | null
          study_streak?: number | null
          total_nodes?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          graph_id?: string | null
          id?: string
          mastered_nodes?: number | null
          progress_percentage?: number | null
          study_streak?: number | null
          total_nodes?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "study_progress_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_operations: {
        Row: {
          action: string
          applied_at: string
          client_op_id: string
          created_at: string
          device_id: string | null
          id: string
          record_id: string
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          applied_at?: string
          client_op_id: string
          created_at?: string
          device_id?: string | null
          id?: string
          record_id: string
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          applied_at?: string
          client_op_id?: string
          created_at?: string
          device_id?: string | null
          id?: string
          record_id?: string
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      system_tasks: {
        Row: {
          claimed_at: string | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          error_message: string | null
          id: string
          input_data: Json | null
          max_retries: number | null
          output_data: Json | null
          priority: number | null
          retry_count: number | null
          runtime_progress: Json | null
          scheduled_at: string | null
          started_at: string | null
          status: string | null
          task_type: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          input_data?: Json | null
          max_retries?: number | null
          output_data?: Json | null
          priority?: number | null
          retry_count?: number | null
          runtime_progress?: Json | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string | null
          task_type: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          error_message?: string | null
          id?: string
          input_data?: Json | null
          max_retries?: number | null
          output_data?: Json | null
          priority?: number | null
          retry_count?: number | null
          runtime_progress?: Json | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string | null
          task_type?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      task_dependencies: {
        Row: {
          created_at: string | null
          dependency_type: string
          depends_on_task_id: string
          id: string
          task_id: string
        }
        Insert: {
          created_at?: string | null
          dependency_type?: string
          depends_on_task_id: string
          id?: string
          task_id: string
        }
        Update: {
          created_at?: string | null
          dependency_type?: string
          depends_on_task_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "user_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "user_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_executions: {
        Row: {
          activity_log: Json | null
          duration: number | null
          ended_at: string | null
          id: string
          knowledge_point_id: string | null
          queue_level: number | null
          stage: string | null
          started_at: string | null
          status: string | null
          subtask_id: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          activity_log?: Json | null
          duration?: number | null
          ended_at?: string | null
          id?: string
          knowledge_point_id?: string | null
          queue_level?: number | null
          stage?: string | null
          started_at?: string | null
          status?: string | null
          subtask_id?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          activity_log?: Json | null
          duration?: number | null
          ended_at?: string | null
          id?: string
          knowledge_point_id?: string | null
          queue_level?: number | null
          stage?: string | null
          started_at?: string | null
          status?: string | null
          subtask_id?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_executions_knowledge_point_id_fkey"
            columns: ["knowledge_point_id"]
            isOneToOne: false
            referencedRelation: "knowledge_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_executions_subtask_id_fkey"
            columns: ["subtask_id"]
            isOneToOne: false
            referencedRelation: "task_subtasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_executions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "user_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_knowledge_points: {
        Row: {
          created_at: string | null
          id: string
          is_primary: boolean | null
          knowledge_point_id: string
          notes: string | null
          relevance_score: number | null
          task_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          knowledge_point_id: string
          notes?: string | null
          relevance_score?: number | null
          task_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_primary?: boolean | null
          knowledge_point_id?: string
          notes?: string | null
          relevance_score?: number | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_knowledge_points_knowledge_point_id_fkey"
            columns: ["knowledge_point_id"]
            isOneToOne: false
            referencedRelation: "knowledge_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_knowledge_points_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "user_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_links: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          link_type: string
          metadata: Json | null
          position: number | null
          task_id: string
          title: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          link_type?: string
          metadata?: Json | null
          position?: number | null
          task_id: string
          title?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          link_type?: string
          metadata?: Json | null
          position?: number | null
          task_id?: string
          title?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "user_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_progress_plans: {
        Row: {
          actual_percentage: number | null
          created_at: string | null
          id: string
          notes: string | null
          plan_date: string
          planned_percentage: number
          status: string | null
          task_id: string
        }
        Insert: {
          actual_percentage?: number | null
          created_at?: string | null
          id?: string
          notes?: string | null
          plan_date: string
          planned_percentage: number
          status?: string | null
          task_id: string
        }
        Update: {
          actual_percentage?: number | null
          created_at?: string | null
          id?: string
          notes?: string | null
          plan_date?: string
          planned_percentage?: number
          status?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_progress_plans_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "user_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_reviews: {
        Row: {
          content: string | null
          created_at: string | null
          difficulties: string | null
          id: string
          improvements: string | null
          learnings: string | null
          mood: string | null
          review_type: string
          task_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          difficulties?: string | null
          id?: string
          improvements?: string | null
          learnings?: string | null
          mood?: string | null
          review_type: string
          task_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string | null
          difficulties?: string | null
          id?: string
          improvements?: string | null
          learnings?: string | null
          mood?: string | null
          review_type?: string
          task_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_reviews_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "user_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_schedules: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          last_run_at: string | null
          next_run_at: string | null
          schedule_config: Json | null
          schedule_type: string
          task_template_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          next_run_at?: string | null
          schedule_config?: Json | null
          schedule_type: string
          task_template_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          next_run_at?: string | null
          schedule_config?: Json | null
          schedule_type?: string
          task_template_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_schedules_task_template_id_fkey"
            columns: ["task_template_id"]
            isOneToOne: false
            referencedRelation: "user_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_settings: {
        Row: {
          break_duration: number | null
          id: string
          notification_enabled: boolean | null
          q0_time_slice: number | null
          q1_time_slice: number | null
          q2_time_slice: number | null
          sound_enabled: boolean | null
          user_id: string
        }
        Insert: {
          break_duration?: number | null
          id?: string
          notification_enabled?: boolean | null
          q0_time_slice?: number | null
          q1_time_slice?: number | null
          q2_time_slice?: number | null
          sound_enabled?: boolean | null
          user_id: string
        }
        Update: {
          break_duration?: number | null
          id?: string
          notification_enabled?: boolean | null
          q0_time_slice?: number | null
          q1_time_slice?: number | null
          q2_time_slice?: number | null
          sound_enabled?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      task_subtasks: {
        Row: {
          actual_duration: number | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          estimated_duration: number | null
          id: string
          knowledge_point_id: string
          last_state_change_at: string | null
          learning_path_node_id: string | null
          learning_state: string | null
          position: number | null
          priority: number | null
          state_history: Json | null
          status: string | null
          task_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          actual_duration?: number | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_duration?: number | null
          id?: string
          knowledge_point_id: string
          last_state_change_at?: string | null
          learning_path_node_id?: string | null
          learning_state?: string | null
          position?: number | null
          priority?: number | null
          state_history?: Json | null
          status?: string | null
          task_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          actual_duration?: number | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          estimated_duration?: number | null
          id?: string
          knowledge_point_id?: string
          last_state_change_at?: string | null
          learning_path_node_id?: string | null
          learning_state?: string | null
          position?: number | null
          priority?: number | null
          state_history?: Json | null
          status?: string | null
          task_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_task_subtasks_learning_path_node"
            columns: ["learning_path_node_id"]
            isOneToOne: false
            referencedRelation: "learning_path_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_subtasks_knowledge_point_id_fkey"
            columns: ["knowledge_point_id"]
            isOneToOne: false
            referencedRelation: "knowledge_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "user_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      task_templates: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          description_template: string | null
          estimated_duration: number | null
          id: string
          is_default: boolean | null
          is_system: boolean | null
          name: string
          priority: number | null
          tags: string[] | null
          title_template: string
          updated_at: string | null
          usage_count: number | null
          user_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string | null
          description_template?: string | null
          estimated_duration?: number | null
          id?: string
          is_default?: boolean | null
          is_system?: boolean | null
          name: string
          priority?: number | null
          tags?: string[] | null
          title_template: string
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          description_template?: string | null
          estimated_duration?: number | null
          id?: string
          is_default?: boolean | null
          is_system?: boolean | null
          name?: string
          priority?: number | null
          tags?: string[] | null
          title_template?: string
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      templates: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          difficulty: string | null
          edges: Json | null
          estimated_nodes: number | null
          generation_config: Json | null
          id: string
          is_system: boolean | null
          layout: Json | null
          name: string
          nodes: Json
          preview_data: Json | null
          tags: string[] | null
          template_type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          edges?: Json | null
          estimated_nodes?: number | null
          generation_config?: Json | null
          id?: string
          is_system?: boolean | null
          layout?: Json | null
          name: string
          nodes: Json
          preview_data?: Json | null
          tags?: string[] | null
          template_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          edges?: Json | null
          estimated_nodes?: number | null
          generation_config?: Json | null
          id?: string
          is_system?: boolean | null
          layout?: Json | null
          name?: string
          nodes?: Json
          preview_data?: Json | null
          tags?: string[] | null
          template_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string | null
          id: string
          metadata: Json | null
          progress: number | null
          unlocked_at: string | null
          user_id: string | null
        }
        Insert: {
          achievement_id?: string | null
          id?: string
          metadata?: Json | null
          progress?: number | null
          unlocked_at?: string | null
          user_id?: string | null
        }
        Update: {
          achievement_id?: string | null
          id?: string
          metadata?: Json | null
          progress?: number | null
          unlocked_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activities: {
        Row: {
          activity_type: string
          created_at: string | null
          description: string | null
          duration: number | null
          ended_at: string | null
          graph_id: string | null
          id: string
          knowledge_point_id: string | null
          metadata: Json | null
          started_at: string
          task_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          description?: string | null
          duration?: number | null
          ended_at?: string | null
          graph_id?: string | null
          id?: string
          knowledge_point_id?: string | null
          metadata?: Json | null
          started_at?: string
          task_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          description?: string | null
          duration?: number | null
          ended_at?: string | null
          graph_id?: string | null
          id?: string
          knowledge_point_id?: string | null
          metadata?: Json | null
          started_at?: string
          task_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_activities_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_activities_knowledge_point_id_fkey"
            columns: ["knowledge_point_id"]
            isOneToOne: false
            referencedRelation: "knowledge_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_activities_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "user_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_efficiency_profile: {
        Row: {
          hourly_efficiency: Json | null
          id: string
          last_updated: string | null
          low_hours: number[] | null
          peak_hours: number[] | null
          queue_efficiency: Json | null
          tag_efficiency: Json | null
          user_id: string
        }
        Insert: {
          hourly_efficiency?: Json | null
          id?: string
          last_updated?: string | null
          low_hours?: number[] | null
          peak_hours?: number[] | null
          queue_efficiency?: Json | null
          tag_efficiency?: Json | null
          user_id: string
        }
        Update: {
          hourly_efficiency?: Json | null
          id?: string
          last_updated?: string | null
          low_hours?: number[] | null
          peak_hours?: number[] | null
          queue_efficiency?: Json | null
          tag_efficiency?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      user_focus_stats: {
        Row: {
          created_at: string | null
          current_streak: number | null
          daily_task_streak: number | null
          id: string
          last_daily_completion: string | null
          last_focus_date: string | null
          longest_streak: number | null
          monthly_streak: number | null
          quarterly_streak: number | null
          total_focus_seconds: number | null
          total_pomodoros: number | null
          total_sessions: number | null
          total_tasks_completed: number | null
          updated_at: string | null
          user_id: string
          weekly_streak: number | null
        }
        Insert: {
          created_at?: string | null
          current_streak?: number | null
          daily_task_streak?: number | null
          id?: string
          last_daily_completion?: string | null
          last_focus_date?: string | null
          longest_streak?: number | null
          monthly_streak?: number | null
          quarterly_streak?: number | null
          total_focus_seconds?: number | null
          total_pomodoros?: number | null
          total_sessions?: number | null
          total_tasks_completed?: number | null
          updated_at?: string | null
          user_id: string
          weekly_streak?: number | null
        }
        Update: {
          created_at?: string | null
          current_streak?: number | null
          daily_task_streak?: number | null
          id?: string
          last_daily_completion?: string | null
          last_focus_date?: string | null
          longest_streak?: number | null
          monthly_streak?: number | null
          quarterly_streak?: number | null
          total_focus_seconds?: number | null
          total_pomodoros?: number | null
          total_sessions?: number | null
          total_tasks_completed?: number | null
          updated_at?: string | null
          user_id?: string
          weekly_streak?: number | null
        }
        Relationships: []
      }
      user_pass_progress: {
        Row: {
          claimed: boolean | null
          claimed_at: string | null
          created_at: string | null
          id: string
          level: number
          pass_id: string
          user_id: string
        }
        Insert: {
          claimed?: boolean | null
          claimed_at?: string | null
          created_at?: string | null
          id?: string
          level: number
          pass_id: string
          user_id: string
        }
        Update: {
          claimed?: boolean | null
          claimed_at?: string | null
          created_at?: string | null
          id?: string
          level?: number
          pass_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pass_progress_pass_id_fkey"
            columns: ["pass_id"]
            isOneToOne: false
            referencedRelation: "periodic_passes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_tasks: {
        Row: {
          actual_duration: number | null
          completed_at: string | null
          context: Json | null
          created_at: string | null
          deadline: string | null
          deleted_at: string | null
          description: string | null
          estimated_duration: number | null
          graph_id: string | null
          id: string
          knowledge_point_id: string | null
          notes: string | null
          parent_task_id: string | null
          position: number
          priority: number | null
          progress_mode: string | null
          progress_percentage: number | null
          queue_id: string | null
          queue_level: number | null
          scheduled_end: string | null
          scheduled_start: string | null
          source: string | null
          status: string | null
          tags: string[] | null
          task_type: string | null
          title: string
          total_duration: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          actual_duration?: number | null
          completed_at?: string | null
          context?: Json | null
          created_at?: string | null
          deadline?: string | null
          deleted_at?: string | null
          description?: string | null
          estimated_duration?: number | null
          graph_id?: string | null
          id?: string
          knowledge_point_id?: string | null
          notes?: string | null
          parent_task_id?: string | null
          position?: number
          priority?: number | null
          progress_mode?: string | null
          progress_percentage?: number | null
          queue_id?: string | null
          queue_level?: number | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          task_type?: string | null
          title: string
          total_duration?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          actual_duration?: number | null
          completed_at?: string | null
          context?: Json | null
          created_at?: string | null
          deadline?: string | null
          deleted_at?: string | null
          description?: string | null
          estimated_duration?: number | null
          graph_id?: string | null
          id?: string
          knowledge_point_id?: string | null
          notes?: string | null
          parent_task_id?: string | null
          position?: number
          priority?: number | null
          progress_mode?: string | null
          progress_percentage?: number | null
          queue_id?: string | null
          queue_level?: number | null
          scheduled_end?: string | null
          scheduled_start?: string | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          task_type?: string | null
          title?: string
          total_duration?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_tasks_graph_id_fkey"
            columns: ["graph_id"]
            isOneToOne: false
            referencedRelation: "knowledge_graphs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tasks_knowledge_point_id_fkey"
            columns: ["knowledge_point_id"]
            isOneToOne: false
            referencedRelation: "knowledge_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "user_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_tasks_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "queues"
            referencedColumns: ["id"]
          },
        ]
      }
      user_time_slots: {
        Row: {
          created_at: string | null
          day_of_week: number | null
          end_time: string
          id: string
          is_available: boolean | null
          label: string | null
          start_time: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          day_of_week?: number | null
          end_time: string
          id?: string
          is_available?: boolean | null
          label?: string | null
          start_time: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: number | null
          end_time?: string
          id?: string
          is_available?: boolean | null
          label?: string | null
          start_time?: string
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          level: number | null
          name: string | null
          password_hash: string | null
          plan: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          settings: Json | null
          updated_at: string | null
          xp: number | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          level?: number | null
          name?: string | null
          password_hash?: string | null
          plan?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          settings?: Json | null
          updated_at?: string | null
          xp?: number | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          level?: number | null
          name?: string | null
          password_hash?: string | null
          plan?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          settings?: Json | null
          updated_at?: string | null
          xp?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      pg_all_foreign_keys: {
        Row: {
          fk_columns: unknown[] | null
          fk_constraint_name: unknown
          fk_schema_name: unknown
          fk_table_name: unknown
          fk_table_oid: unknown
          is_deferrable: boolean | null
          is_deferred: boolean | null
          match_type: string | null
          on_delete: string | null
          on_update: string | null
          pk_columns: unknown[] | null
          pk_constraint_name: unknown
          pk_index_name: unknown
          pk_schema_name: unknown
          pk_table_name: unknown
          pk_table_oid: unknown
        }
        Relationships: []
      }
      tap_funky: {
        Row: {
          args: string | null
          is_definer: boolean | null
          is_strict: boolean | null
          is_visible: boolean | null
          kind: unknown
          langoid: unknown
          name: unknown
          oid: unknown
          owner: unknown
          returns: string | null
          returns_set: boolean | null
          schema: unknown
          volatility: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _cleanup: { Args: never; Returns: boolean }
      _contract_on: { Args: { "": string }; Returns: unknown }
      _currtest: { Args: never; Returns: number }
      _db_privs: { Args: never; Returns: unknown[] }
      _extensions: { Args: never; Returns: unknown[] }
      _get: { Args: { "": string }; Returns: number }
      _get_latest: { Args: { "": string }; Returns: number[] }
      _get_note: { Args: { "": string }; Returns: string }
      _is_verbose: { Args: never; Returns: boolean }
      _prokind: { Args: { p_oid: unknown }; Returns: unknown }
      _query: { Args: { "": string }; Returns: string }
      _refine_vol: { Args: { "": string }; Returns: string }
      _retval: { Args: { "": string }; Returns: string }
      _table_privs: { Args: never; Returns: unknown[] }
      _temptypes: { Args: { "": string }; Returns: string }
      _todo: { Args: never; Returns: string }
      batch_permanent_delete_graphs: {
        Args: { p_graph_ids: string[]; p_user_id: string }
        Returns: Json
      }
      batch_remove_nodes_with_edges: {
        Args: { p_graph_id: string; p_graph_node_ids: string[] }
        Returns: Json
      }
      batch_soft_delete_graphs: {
        Args: { p_graph_ids: string[]; p_user_id: string }
        Returns: Json
      }
      batch_update_positions: {
        Args: {
          p_ids: string[]
          p_x_positions: number[]
          p_y_positions: number[]
        }
        Returns: undefined
      }
      check_duplicate_graph_topic: {
        Args: {
          p_exclude_graph_id?: string
          p_threshold?: number
          p_topic: string
          p_user_id: string
        }
        Returns: {
          is_duplicate: boolean
          similar_graph_id: string
          similar_graph_title: string
          similarity: number
        }[]
      }
      col_is_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      col_not_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
      complete_task_with_execution: {
        Args: { p_task_id: string; p_user_id: string }
        Returns: {
          execution_duration: number
          execution_id: string
          task_id: string
          task_status: string
        }[]
      }
      create_edge: {
        Args: {
          p_custom_color?: string
          p_custom_label?: string
          p_custom_line_style?: string
          p_graph_id: string
          p_relationship_type?: string
          p_show_arrow?: boolean
          p_source_knowledge_point_id: string
          p_target_knowledge_point_id: string
          p_weight?: number
        }
        Returns: Json
      }
      create_knowledge_point_with_node: {
        Args: {
          p_content?: string
          p_graph_id: string
          p_level?: string
          p_properties?: Json
          p_title: string
          p_user_id: string
          p_x_position?: number
          p_y_position?: number
        }
        Returns: Json
      }
      diag:
        | {
            Args: { msg: unknown }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { msg: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      diag_test_name: { Args: { "": string }; Returns: string }
      do_tap:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      fail:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      find_missing_connections: {
        Args: { p_graph_id: string; p_max_suggestions?: number }
        Returns: {
          score: number
          source_id: string
          source_level: string
          target_id: string
          target_level: string
        }[]
      }
      findfuncs: { Args: { "": string }; Returns: string[] }
      finish: { Args: { exception_on_failure?: boolean }; Returns: string[] }
      format_type_string: { Args: { "": string }; Returns: string }
      get_accessible_knowledge_points: {
        Args: { p_user_id: string }
        Returns: {
          content: string
          created_at: string
          id: string
          keywords: Json
          learning_material: Json
          owner_id: string
          properties: Json
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["knowledge_point_visibility"]
        }[]
      }
      get_graph_map_data: { Args: { p_user_id: string }; Returns: Json }
      get_knowledge_point_graphs: {
        Args: { p_knowledge_point_id: string; p_user_id: string }
        Returns: {
          graph_id: string
          graph_title: string
          level: string
          x_position: number
          y_position: number
        }[]
      }
      get_user_graph_tags: {
        Args: { p_user_id: string }
        Returns: {
          count: number
          name: string
        }[]
      }
      get_user_graphs_with_counts: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          deleted_at: string
          description: string
          id: string
          is_favorite: boolean
          is_public: boolean
          last_used_at: string
          nodes_count: number
          tags: string[]
          template_type: string
          title: string
          updated_at: string
          user_id: string
        }[]
      }
      get_user_study_stats: { Args: { p_user_id: string }; Returns: Json }
      get_user_trashed_graphs: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          deleted_at: string
          description: string
          id: string
          is_public: boolean
          nodes_count: number
          template_type: string
          title: string
          updated_at: string
          user_id: string
        }[]
      }
      graph_traverse_neighbors: {
        Args: {
          p_graph_id: string
          p_max_hops?: number
          p_relationship_types?: string[]
          p_source_ids: string[]
        }
        Returns: {
          content: string
          hop_distance: number
          knowledge_point_id: string
          relationship_path: string
          relationship_type: string
          title: string
        }[]
      }
      hard_delete_knowledge_point: {
        Args: { p_knowledge_point_id: string; p_user_id: string }
        Returns: Json
      }
      has_unique: { Args: { "": string }; Returns: string }
      in_todo: { Args: never; Returns: boolean }
      is_empty: { Args: { "": string }; Returns: string }
      is_graph_collaborator: {
        Args: { p_graph_id: string; p_user_id: string }
        Returns: boolean
      }
      isnt_empty: { Args: { "": string }; Returns: string }
      lives_ok: { Args: { "": string }; Returns: string }
      match_document_chunks: {
        Args: {
          match_count: number
          match_threshold: number
          p_graph_id?: string
          p_user_id: string
          query_embedding: string
        }
        Returns: {
          chunk_index: number
          content: string
          id: string
          knowledge_point_id: string
          similarity: number
        }[]
      }
      match_knowledge_points: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_user_id?: string
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
          title: string
        }[]
      }
      match_knowledge_points_by_graph: {
        Args: {
          match_count: number
          match_threshold: number
          p_graph_id: string
          p_user_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
          title: string
        }[]
      }
      match_notes: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_user_id?: string
          query_embedding: string
        }
        Returns: {
          chunk_text: string
          id: string
          note_id: string
          similarity: number
          title: string
        }[]
      }
      merge_user_tags: {
        Args: { p_sources: string[]; p_target: string; p_user_id: string }
        Returns: Json
      }
      no_plan: { Args: never; Returns: boolean[] }
      num_failed: { Args: never; Returns: number }
      os_name: { Args: never; Returns: string }
      pass:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      permanent_delete_graph: {
        Args: { p_graph_id: string; p_user_id: string }
        Returns: Json
      }
      pg_version: { Args: never; Returns: string }
      pg_version_num: { Args: never; Returns: number }
      pgtap_version: { Args: never; Returns: number }
      remove_node_with_edges: {
        Args: { p_graph_id: string; p_graph_node_id: string }
        Returns: Json
      }
      remove_user_tag: {
        Args: { p_name: string; p_user_id: string }
        Returns: Json
      }
      rename_user_tag: {
        Args: { p_from: string; p_to: string; p_user_id: string }
        Returns: Json
      }
      reorder_tasks: {
        Args: { p_queue_level: number; p_task_ids: string[]; p_user_id: string }
        Returns: number
      }
      runtests:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      search_similar_graphs: {
        Args: {
          p_exclude_graph_id?: string
          p_match_count?: number
          p_match_threshold?: number
          p_query_embedding: string
          p_user_id: string
        }
        Returns: {
          description: string
          id: string
          similarity: number
          title: string
        }[]
      }
      search_similar_knowledge_points: {
        Args: {
          p_match_count?: number
          p_match_threshold?: number
          p_query_embedding: string
          p_user_id: string
        }
        Returns: {
          content: string
          id: string
          similarity: number
          title: string
          visibility: Database["public"]["Enums"]["knowledge_point_visibility"]
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      skip:
        | { Args: { "": string }; Returns: string }
        | { Args: { how_many: number; why: string }; Returns: string }
      soft_delete_graph_node: {
        Args: { p_graph_node_id: string; p_user_id: string }
        Returns: boolean
      }
      soft_delete_graph_with_branches: {
        Args: { p_graph_id: string; p_user_id: string }
        Returns: Json
      }
      start_task_with_execution: {
        Args: { p_task_id: string; p_user_id: string }
        Returns: {
          execution_id: string
          execution_started_at: string
          task_id: string
          task_queue_level: number
          task_status: string
        }[]
      }
      throws_ok: { Args: { "": string }; Returns: string }
      todo:
        | { Args: { how_many: number }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
        | { Args: { why: string }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
      todo_end: { Args: never; Returns: boolean[] }
      todo_start:
        | { Args: never; Returns: boolean[] }
        | { Args: { "": string }; Returns: boolean[] }
      truncate_table: { Args: { table_name: string }; Returns: undefined }
    }
    Enums: {
      collaborator_role: "owner" | "editor" | "viewer"
      graph_event_type:
        | "node_created"
        | "node_updated"
        | "node_deleted"
        | "edge_created"
        | "edge_updated"
        | "edge_deleted"
        | "graph_updated"
        | "graph_rollback"
        | "graph_branch_created"
        | "graph_merged"
      graph_snapshot_type:
        | "auto"
        | "manual"
        | "pre_rollback"
        | "pre_ai_expand"
        | "pre_batch_delete"
      knowledge_point_visibility: "private" | "public" | "pending"
      prompt_scope: "system" | "user" | "graph"
      user_role: "user" | "admin"
    }
    CompositeTypes: {
      _time_trial_type: {
        a_time: number | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      collaborator_role: ["owner", "editor", "viewer"],
      graph_event_type: [
        "node_created",
        "node_updated",
        "node_deleted",
        "edge_created",
        "edge_updated",
        "edge_deleted",
        "graph_updated",
        "graph_rollback",
        "graph_branch_created",
        "graph_merged",
      ],
      graph_snapshot_type: [
        "auto",
        "manual",
        "pre_rollback",
        "pre_ai_expand",
        "pre_batch_delete",
      ],
      knowledge_point_visibility: ["private", "public", "pending"],
      prompt_scope: ["system", "user", "graph"],
      user_role: ["user", "admin"],
    },
  },
} as const

