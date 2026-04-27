-- =====================================================
-- Knowledge Map - Indexes
-- =====================================================

-- Users
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Knowledge graphs
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_user_id ON knowledge_graphs(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_is_public ON knowledge_graphs(is_public);
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_title_trgm ON knowledge_graphs USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_graphs_deleted_at ON knowledge_graphs(deleted_at);
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_last_used_at ON knowledge_graphs(last_used_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_user_deleted ON knowledge_graphs(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_user_created ON knowledge_graphs(user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_public ON knowledge_graphs(id) WHERE is_public = true AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_user_favorite ON knowledge_graphs(user_id, is_favorite DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_domain ON knowledge_graphs(domain) WHERE domain IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_knowledge_graphs_task_id ON knowledge_graphs(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS knowledge_graphs_embedding_idx ON knowledge_graphs USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Knowledge points
CREATE INDEX IF NOT EXISTS idx_knowledge_points_owner_id ON knowledge_points(owner_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_visibility ON knowledge_points(visibility);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_title_trgm ON knowledge_points USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_content_trgm ON knowledge_points USING gin (content gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_embedding ON knowledge_points USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_public ON knowledge_points(id) WHERE visibility = 'public';
CREATE INDEX IF NOT EXISTS idx_knowledge_points_owner_visibility ON knowledge_points(owner_id, visibility);
CREATE INDEX IF NOT EXISTS idx_knowledge_points_mastery ON knowledge_points(mastery_level) WHERE mastery_level > 0;
CREATE INDEX IF NOT EXISTS idx_knowledge_points_last_study ON knowledge_points(last_study_at DESC);

-- Knowledge point versions
CREATE INDEX IF NOT EXISTS idx_knowledge_point_versions_kp_id ON knowledge_point_versions(knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_point_versions_version ON knowledge_point_versions(knowledge_point_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_point_versions_created_at ON knowledge_point_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_point_versions_changed_by ON knowledge_point_versions(changed_by);

-- Graph nodes
CREATE INDEX IF NOT EXISTS idx_graph_nodes_graph_id ON graph_nodes(graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_knowledge_point_id ON graph_nodes(knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_level ON graph_nodes(level);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_deleted_at ON graph_nodes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_graph_deleted ON graph_nodes(graph_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_graph_nodes_kp_graph ON graph_nodes(knowledge_point_id, graph_id);

-- Edges
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_edges_graph_id ON edges(graph_id);
CREATE INDEX IF NOT EXISTS idx_edges_deleted_at ON edges(deleted_at);
CREATE INDEX IF NOT EXISTS idx_edges_source_graph ON edges(source_knowledge_point_id, graph_id);
CREATE INDEX IF NOT EXISTS idx_edges_target_graph ON edges(target_knowledge_point_id, graph_id);
CREATE INDEX IF NOT EXISTS idx_edges_graph_deleted ON edges(graph_id, deleted_at);

-- Study cards (simplified: 7 indexes)
CREATE INDEX IF NOT EXISTS idx_study_cards_user_next_review ON study_cards(user_id, next_review);
CREATE INDEX IF NOT EXISTS idx_study_cards_knowledge_point_id ON study_cards(knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_study_cards_next_review ON study_cards(next_review);
CREATE INDEX IF NOT EXISTS idx_study_cards_user_graph ON study_cards(user_id, graph_id);
CREATE INDEX IF NOT EXISTS idx_study_cards_quiz_set_id ON study_cards(quiz_set_id) WHERE quiz_set_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_study_cards_user_id ON study_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_study_cards_graph_id ON study_cards(graph_id);

-- Quiz sets
CREATE INDEX IF NOT EXISTS idx_quiz_sets_user_id ON quiz_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sets_graph_id ON quiz_sets(graph_id);
CREATE INDEX IF NOT EXISTS idx_quiz_sets_status ON quiz_sets(status);
CREATE INDEX IF NOT EXISTS idx_quiz_sets_user_status ON quiz_sets(user_id, status);

-- Quiz set cards
CREATE INDEX IF NOT EXISTS idx_quiz_set_cards_quiz_set_id ON quiz_set_cards(quiz_set_id);
CREATE INDEX IF NOT EXISTS idx_quiz_set_cards_card_id ON quiz_set_cards(card_id);
CREATE INDEX IF NOT EXISTS idx_quiz_set_cards_order ON quiz_set_cards(quiz_set_id, display_order);

-- Study progress
CREATE INDEX IF NOT EXISTS idx_study_progress_user ON study_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_study_progress_graph_id ON study_progress(graph_id);
CREATE INDEX IF NOT EXISTS idx_study_progress_user_graph ON study_progress(user_id, graph_id);

-- Templates
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_category ON templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_is_system ON templates(is_system);
CREATE INDEX IF NOT EXISTS idx_templates_user_category ON templates(user_id, category);
CREATE INDEX IF NOT EXISTS idx_templates_template_type ON templates(template_type);

-- Prompt templates
CREATE INDEX IF NOT EXISTS idx_prompt_templates_code ON prompt_templates(code);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_user ON prompt_templates(user_id);

-- AI actions
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_actions_unique_name_scope
  ON ai_actions (name, scope, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'), COALESCE(graph_id, '00000000-0000-0000-0000-000000000000'));
CREATE INDEX IF NOT EXISTS idx_ai_actions_user ON ai_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_actions_graph ON ai_actions(graph_id);

-- Focus sessions (simplified: 5 indexes)
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_date ON focus_sessions(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_completed ON focus_sessions(user_id, completed) WHERE completed = true;
CREATE INDEX IF NOT EXISTS idx_focus_sessions_task ON focus_sessions(task_id) WHERE task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_id ON focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_created_at ON focus_sessions(created_at);

-- Achievements
CREATE INDEX IF NOT EXISTS idx_achievements_code ON achievements(code);
CREATE INDEX IF NOT EXISTS idx_achievements_category ON achievements(category);

-- User achievements
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_unlocked ON user_achievements(user_id, unlocked_at DESC);

-- Graph relations
CREATE INDEX IF NOT EXISTS idx_graph_relations_source ON graph_relations(source_graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_relations_target ON graph_relations(target_graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_relations_type ON graph_relations(relation_type);

-- Backup snapshots
CREATE INDEX IF NOT EXISTS idx_backup_snapshots_user_id ON backup_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_backup_snapshots_type ON backup_snapshots(type);
CREATE INDEX IF NOT EXISTS idx_backup_snapshots_user_created ON backup_snapshots(user_id, created_at DESC);

-- Graph collaborators
CREATE INDEX IF NOT EXISTS idx_graph_collaborators_graph_id ON graph_collaborators(graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_collaborators_user_id ON graph_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_graph_collaborators_role ON graph_collaborators(role);
CREATE INDEX IF NOT EXISTS idx_graph_collaborators_invitation_token ON graph_collaborators(invitation_token);
CREATE INDEX IF NOT EXISTS idx_graph_collaborators_accepted ON graph_collaborators(graph_id, user_id) WHERE accepted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_graph_collaborators_pending ON graph_collaborators(invitation_token) WHERE accepted_at IS NULL;

-- Queues
CREATE INDEX IF NOT EXISTS idx_queues_user_id ON queues(user_id);
CREATE INDEX IF NOT EXISTS idx_queues_priority ON queues(user_id, priority);

-- User tasks
CREATE INDEX IF NOT EXISTS idx_user_tasks_user_status ON user_tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_tasks_user_queue_position ON user_tasks(user_id, queue_level, position);
CREATE INDEX IF NOT EXISTS idx_user_tasks_user_deleted ON user_tasks(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_tasks_user_deadline ON user_tasks(user_id, deadline) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_tasks_knowledge_point ON user_tasks(knowledge_point_id) WHERE knowledge_point_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_tasks_queue_id ON user_tasks(queue_id) WHERE queue_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_tasks_task_type ON user_tasks(user_id, task_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_tasks_parent_task ON user_tasks(parent_task_id) WHERE parent_task_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_user_tasks_scheduled_start ON user_tasks(user_id, scheduled_start) WHERE deleted_at IS NULL;

-- Task executions
CREATE INDEX IF NOT EXISTS idx_task_executions_task ON task_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_executions_user_started ON task_executions(user_id, started_at DESC);

-- Task tags
CREATE INDEX IF NOT EXISTS idx_task_tags_user ON task_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_task_tags_user_name ON task_tags(user_id, name);

-- Task settings
CREATE INDEX IF NOT EXISTS idx_task_settings_user ON task_settings(user_id);

-- Task dependencies
CREATE INDEX IF NOT EXISTS idx_task_dependencies_task ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_type ON task_dependencies(dependency_type);

-- Task schedules
CREATE INDEX IF NOT EXISTS idx_task_schedules_user ON task_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_task_schedules_template ON task_schedules(task_template_id);
CREATE INDEX IF NOT EXISTS idx_task_schedules_next_run ON task_schedules(next_run_at) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_task_schedules_active ON task_schedules(user_id, is_active);

-- Task progress plans
CREATE INDEX IF NOT EXISTS idx_task_progress_plans_task ON task_progress_plans(task_id);
CREATE INDEX IF NOT EXISTS idx_task_progress_plans_date ON task_progress_plans(plan_date);
CREATE INDEX IF NOT EXISTS idx_task_progress_plans_task_date ON task_progress_plans(task_id, plan_date);
CREATE INDEX IF NOT EXISTS idx_task_progress_plans_status ON task_progress_plans(task_id, status);

-- User time slots
CREATE INDEX IF NOT EXISTS idx_user_time_slots_user ON user_time_slots(user_id);
CREATE INDEX IF NOT EXISTS idx_user_time_slots_day ON user_time_slots(user_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_user_time_slots_available ON user_time_slots(user_id, is_available) WHERE is_available = TRUE;

-- Task subtasks
CREATE INDEX IF NOT EXISTS idx_task_subtasks_task_id ON task_subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_task_subtasks_status ON task_subtasks(status);
CREATE INDEX IF NOT EXISTS idx_task_subtasks_position ON task_subtasks(task_id, position);
CREATE INDEX IF NOT EXISTS idx_task_subtasks_learning_path_node ON task_subtasks(learning_path_node_id);
CREATE INDEX IF NOT EXISTS idx_task_subtasks_knowledge_point_id ON task_subtasks(knowledge_point_id);

-- Task links
CREATE INDEX IF NOT EXISTS idx_task_links_task_id ON task_links(task_id);
CREATE INDEX IF NOT EXISTS idx_task_links_type ON task_links(link_type);
CREATE INDEX IF NOT EXISTS idx_task_links_position ON task_links(task_id, position);

-- Task knowledge points
CREATE INDEX IF NOT EXISTS idx_task_kp_task_id ON task_knowledge_points(task_id);
CREATE INDEX IF NOT EXISTS idx_task_kp_kp_id ON task_knowledge_points(knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_task_kp_primary ON task_knowledge_points(task_id) WHERE is_primary = true;

-- Relationship types
CREATE INDEX IF NOT EXISTS idx_relationship_types_category ON relationship_types(category);
CREATE INDEX IF NOT EXISTS idx_relationship_types_user ON relationship_types(user_id);

-- User focus stats
CREATE INDEX IF NOT EXISTS idx_user_focus_stats_user ON user_focus_stats(user_id);

-- Task templates
CREATE INDEX IF NOT EXISTS idx_task_templates_user ON task_templates(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_task_templates_category ON task_templates(category);
CREATE INDEX IF NOT EXISTS idx_task_templates_system ON task_templates(is_system) WHERE is_system = TRUE;
CREATE INDEX IF NOT EXISTS idx_task_templates_user_category ON task_templates(user_id, category) WHERE user_id IS NOT NULL;

-- Task reviews
CREATE INDEX IF NOT EXISTS idx_task_reviews_user_id ON task_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_task_reviews_task_id ON task_reviews(task_id);
CREATE INDEX IF NOT EXISTS idx_task_reviews_type ON task_reviews(review_type);
CREATE INDEX IF NOT EXISTS idx_task_reviews_created_at ON task_reviews(created_at DESC);

-- Periodic tasks
CREATE INDEX IF NOT EXISTS idx_periodic_tasks_user ON periodic_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_periodic_tasks_period ON periodic_tasks(user_id, period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_periodic_tasks_status ON periodic_tasks(user_id, status);

-- Periodic passes
CREATE INDEX IF NOT EXISTS idx_periodic_passes_user ON periodic_passes(user_id);
CREATE INDEX IF NOT EXISTS idx_periodic_passes_period ON periodic_passes(user_id, period_type, period_start);

-- Pass rewards
CREATE INDEX IF NOT EXISTS idx_pass_rewards_period ON pass_rewards(period_type, level);

-- User pass progress
CREATE INDEX IF NOT EXISTS idx_user_pass_progress_pass ON user_pass_progress(pass_id);
CREATE INDEX IF NOT EXISTS idx_user_pass_progress_user ON user_pass_progress(user_id);

-- Learning paths
CREATE INDEX IF NOT EXISTS idx_learning_paths_user ON learning_paths(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_paths_status ON learning_paths(status);
CREATE INDEX IF NOT EXISTS idx_learning_paths_graph ON learning_paths(source_graph_id);
CREATE INDEX IF NOT EXISTS idx_learning_paths_user_status ON learning_paths(user_id, status);

-- Learning path nodes
CREATE INDEX IF NOT EXISTS idx_learning_path_nodes_path_id ON learning_path_nodes(path_id);
CREATE INDEX IF NOT EXISTS idx_learning_path_nodes_order ON learning_path_nodes(path_id, order_index);
CREATE INDEX IF NOT EXISTS idx_learning_path_nodes_kp ON learning_path_nodes(knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_learning_path_nodes_status ON learning_path_nodes(path_id, status);

-- Learning path progress
CREATE INDEX IF NOT EXISTS idx_learning_path_progress_user_path ON learning_path_progress(user_id, path_id);
CREATE INDEX IF NOT EXISTS idx_learning_path_progress_node ON learning_path_progress(node_id);
CREATE INDEX IF NOT EXISTS idx_learning_path_progress_status ON learning_path_progress(user_id, status);

-- Knowledge review tasks
CREATE INDEX IF NOT EXISTS idx_knowledge_review_tasks_user ON knowledge_review_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_review_tasks_kp ON knowledge_review_tasks(knowledge_point_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_review_tasks_task ON knowledge_review_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_review_tasks_next_review ON knowledge_review_tasks(user_id, next_review_date);
CREATE INDEX IF NOT EXISTS idx_knowledge_review_tasks_due ON knowledge_review_tasks(user_id, next_review_date) WHERE next_review_date IS NOT NULL;

-- User efficiency profile
CREATE INDEX IF NOT EXISTS idx_user_efficiency_profile_user ON user_efficiency_profile(user_id);

-- Path node tasks
CREATE INDEX IF NOT EXISTS idx_path_node_tasks_path ON path_node_tasks(path_id);
CREATE INDEX IF NOT EXISTS idx_path_node_tasks_node ON path_node_tasks(node_id);
CREATE INDEX IF NOT EXISTS idx_path_node_tasks_task ON path_node_tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_path_node_tasks_user ON path_node_tasks(user_id);

-- Learning loops
CREATE INDEX IF NOT EXISTS idx_learning_loops_user ON learning_loops(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_loops_user_stage ON learning_loops(user_id, current_stage);
CREATE INDEX IF NOT EXISTS idx_learning_loops_knowledge_point ON learning_loops(knowledge_point_id);

-- Domains
CREATE UNIQUE INDEX IF NOT EXISTS idx_domains_name_user_deleted ON domains(name, user_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_domains_parent_id ON domains(parent_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_domains_user_id ON domains(user_id) WHERE deleted_at IS NULL;

-- Graph-Domains
CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_domains_graph_domain ON graph_domains(graph_id, domain_id);
CREATE INDEX IF NOT EXISTS idx_graph_domains_graph_id ON graph_domains(graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_domains_domain_id ON graph_domains(domain_id);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);

-- AI performance logs
CREATE INDEX IF NOT EXISTS idx_ai_perf_logs_timestamp ON ai_performance_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ai_perf_logs_operation ON ai_performance_logs(operation);
CREATE INDEX IF NOT EXISTS idx_ai_perf_logs_provider ON ai_performance_logs(provider);
CREATE INDEX IF NOT EXISTS idx_ai_perf_logs_model ON ai_performance_logs(model);
CREATE INDEX IF NOT EXISTS idx_ai_perf_logs_success ON ai_performance_logs(success);
CREATE INDEX IF NOT EXISTS idx_ai_perf_logs_created_at ON ai_performance_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_perf_logs_session_id ON ai_performance_logs(session_id);
