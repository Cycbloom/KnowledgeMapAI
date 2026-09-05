-- =====================================================
-- Knowledge Map - Triggers
-- =====================================================

-- Auth user created -> sync to public.users + notification settings
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Knowledge point version snapshot on insert/update
CREATE OR REPLACE TRIGGER on_knowledge_point_change
  AFTER INSERT OR UPDATE ON knowledge_points
  FOR EACH ROW EXECUTE FUNCTION create_knowledge_point_version();

-- Auto-create task settings for new users
CREATE OR REPLACE TRIGGER on_user_created_task_settings
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_task_settings();

-- Updated_at triggers (all use update_updated_at_column)
CREATE TRIGGER user_tasks_updated_at
  BEFORE UPDATE ON user_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER queues_updated_at
  BEFORE UPDATE ON queues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER relationship_types_updated_at
  BEFORE UPDATE ON relationship_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Focus session created -> update user focus stats
CREATE TRIGGER on_focus_session_created
  AFTER INSERT ON focus_sessions
  FOR EACH ROW
  WHEN (NEW.is_break = FALSE OR NEW.is_break IS NULL)
  EXECUTE FUNCTION update_user_focus_stats();

-- Task completed -> update stats
CREATE TRIGGER on_task_completed
  AFTER UPDATE ON user_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_stats_on_task_complete();

-- Updated_at triggers for various tables
CREATE TRIGGER user_focus_stats_updated_at
  BEFORE UPDATE ON user_focus_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER task_templates_updated_at
  BEFORE UPDATE ON task_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER task_reviews_updated_at
  BEFORE UPDATE ON task_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER periodic_tasks_updated_at
  BEFORE UPDATE ON periodic_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER periodic_passes_updated_at
  BEFORE UPDATE ON periodic_passes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER user_efficiency_profile_updated_at
  BEFORE UPDATE ON user_efficiency_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER scheduler_weight_profiles_updated_at
  BEFORE UPDATE ON scheduler_weight_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER knowledge_graphs_updated_at
  BEFORE UPDATE ON knowledge_graphs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER knowledge_graph_contents_updated_at
  BEFORE UPDATE ON knowledge_graph_contents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER knowledge_points_updated_at
  BEFORE UPDATE ON knowledge_points
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER graph_nodes_updated_at
  BEFORE UPDATE ON graph_nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER edges_updated_at
  BEFORE UPDATE ON edges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER domains_updated_at
  BEFORE UPDATE ON domains
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER learning_paths_updated_at
  BEFORE UPDATE ON learning_paths
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER learning_path_nodes_updated_at
  BEFORE UPDATE ON learning_path_nodes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER learning_path_progress_updated_at
  BEFORE UPDATE ON learning_path_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER backup_snapshots_updated_at
  BEFORE UPDATE ON backup_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER ai_actions_updated_at
  BEFORE UPDATE ON ai_actions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER learning_loops_updated_at
  BEFORE UPDATE ON learning_loops
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER task_executions_updated_at
  BEFORE UPDATE ON task_executions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER task_links_updated_at
  BEFORE UPDATE ON task_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER task_knowledge_points_updated_at
  BEFORE UPDATE ON task_knowledge_points
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER task_subtasks_updated_at
  BEFORE UPDATE ON task_subtasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER quiz_sets_updated_at
  BEFORE UPDATE ON quiz_sets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER quiz_set_cards_updated_at
  BEFORE UPDATE ON quiz_set_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- study_cards: keep updated_at in sync on review (fsrs_*/last_reviewed/next_review changes)
DROP TRIGGER IF EXISTS study_cards_updated_at ON study_cards;
CREATE TRIGGER study_cards_updated_at
  BEFORE UPDATE ON study_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 新用户创建时自动初始化默认队列（函数定义见 14_functions.sql）
DROP TRIGGER IF EXISTS on_user_created_queues ON users;
CREATE TRIGGER on_user_created_queues
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION create_default_queues_for_user();

-- ==== from 13_plugin_marketplace.sql ====
CREATE TRIGGER installed_plugins_updated_at
  BEFORE UPDATE ON installed_plugins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==== from 14_practice_quiz_sessions.sql ====
-- Triggers (在 15_triggers.sql 之后执行，需在此创建以避免迁移顺序问题)
CREATE TRIGGER learning_sessions_updated_at
  BEFORE UPDATE ON learning_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==== from 15_system_tasks.sql ====
-- Trigger: auto-update updated_at
CREATE TRIGGER system_tasks_updated_at
  BEFORE UPDATE ON system_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==== from 19_agent_sessions.sql ====
-- Triggers
-- 自动更新 updated_at
CREATE TRIGGER trg_agent_sessions_updated_at
  BEFORE UPDATE ON agent_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- ==== from 22_notes.sql ====
DROP TRIGGER IF EXISTS notes_updated_at ON notes;
CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS note_templates_updated_at ON note_templates;
CREATE TRIGGER note_templates_updated_at
  BEFORE UPDATE ON note_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==== from 23_notes_embedding.sql ====
DROP TRIGGER IF EXISTS note_embeddings_updated_at ON note_embeddings;
CREATE TRIGGER note_embeddings_updated_at
  BEFORE UPDATE ON note_embeddings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ==== from 27_literature_sources.sql ====
DROP TRIGGER IF EXISTS on_update_literature_sources ON literature_sources;
CREATE TRIGGER on_update_literature_sources
  BEFORE UPDATE ON literature_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
