-- =====================================================
-- Knowledge Map - Grants
-- =====================================================

-- service_role bypasses RLS but still needs explicit table/sequence/function privileges.
-- ALTER DEFAULT PRIVILEGES in 00_extensions_and_types.sql covers tables created
-- after that migration, but this blanket grant is a safety net for any tables
-- that might have been created before default privileges were set.
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Core tables
GRANT ALL PRIVILEGES ON users TO authenticated;
GRANT SELECT ON knowledge_graphs TO authenticated;
GRANT ALL PRIVILEGES ON knowledge_graphs TO authenticated;
GRANT SELECT ON knowledge_graph_contents TO authenticated;
GRANT ALL PRIVILEGES ON knowledge_graph_contents TO authenticated;
GRANT SELECT ON knowledge_points TO authenticated;
GRANT ALL PRIVILEGES ON knowledge_points TO authenticated;
GRANT SELECT ON knowledge_point_versions TO authenticated;
GRANT ALL PRIVILEGES ON knowledge_point_versions TO authenticated;
GRANT SELECT ON graph_nodes TO authenticated;
GRANT ALL PRIVILEGES ON graph_nodes TO authenticated;
GRANT SELECT ON edges TO authenticated;
GRANT ALL PRIVILEGES ON edges TO authenticated;

-- Study & Quiz
GRANT SELECT ON study_cards TO authenticated;
GRANT ALL PRIVILEGES ON study_cards TO authenticated;
GRANT SELECT ON quiz_sets TO authenticated;
GRANT ALL PRIVILEGES ON quiz_sets TO authenticated;
GRANT SELECT ON quiz_set_cards TO authenticated;
GRANT ALL PRIVILEGES ON quiz_set_cards TO authenticated;
GRANT SELECT ON study_progress TO authenticated;
GRANT ALL PRIVILEGES ON study_progress TO authenticated;

-- Templates & Settings
GRANT SELECT ON templates TO authenticated;
GRANT ALL PRIVILEGES ON templates TO authenticated;
GRANT ALL PRIVILEGES ON backup_snapshots TO authenticated;

-- Collaboration
GRANT ALL PRIVILEGES ON graph_collaborators TO authenticated;
GRANT SELECT ON graph_collaborators TO authenticated;

-- Tables created in later migrations (graph_snapshots, notes, audit_logs, etc.)
-- must be granted here defensively. Since some of these tables are created AFTER
-- this grants migration, use an existence-checked DO block so the reset applies
-- cleanly regardless of ordering.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'graph_snapshots', 'graph_events',
    'notes', 'note_node_links', 'note_templates',
    'notifications', 'notification_settings',
    'audit_logs'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = t AND n.nspname = 'public'
    ) THEN
      EXECUTE format('GRANT ALL PRIVILEGES ON %I TO authenticated', t);
      EXECUTE format('GRANT SELECT ON %I TO authenticated', t);
    END IF;
  END LOOP;
END $$;

-- audit_logs is written by the service_role (already covered by the blanket
-- service_role grant above), authenticated read is granted via the DO block.

-- Scheduler
GRANT ALL PRIVILEGES ON user_tasks TO authenticated;
GRANT SELECT ON user_tasks TO authenticated;
GRANT ALL PRIVILEGES ON task_executions TO authenticated;
GRANT SELECT ON task_executions TO authenticated;
GRANT ALL PRIVILEGES ON task_tags TO authenticated;
GRANT SELECT ON task_tags TO authenticated;
GRANT ALL PRIVILEGES ON task_settings TO authenticated;
GRANT SELECT ON task_settings TO authenticated;
GRANT ALL PRIVILEGES ON queues TO authenticated;
GRANT SELECT ON queues TO authenticated;

-- Focus & Achievements
GRANT ALL PRIVILEGES ON focus_sessions TO authenticated;
GRANT SELECT ON focus_sessions TO authenticated;
GRANT ALL PRIVILEGES ON user_achievements TO authenticated;
GRANT SELECT ON user_achievements TO authenticated;
GRANT ALL PRIVILEGES ON user_focus_stats TO authenticated;
GRANT SELECT ON user_focus_stats TO authenticated;
GRANT SELECT ON achievements TO authenticated;
-- achievements is a public lookup table (RLS: "Anyone can view achievements")
GRANT SELECT ON achievements TO anon;

-- Task templates
GRANT ALL PRIVILEGES ON task_templates TO authenticated;
GRANT SELECT ON task_templates TO authenticated;

-- Periodic system
GRANT ALL PRIVILEGES ON periodic_tasks TO authenticated;
GRANT SELECT ON periodic_tasks TO authenticated;
GRANT ALL PRIVILEGES ON periodic_passes TO authenticated;
GRANT SELECT ON periodic_passes TO authenticated;
GRANT ALL PRIVILEGES ON user_pass_progress TO authenticated;
GRANT SELECT ON user_pass_progress TO authenticated;
GRANT SELECT ON pass_rewards TO authenticated;
-- pass_rewards is a public lookup table (RLS: "Anyone can view pass rewards")
GRANT SELECT ON pass_rewards TO anon;

-- Task management
GRANT ALL PRIVILEGES ON task_dependencies TO authenticated;
GRANT SELECT ON task_dependencies TO authenticated;
GRANT ALL PRIVILEGES ON task_schedules TO authenticated;
GRANT SELECT ON task_schedules TO authenticated;
GRANT ALL PRIVILEGES ON task_progress_plans TO authenticated;
GRANT SELECT ON task_progress_plans TO authenticated;
GRANT ALL PRIVILEGES ON user_time_slots TO authenticated;
GRANT SELECT ON user_time_slots TO authenticated;

-- Knowledge & Efficiency
GRANT ALL PRIVILEGES ON user_efficiency_profile TO authenticated;
GRANT SELECT ON user_efficiency_profile TO authenticated;
GRANT ALL PRIVILEGES ON scheduler_weight_profiles TO authenticated;
GRANT SELECT ON scheduler_weight_profiles TO authenticated;
GRANT ALL PRIVILEGES ON path_node_tasks TO authenticated;
GRANT SELECT ON path_node_tasks TO authenticated;

-- Grant execute permissions on business functions
GRANT EXECUTE ON FUNCTION get_user_graphs_with_counts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_trashed_graphs(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION batch_update_positions(UUID[], INTEGER[], INTEGER[]) TO authenticated;
GRANT EXECUTE ON FUNCTION match_knowledge_points(vector(1024), float, int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION match_knowledge_points_by_graph(vector(1024), float, int, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION match_document_chunks(vector(1024), float, int, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_accessible_knowledge_points(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION search_similar_knowledge_points(vector(1024), UUID, FLOAT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_knowledge_point_graphs(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_graph_node(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION hard_delete_knowledge_point(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION search_similar_graphs(vector(1024), UUID, FLOAT, INT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_study_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_duplicate_graph_topic(VARCHAR(255), UUID, FLOAT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_graph_collaborator(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION graph_traverse_neighbors(uuid, uuid[], int, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION create_edge(UUID, UUID, UUID, VARCHAR, FLOAT, VARCHAR, VARCHAR, VARCHAR, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_graph_tags(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_graph_map_data(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION find_missing_connections(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION rename_user_tag(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION merge_user_tags(UUID, TEXT[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_user_tag(UUID, TEXT) TO authenticated;
