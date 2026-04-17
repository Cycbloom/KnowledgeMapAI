-- =====================================================
-- Knowledge Map - Grants
-- =====================================================

-- Core tables
GRANT SELECT ON users TO anon;
GRANT ALL PRIVILEGES ON users TO authenticated;
GRANT SELECT ON knowledge_graphs TO anon;
GRANT ALL PRIVILEGES ON knowledge_graphs TO authenticated;
GRANT SELECT ON knowledge_points TO anon;
GRANT ALL PRIVILEGES ON knowledge_points TO authenticated;
GRANT SELECT ON knowledge_point_versions TO anon;
GRANT ALL PRIVILEGES ON knowledge_point_versions TO authenticated;
GRANT SELECT ON graph_nodes TO anon;
GRANT ALL PRIVILEGES ON graph_nodes TO authenticated;
GRANT SELECT ON edges TO anon;
GRANT ALL PRIVILEGES ON edges TO authenticated;

-- Study & Quiz
GRANT SELECT ON study_cards TO anon;
GRANT ALL PRIVILEGES ON study_cards TO authenticated;
GRANT SELECT ON quiz_sets TO anon;
GRANT ALL PRIVILEGES ON quiz_sets TO authenticated;
GRANT SELECT ON quiz_set_cards TO anon;
GRANT ALL PRIVILEGES ON quiz_set_cards TO authenticated;
GRANT SELECT ON study_progress TO anon;
GRANT ALL PRIVILEGES ON study_progress TO authenticated;

-- Templates & Settings
GRANT SELECT ON templates TO anon;
GRANT ALL PRIVILEGES ON templates TO authenticated;
GRANT ALL PRIVILEGES ON backup_snapshots TO authenticated;

-- Collaboration
GRANT ALL PRIVILEGES ON graph_collaborators TO authenticated;
GRANT SELECT ON graph_collaborators TO anon;

-- Scheduler
GRANT ALL PRIVILEGES ON scheduled_tasks TO authenticated;
GRANT SELECT ON scheduled_tasks TO anon;
GRANT ALL PRIVILEGES ON task_executions TO authenticated;
GRANT SELECT ON task_executions TO anon;
GRANT ALL PRIVILEGES ON task_tags TO authenticated;
GRANT SELECT ON task_tags TO anon;
GRANT ALL PRIVILEGES ON task_settings TO authenticated;
GRANT SELECT ON task_settings TO anon;
GRANT ALL PRIVILEGES ON queues TO authenticated;
GRANT SELECT ON queues TO anon;

-- Focus & Achievements
GRANT ALL PRIVILEGES ON focus_sessions TO authenticated;
GRANT SELECT ON focus_sessions TO anon;
GRANT ALL PRIVILEGES ON user_achievements TO authenticated;
GRANT SELECT ON user_achievements TO anon;
GRANT ALL PRIVILEGES ON user_focus_stats TO authenticated;
GRANT SELECT ON user_focus_stats TO anon;
GRANT SELECT ON achievements TO authenticated;
GRANT SELECT ON achievements TO anon;

-- Task templates
GRANT ALL PRIVILEGES ON task_templates TO authenticated;
GRANT SELECT ON task_templates TO anon;

-- Periodic system
GRANT ALL PRIVILEGES ON periodic_tasks TO authenticated;
GRANT SELECT ON periodic_tasks TO anon;
GRANT ALL PRIVILEGES ON periodic_passes TO authenticated;
GRANT SELECT ON periodic_passes TO anon;
GRANT ALL PRIVILEGES ON user_pass_progress TO authenticated;
GRANT SELECT ON user_pass_progress TO anon;
GRANT SELECT ON pass_rewards TO authenticated;
GRANT SELECT ON pass_rewards TO anon;

-- Task management
GRANT ALL PRIVILEGES ON task_dependencies TO authenticated;
GRANT SELECT ON task_dependencies TO anon;
GRANT ALL PRIVILEGES ON task_schedules TO authenticated;
GRANT SELECT ON task_schedules TO anon;
GRANT ALL PRIVILEGES ON task_progress_plans TO authenticated;
GRANT SELECT ON task_progress_plans TO anon;
GRANT ALL PRIVILEGES ON user_time_slots TO authenticated;
GRANT SELECT ON user_time_slots TO anon;

-- Knowledge & Efficiency
GRANT ALL PRIVILEGES ON knowledge_review_tasks TO authenticated;
GRANT SELECT ON knowledge_review_tasks TO anon;
GRANT ALL PRIVILEGES ON user_efficiency_profile TO authenticated;
GRANT SELECT ON user_efficiency_profile TO anon;
GRANT ALL PRIVILEGES ON path_node_tasks TO authenticated;
GRANT SELECT ON path_node_tasks TO anon;

-- Grant execute permissions on business functions
GRANT EXECUTE ON FUNCTION get_user_graphs_with_counts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_trashed_graphs(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION batch_update_positions(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION match_knowledge_points(vector(1024), float, int, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_accessible_knowledge_points(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION search_similar_knowledge_points(vector(1024), UUID, FLOAT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_knowledge_point_graphs(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION soft_delete_graph_node(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION hard_delete_knowledge_point(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION search_similar_graphs(vector(1024), UUID, FLOAT, INT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_study_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_duplicate_graph_topic(VARCHAR(255), UUID, FLOAT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_graph_collaborator(UUID, UUID) TO authenticated;
