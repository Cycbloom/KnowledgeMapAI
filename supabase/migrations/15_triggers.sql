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

-- Auto-create queues for new users
CREATE OR REPLACE TRIGGER on_user_created_queues
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_task_settings();

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

CREATE TRIGGER update_relationship_types_updated_at
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

CREATE TRIGGER trigger_update_task_reviews_updated_at
  BEFORE UPDATE ON task_reviews
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER periodic_tasks_updated_at
  BEFORE UPDATE ON periodic_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER periodic_passes_updated_at
  BEFORE UPDATE ON periodic_passes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_review_tasks_updated_at
  BEFORE UPDATE ON knowledge_review_tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_efficiency_profile_updated_at
  BEFORE UPDATE ON user_efficiency_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
