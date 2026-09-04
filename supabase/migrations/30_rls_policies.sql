-- =====================================================
-- Knowledge Map - Row Level Security Policies
-- =====================================================

-- Users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Knowledge Graphs
ALTER TABLE knowledge_graphs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own graphs" ON knowledge_graphs;
CREATE POLICY "Users can view accessible graphs" ON knowledge_graphs FOR SELECT USING (
  user_id = auth.uid()
  OR is_public = true
  OR public.is_graph_collaborator(id, auth.uid())
);
CREATE POLICY "Users can insert own graphs" ON knowledge_graphs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own graphs" ON knowledge_graphs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own graphs" ON knowledge_graphs FOR DELETE USING (auth.uid() = user_id);

-- Knowledge Graph Contents (1:1 子表，权限跟随 knowledge_graphs)
ALTER TABLE knowledge_graph_contents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view accessible graph contents" ON knowledge_graph_contents;
CREATE POLICY "Users can view accessible graph contents" ON knowledge_graph_contents FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE knowledge_graphs.id = knowledge_graph_contents.graph_id
    AND (
      knowledge_graphs.user_id = auth.uid()
      OR knowledge_graphs.is_public = true
      OR public.is_graph_collaborator(knowledge_graphs.id, auth.uid())
    )
  )
);
CREATE POLICY "Users can insert own graph contents" ON knowledge_graph_contents FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE knowledge_graphs.id = knowledge_graph_contents.graph_id
    AND knowledge_graphs.user_id = auth.uid()
  )
);
CREATE POLICY "Users can update own graph contents" ON knowledge_graph_contents FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE knowledge_graphs.id = knowledge_graph_contents.graph_id
    AND knowledge_graphs.user_id = auth.uid()
  )
);
CREATE POLICY "Users can delete own graph contents" ON knowledge_graph_contents FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE knowledge_graphs.id = knowledge_graph_contents.graph_id
    AND knowledge_graphs.user_id = auth.uid()
  )
);

-- Knowledge Points
ALTER TABLE knowledge_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view public knowledge points" ON knowledge_points FOR SELECT USING (visibility = 'public');
CREATE POLICY "Users can view own knowledge points" ON knowledge_points FOR SELECT USING (auth.uid() = owner_id);
CREATE POLICY "Users can view knowledge points in public graphs" ON knowledge_points FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM graph_nodes
    JOIN knowledge_graphs ON knowledge_graphs.id = graph_nodes.graph_id
    WHERE graph_nodes.knowledge_point_id = knowledge_points.id
    AND knowledge_graphs.is_public = true
    AND graph_nodes.deleted_at IS NULL
  )
);
CREATE POLICY "Users can insert own knowledge points" ON knowledge_points FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Users can update own knowledge points" ON knowledge_points FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Users can delete own knowledge points" ON knowledge_points FOR DELETE USING (auth.uid() = owner_id);

-- Knowledge Point Versions
ALTER TABLE knowledge_point_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view versions of own knowledge points" ON knowledge_point_versions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM knowledge_points
    WHERE knowledge_points.id = knowledge_point_versions.knowledge_point_id
    AND (knowledge_points.owner_id = auth.uid() OR knowledge_points.visibility = 'public')
  )
);
CREATE POLICY "Users can insert versions of own knowledge points" ON knowledge_point_versions FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM knowledge_points
    WHERE knowledge_points.id = knowledge_point_versions.knowledge_point_id
    AND knowledge_points.owner_id = auth.uid()
  )
);

-- Graph Nodes
ALTER TABLE graph_nodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view graph_nodes of own graphs" ON graph_nodes;
CREATE POLICY "Users can view graph_nodes of accessible graphs" ON graph_nodes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE knowledge_graphs.id = graph_nodes.graph_id
    AND (
      knowledge_graphs.user_id = auth.uid()
      OR knowledge_graphs.is_public = true
      OR public.is_graph_collaborator(knowledge_graphs.id, auth.uid())
    )
  )
);
DROP POLICY IF EXISTS "Users can insert graph_nodes to own graphs" ON graph_nodes;
CREATE POLICY "Editors can insert graph_nodes" ON graph_nodes FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM knowledge_graphs kg
    WHERE kg.id = graph_nodes.graph_id
    AND (kg.user_id = auth.uid() OR (public.is_graph_collaborator(kg.id, auth.uid())))
  )
);
DROP POLICY IF EXISTS "Users can update graph_nodes of own graphs" ON graph_nodes;
CREATE POLICY "Editors can update graph_nodes" ON graph_nodes FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM knowledge_graphs kg
    WHERE kg.id = graph_nodes.graph_id
    AND (kg.user_id = auth.uid() OR (public.is_graph_collaborator(kg.id, auth.uid())))
  )
);
DROP POLICY IF EXISTS "Users can delete graph_nodes of own graphs" ON graph_nodes;
CREATE POLICY "Editors can delete graph_nodes" ON graph_nodes FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM knowledge_graphs kg
    WHERE kg.id = graph_nodes.graph_id
    AND (kg.user_id = auth.uid() OR (public.is_graph_collaborator(kg.id, auth.uid())))
  )
);

-- Edges
ALTER TABLE edges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view edges of own graphs" ON edges;
CREATE POLICY "Users can view edges of accessible graphs" ON edges FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE knowledge_graphs.id = edges.graph_id
    AND (
      knowledge_graphs.user_id = auth.uid()
      OR knowledge_graphs.is_public = true
      OR public.is_graph_collaborator(knowledge_graphs.id, auth.uid())
    )
  )
);
DROP POLICY IF EXISTS "Users can insert edges to own graphs" ON edges;
CREATE POLICY "Editors can insert edges" ON edges FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM knowledge_graphs kg
    WHERE kg.id = edges.graph_id
    AND (kg.user_id = auth.uid() OR public.is_graph_collaborator(kg.id, auth.uid()))
  )
);
DROP POLICY IF EXISTS "Users can update edges of own graphs" ON edges;
CREATE POLICY "Editors can update edges" ON edges FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM knowledge_graphs kg
    WHERE kg.id = edges.graph_id
    AND (kg.user_id = auth.uid() OR public.is_graph_collaborator(kg.id, auth.uid()))
  )
);
DROP POLICY IF EXISTS "Users can delete edges of own graphs" ON edges;
CREATE POLICY "Editors can delete edges" ON edges FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM knowledge_graphs kg
    WHERE kg.id = edges.graph_id
    AND (kg.user_id = auth.uid() OR public.is_graph_collaborator(kg.id, auth.uid()))
  )
);

-- Study Cards
ALTER TABLE study_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own study cards" ON study_cards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own study cards" ON study_cards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own study cards" ON study_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own study cards" ON study_cards FOR DELETE USING (auth.uid() = user_id);

-- Quiz Sets
ALTER TABLE quiz_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own quiz sets" ON quiz_sets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own quiz sets" ON quiz_sets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own quiz sets" ON quiz_sets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own quiz sets" ON quiz_sets FOR DELETE USING (auth.uid() = user_id);

-- Quiz Set Cards
ALTER TABLE quiz_set_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own quiz set cards" ON quiz_set_cards FOR SELECT USING (
  EXISTS (SELECT 1 FROM quiz_sets WHERE quiz_sets.id = quiz_set_cards.quiz_set_id AND quiz_sets.user_id = auth.uid())
);
CREATE POLICY "Users can insert own quiz set cards" ON quiz_set_cards FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM quiz_sets WHERE quiz_sets.id = quiz_set_cards.quiz_set_id AND quiz_sets.user_id = auth.uid())
);
CREATE POLICY "Users can delete own quiz set cards" ON quiz_set_cards FOR DELETE USING (
  EXISTS (SELECT 1 FROM quiz_sets WHERE quiz_sets.id = quiz_set_cards.quiz_set_id AND quiz_sets.user_id = auth.uid())
);

-- Study Progress
ALTER TABLE study_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own study progress" ON study_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own study progress" ON study_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own study progress" ON study_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own study progress" ON study_progress FOR DELETE USING (auth.uid() = user_id);

-- Templates
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view templates" ON templates FOR SELECT USING (auth.uid() = user_id OR is_system = true);
CREATE POLICY "Authenticated users can create custom templates" ON templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own templates" ON templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own templates" ON templates FOR DELETE USING (auth.uid() = user_id AND is_system = false);

-- Prompt Templates
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System templates are viewable by everyone" ON prompt_templates FOR SELECT USING (scope = 'system');
CREATE POLICY "Users can view their own templates" ON prompt_templates FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own templates" ON prompt_templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own templates" ON prompt_templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own templates" ON prompt_templates FOR DELETE USING (auth.uid() = user_id);

-- AI Actions
ALTER TABLE ai_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "System actions are viewable by everyone" ON ai_actions FOR SELECT USING (scope = 'system');
CREATE POLICY "Users can view their own actions" ON ai_actions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view actions for their graphs" ON ai_actions FOR SELECT USING (
  scope = 'graph' AND graph_id IN (SELECT id FROM knowledge_graphs WHERE user_id = auth.uid())
);
CREATE POLICY "Users can manage their own actions" ON ai_actions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage actions for their graphs" ON ai_actions FOR ALL USING (
  scope = 'graph' AND graph_id IN (SELECT id FROM knowledge_graphs WHERE user_id = auth.uid())
);

-- App Settings
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read access for authenticated users" ON app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admins to manage app settings" ON app_settings FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Focus Sessions
ALTER TABLE focus_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own focus sessions" ON focus_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own focus sessions" ON focus_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own focus sessions" ON focus_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own focus sessions" ON focus_sessions FOR DELETE USING (auth.uid() = user_id);

-- Achievements
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view achievements" ON achievements FOR SELECT USING (TRUE);
CREATE POLICY "Only admins can manage achievements" ON achievements FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  )
);

-- User Achievements
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own achievements" ON user_achievements FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own achievements" ON user_achievements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own achievements" ON user_achievements FOR UPDATE USING (auth.uid() = user_id);

-- Graph Relations
ALTER TABLE graph_relations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view relations for graphs they own or are public"
  ON graph_relations FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM knowledge_graphs WHERE id = source_graph_id AND (user_id = auth.uid() OR is_public = true))
    OR EXISTS (SELECT 1 FROM knowledge_graphs WHERE id = target_graph_id AND (user_id = auth.uid() OR is_public = true))
  );
CREATE POLICY "Users can insert relations for graphs they own"
  ON graph_relations FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM knowledge_graphs WHERE id = source_graph_id AND user_id = auth.uid())
  );
CREATE POLICY "Users can delete relations for graphs they own"
  ON graph_relations FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM knowledge_graphs WHERE id = source_graph_id AND user_id = auth.uid())
  );

-- Backup Snapshots
ALTER TABLE backup_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own backup snapshots" ON backup_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own backup snapshots" ON backup_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own backup snapshots" ON backup_snapshots FOR DELETE USING (auth.uid() = user_id);

-- Graph collaborators
ALTER TABLE graph_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view collaborators of graphs they have access to" ON graph_collaborators FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM knowledge_graphs WHERE id = graph_collaborators.graph_id AND user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM knowledge_graphs WHERE id = graph_collaborators.graph_id AND is_public = true)
);
CREATE POLICY "Owners can manage collaborators" ON graph_collaborators FOR ALL USING (
  EXISTS (SELECT 1 FROM knowledge_graphs WHERE id = graph_collaborators.graph_id AND user_id = auth.uid())
);
CREATE POLICY "Users can view own collaborations" ON graph_collaborators FOR SELECT USING (user_id = auth.uid());

-- Queues
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own queues" ON queues FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own queues" ON queues FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own queues" ON queues FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own queues" ON queues FOR DELETE USING (auth.uid() = user_id);

-- User tasks
ALTER TABLE user_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own user tasks" ON user_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own user tasks" ON user_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own user tasks" ON user_tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own user tasks" ON user_tasks FOR DELETE USING (auth.uid() = user_id);

-- Task executions
ALTER TABLE task_executions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task executions" ON task_executions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own task executions" ON task_executions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own task executions" ON task_executions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own task executions" ON task_executions FOR DELETE USING (auth.uid() = user_id);

-- Task tags
ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task tags" ON task_tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own task tags" ON task_tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own task tags" ON task_tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own task tags" ON task_tags FOR DELETE USING (auth.uid() = user_id);

-- Task settings
ALTER TABLE task_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task settings" ON task_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own task settings" ON task_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own task settings" ON task_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own task settings" ON task_settings FOR DELETE USING (auth.uid() = user_id);

-- Relationship types
ALTER TABLE relationship_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view builtin relationship types" ON relationship_types FOR SELECT USING (is_builtin = true);
CREATE POLICY "Users can view own relationship types" ON relationship_types FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own relationship types" ON relationship_types FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own relationship types" ON relationship_types FOR UPDATE USING (user_id = auth.uid() AND is_builtin = false);
CREATE POLICY "Users can delete own relationship types" ON relationship_types FOR DELETE USING (user_id = auth.uid() AND is_builtin = false);

-- User focus stats
ALTER TABLE user_focus_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own focus stats" ON user_focus_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own focus stats" ON user_focus_stats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own focus stats" ON user_focus_stats FOR UPDATE USING (auth.uid() = user_id);

-- User Activities
ALTER TABLE user_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own activities" ON user_activities FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own activities" ON user_activities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own activities" ON user_activities FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own activities" ON user_activities FOR DELETE USING (auth.uid() = user_id);

-- Task templates
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task templates" ON task_templates FOR SELECT USING (auth.uid() = user_id OR is_system = TRUE);
CREATE POLICY "Users can insert own task templates" ON task_templates FOR INSERT WITH CHECK (auth.uid() = user_id OR is_system = TRUE);
CREATE POLICY "Users can update own task templates" ON task_templates FOR UPDATE USING (auth.uid() = user_id AND is_system = FALSE);
CREATE POLICY "Users can delete own task templates" ON task_templates FOR DELETE USING (auth.uid() = user_id AND is_system = FALSE);

-- Periodic tasks
ALTER TABLE periodic_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own periodic tasks" ON periodic_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own periodic tasks" ON periodic_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own periodic tasks" ON periodic_tasks FOR UPDATE USING (auth.uid() = user_id);

-- Periodic passes
ALTER TABLE periodic_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own periodic passes" ON periodic_passes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own periodic passes" ON periodic_passes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own periodic passes" ON periodic_passes FOR UPDATE USING (auth.uid() = user_id);

-- Pass rewards
ALTER TABLE pass_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view pass rewards" ON pass_rewards FOR SELECT USING (TRUE);

-- User pass progress
ALTER TABLE user_pass_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own pass progress" ON user_pass_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own pass progress" ON user_pass_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pass progress" ON user_pass_progress FOR UPDATE USING (auth.uid() = user_id);

-- Task dependencies
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task dependencies" ON task_dependencies FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_tasks WHERE user_tasks.id = task_dependencies.task_id AND user_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can insert own task dependencies" ON task_dependencies FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_tasks WHERE user_tasks.id = task_dependencies.task_id AND user_tasks.user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM user_tasks WHERE user_tasks.id = task_dependencies.depends_on_task_id AND user_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can delete own task dependencies" ON task_dependencies FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_tasks WHERE user_tasks.id = task_dependencies.task_id AND user_tasks.user_id = auth.uid())
);

-- Task schedules
ALTER TABLE task_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task schedules" ON task_schedules FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own task schedules" ON task_schedules FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own task schedules" ON task_schedules FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own task schedules" ON task_schedules FOR DELETE USING (auth.uid() = user_id);

-- Task progress plans
ALTER TABLE task_progress_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task progress plans" ON task_progress_plans FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_tasks WHERE user_tasks.id = task_progress_plans.task_id AND user_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can insert own task progress plans" ON task_progress_plans FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_tasks WHERE user_tasks.id = task_progress_plans.task_id AND user_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can update own task progress plans" ON task_progress_plans FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_tasks WHERE user_tasks.id = task_progress_plans.task_id AND user_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can delete own task progress plans" ON task_progress_plans FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_tasks WHERE user_tasks.id = task_progress_plans.task_id AND user_tasks.user_id = auth.uid())
);

-- User time slots
ALTER TABLE user_time_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own time slots" ON user_time_slots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own time slots" ON user_time_slots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own time slots" ON user_time_slots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own time slots" ON user_time_slots FOR DELETE USING (auth.uid() = user_id);

-- Task subtasks
ALTER TABLE task_subtasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task subtasks" ON task_subtasks FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_tasks WHERE user_tasks.id = task_subtasks.task_id AND user_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can insert own task subtasks" ON task_subtasks FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_tasks WHERE user_tasks.id = task_subtasks.task_id AND user_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can update own task subtasks" ON task_subtasks FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_tasks WHERE user_tasks.id = task_subtasks.task_id AND user_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can delete own task subtasks" ON task_subtasks FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_tasks WHERE user_tasks.id = task_subtasks.task_id AND user_tasks.user_id = auth.uid())
);

-- Task links
ALTER TABLE task_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task links" ON task_links FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_tasks WHERE user_tasks.id = task_links.task_id AND user_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can insert own task links" ON task_links FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_tasks WHERE user_tasks.id = task_links.task_id AND user_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can update own task links" ON task_links FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_tasks WHERE user_tasks.id = task_links.task_id AND user_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can delete own task links" ON task_links FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_tasks WHERE user_tasks.id = task_links.task_id AND user_tasks.user_id = auth.uid())
);

-- Task knowledge points
ALTER TABLE task_knowledge_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task knowledge points" ON task_knowledge_points FOR SELECT USING (
  EXISTS (SELECT 1 FROM user_tasks WHERE user_tasks.id = task_knowledge_points.task_id AND user_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can insert own task knowledge points" ON task_knowledge_points FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM user_tasks WHERE user_tasks.id = task_knowledge_points.task_id AND user_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can update own task knowledge points" ON task_knowledge_points FOR UPDATE USING (
  EXISTS (SELECT 1 FROM user_tasks WHERE user_tasks.id = task_knowledge_points.task_id AND user_tasks.user_id = auth.uid())
);
CREATE POLICY "Users can delete own task knowledge points" ON task_knowledge_points FOR DELETE USING (
  EXISTS (SELECT 1 FROM user_tasks WHERE user_tasks.id = task_knowledge_points.task_id AND user_tasks.user_id = auth.uid())
);

-- Learning paths
ALTER TABLE learning_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own learning paths" ON learning_paths FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own learning paths" ON learning_paths FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own learning paths" ON learning_paths FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own learning paths" ON learning_paths FOR DELETE USING (auth.uid() = user_id);

-- Learning path nodes
ALTER TABLE learning_path_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view nodes of own paths" ON learning_path_nodes FOR SELECT USING (
  EXISTS (SELECT 1 FROM learning_paths WHERE learning_paths.id = learning_path_nodes.path_id AND learning_paths.user_id = auth.uid())
);
CREATE POLICY "Users can insert nodes to own paths" ON learning_path_nodes FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM learning_paths WHERE learning_paths.id = learning_path_nodes.path_id AND learning_paths.user_id = auth.uid())
);
CREATE POLICY "Users can update nodes of own paths" ON learning_path_nodes FOR UPDATE USING (
  EXISTS (SELECT 1 FROM learning_paths WHERE learning_paths.id = learning_path_nodes.path_id AND learning_paths.user_id = auth.uid())
);
CREATE POLICY "Users can delete nodes of own paths" ON learning_path_nodes FOR DELETE USING (
  EXISTS (SELECT 1 FROM learning_paths WHERE learning_paths.id = learning_path_nodes.path_id AND learning_paths.user_id = auth.uid())
);

-- Learning path prerequisites
ALTER TABLE learning_path_prerequisites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view prerequisites of own paths" ON learning_path_prerequisites FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM learning_path_nodes ln
    JOIN learning_paths lp ON ln.path_id = lp.id
    WHERE ln.id = learning_path_prerequisites.path_node_id AND lp.user_id = auth.uid()
  )
);
CREATE POLICY "Users can insert prerequisites to own paths" ON learning_path_prerequisites FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM learning_path_nodes ln
    JOIN learning_paths lp ON ln.path_id = lp.id
    WHERE ln.id = learning_path_prerequisites.path_node_id AND lp.user_id = auth.uid()
  )
);
CREATE POLICY "Users can delete prerequisites from own paths" ON learning_path_prerequisites FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM learning_path_nodes ln
    JOIN learning_paths lp ON ln.path_id = lp.id
    WHERE ln.id = learning_path_prerequisites.path_node_id AND lp.user_id = auth.uid()
  )
);

-- Learning path progress
ALTER TABLE learning_path_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own progress" ON learning_path_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own progress" ON learning_path_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON learning_path_progress FOR UPDATE USING (auth.uid() = user_id);

-- Learning loops
ALTER TABLE learning_loops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own learning loops" ON learning_loops FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own learning loops" ON learning_loops FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own learning loops" ON learning_loops FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own learning loops" ON learning_loops FOR DELETE USING (auth.uid() = user_id);

-- User efficiency profile
ALTER TABLE user_efficiency_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own efficiency profile" ON user_efficiency_profile FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own efficiency profile" ON user_efficiency_profile FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own efficiency profile" ON user_efficiency_profile FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE scheduler_weight_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own weight profiles" ON scheduler_weight_profiles FOR ALL USING (auth.uid() = user_id);

-- Path node tasks
ALTER TABLE path_node_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own path node tasks" ON path_node_tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own path node tasks" ON path_node_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own path node tasks" ON path_node_tasks FOR DELETE USING (auth.uid() = user_id);

-- Domains
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own or system domains" ON domains FOR SELECT USING (
  auth.uid() = user_id OR is_system = TRUE
);
CREATE POLICY "Users can insert own domains" ON domains FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own domains" ON domains FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own non-system domains" ON domains FOR DELETE USING (auth.uid() = user_id AND is_system = FALSE);

-- Graph-Domains
ALTER TABLE graph_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view graph domains for accessible graphs" ON graph_domains FOR SELECT USING (
  EXISTS (SELECT 1 FROM knowledge_graphs WHERE id = graph_domains.graph_id AND (user_id = auth.uid() OR is_public = TRUE))
);
CREATE POLICY "Users can insert graph domains for own graphs" ON graph_domains FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM knowledge_graphs WHERE id = graph_domains.graph_id AND user_id = auth.uid())
);
CREATE POLICY "Users can delete graph domains for own graphs" ON graph_domains FOR DELETE USING (
  EXISTS (SELECT 1 FROM knowledge_graphs WHERE id = graph_domains.graph_id AND user_id = auth.uid())
);

-- Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notifications" ON notifications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can view own notification settings" ON notification_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notification settings" ON notification_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notification settings" ON notification_settings FOR UPDATE USING (auth.uid() = user_id);

-- AI Performance Logs (user-scoped via user_id; NULL = system-level)
ALTER TABLE ai_performance_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own or system-level ai performance logs" ON ai_performance_logs FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Service role can insert ai performance logs" ON ai_performance_logs FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Task Reviews
ALTER TABLE task_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own task reviews" ON task_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own task reviews" ON task_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own task reviews" ON task_reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own task reviews" ON task_reviews FOR DELETE USING (auth.uid() = user_id);



-- ==== from 09_learning_paths.sql ====
ALTER TABLE learning_path_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own schedule" ON learning_path_schedule FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own schedule" ON learning_path_schedule FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own schedule" ON learning_path_schedule FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own schedule" ON learning_path_schedule FOR DELETE USING (auth.uid() = user_id);


-- ==== from 13_plugin_marketplace.sql ====
-- Installed plugins RLS
ALTER TABLE installed_plugins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own installed plugins" ON installed_plugins FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own installed plugins" ON installed_plugins FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own installed plugins" ON installed_plugins FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own installed plugins" ON installed_plugins FOR DELETE USING (auth.uid() = user_id);

-- Plugin ratings RLS
ALTER TABLE plugin_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read plugin ratings" ON plugin_ratings FOR SELECT USING (TRUE);

CREATE POLICY "Users can insert own plugin ratings" ON plugin_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plugin ratings" ON plugin_ratings FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own plugin ratings" ON plugin_ratings FOR DELETE USING (auth.uid() = user_id);


-- ==== from 14_practice_quiz_sessions.sql ====
-- Row Level Security
ALTER TABLE learning_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own learning sessions"
  ON learning_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learning sessions"
  ON learning_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learning sessions"
  ON learning_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own learning sessions"
  ON learning_sessions FOR DELETE
  USING (auth.uid() = user_id);

ALTER TABLE learning_session_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own learning session results"
  ON learning_session_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM learning_sessions
      WHERE learning_sessions.id = learning_session_results.session_id
      AND learning_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own learning session results"
  ON learning_session_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM learning_sessions
      WHERE learning_sessions.id = learning_session_results.session_id
      AND learning_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own learning session results"
  ON learning_session_results FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM learning_sessions
      WHERE learning_sessions.id = learning_session_results.session_id
      AND learning_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own learning session results"
  ON learning_session_results FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM learning_sessions
      WHERE learning_sessions.id = learning_session_results.session_id
      AND learning_sessions.user_id = auth.uid()
    )
  );


-- ==== from 15_system_tasks.sql ====
-- RLS Policies
ALTER TABLE system_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own system tasks"
  ON system_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own system tasks"
  ON system_tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own system tasks"
  ON system_tasks FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all system tasks"
  ON system_tasks FOR ALL
  USING (auth.role() = 'service_role');


-- ==== from 16_graph_backbone_modules.sql ====
-- =====================================================
-- Row Level Security（与 knowledge_graphs 权限模型一致）
-- =====================================================
ALTER TABLE graph_backbone_modules ENABLE ROW LEVEL SECURITY;

-- 读取：本人图谱 / 公开图谱 / 协作者图谱
CREATE POLICY "view accessible backbone modules"
  ON graph_backbone_modules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_graphs
      WHERE knowledge_graphs.id = graph_backbone_modules.graph_id
        AND (
          knowledge_graphs.user_id = auth.uid()
          OR knowledge_graphs.is_public = true
          OR public.is_graph_collaborator(knowledge_graphs.id, auth.uid())
        )
    )
  );

-- 写入/更新/删除：仅本人图谱
CREATE POLICY "manage own backbone modules"
  ON graph_backbone_modules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_graphs
      WHERE knowledge_graphs.id = graph_backbone_modules.graph_id
        AND knowledge_graphs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM knowledge_graphs
      WHERE knowledge_graphs.id = graph_backbone_modules.graph_id
        AND knowledge_graphs.user_id = auth.uid()
    )
  );


-- ==== from 17_document_chunks.sql ====
-- Enable Row Level Security
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

-- document_chunks 通过 knowledge_point_id 外键关联 knowledge_points，策略参照 knowledge_points 模式：
-- SELECT: owner_id 匹配 OR visibility='public' OR 在 public graph 内
-- INSERT/UPDATE/DELETE: 仅 owner
CREATE POLICY "Users can view own document_chunks" ON document_chunks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM knowledge_points
    WHERE knowledge_points.id = document_chunks.knowledge_point_id
    AND knowledge_points.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM knowledge_points
    WHERE knowledge_points.id = document_chunks.knowledge_point_id
    AND knowledge_points.visibility = 'public'
  )
  OR EXISTS (
    SELECT 1 FROM knowledge_points
    JOIN graph_nodes ON graph_nodes.knowledge_point_id = knowledge_points.id
    JOIN knowledge_graphs ON knowledge_graphs.id = graph_nodes.graph_id
    WHERE knowledge_points.id = document_chunks.knowledge_point_id
    AND knowledge_graphs.is_public = true
    AND graph_nodes.deleted_at IS NULL
  )
);

CREATE POLICY "Users can insert own document_chunks" ON document_chunks FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM knowledge_points
    WHERE knowledge_points.id = document_chunks.knowledge_point_id
    AND knowledge_points.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can update own document_chunks" ON document_chunks FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM knowledge_points
    WHERE knowledge_points.id = document_chunks.knowledge_point_id
    AND knowledge_points.owner_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own document_chunks" ON document_chunks FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM knowledge_points
    WHERE knowledge_points.id = document_chunks.knowledge_point_id
    AND knowledge_points.owner_id = auth.uid()
  )
);


-- ==== from 18_graph_version_control.sql ====
-- Graph Snapshots
ALTER TABLE graph_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view accessible graph snapshots" ON graph_snapshots FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE knowledge_graphs.id = graph_snapshots.graph_id
    AND (
      knowledge_graphs.user_id = auth.uid()
      OR knowledge_graphs.is_public = true
      OR public.is_graph_collaborator(knowledge_graphs.id, auth.uid())
    )
  )
);

CREATE POLICY "Users can insert own graph snapshots" ON graph_snapshots FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE knowledge_graphs.id = graph_snapshots.graph_id
    AND knowledge_graphs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own graph snapshots" ON graph_snapshots FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE knowledge_graphs.id = graph_snapshots.graph_id
    AND knowledge_graphs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own graph snapshots" ON graph_snapshots FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE knowledge_graphs.id = graph_snapshots.graph_id
    AND knowledge_graphs.user_id = auth.uid()
  )
);

-- Graph Events
ALTER TABLE graph_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view accessible graph events" ON graph_events FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE knowledge_graphs.id = graph_events.graph_id
    AND (
      knowledge_graphs.user_id = auth.uid()
      OR knowledge_graphs.is_public = true
      OR public.is_graph_collaborator(knowledge_graphs.id, auth.uid())
    )
  )
);

CREATE POLICY "Users can insert own graph events" ON graph_events FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE knowledge_graphs.id = graph_events.graph_id
    AND knowledge_graphs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update own graph events" ON graph_events FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE knowledge_graphs.id = graph_events.graph_id
    AND knowledge_graphs.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete own graph events" ON graph_events FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM knowledge_graphs
    WHERE knowledge_graphs.id = graph_events.graph_id
    AND knowledge_graphs.user_id = auth.uid()
  )
);


-- ==== from 19_agent_sessions.sql ====
-- RLS policies
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

ALTER TABLE agent_tool_calls ENABLE ROW LEVEL SECURITY;

ALTER TABLE agent_pending_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own agent sessions"
  ON agent_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own agent sessions"
  ON agent_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agent sessions"
  ON agent_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own agent sessions"
  ON agent_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- agent_messages, agent_tool_calls, agent_pending_actions 通过 session 的 user_id 间接控制
CREATE POLICY "Users can view messages of their own sessions"
  ON agent_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_messages.session_id AND agent_sessions.user_id = auth.uid()));

CREATE POLICY "Users can insert messages to their own sessions"
  ON agent_messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_messages.session_id AND agent_sessions.user_id = auth.uid()));

CREATE POLICY "Users can view tool calls of their own sessions"
  ON agent_tool_calls FOR SELECT
  USING (EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_tool_calls.session_id AND agent_sessions.user_id = auth.uid()));

CREATE POLICY "Users can insert tool calls to their own sessions"
  ON agent_tool_calls FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_tool_calls.session_id AND agent_sessions.user_id = auth.uid()));

CREATE POLICY "Users can update tool calls of their own sessions"
  ON agent_tool_calls FOR UPDATE
  USING (EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_tool_calls.session_id AND agent_sessions.user_id = auth.uid()));

CREATE POLICY "Users can view pending actions of their own sessions"
  ON agent_pending_actions FOR SELECT
  USING (EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_pending_actions.session_id AND agent_sessions.user_id = auth.uid()));

CREATE POLICY "Users can insert pending actions to their own sessions"
  ON agent_pending_actions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_pending_actions.session_id AND agent_sessions.user_id = auth.uid()));

CREATE POLICY "Users can update pending actions of their own sessions"
  ON agent_pending_actions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM agent_sessions WHERE agent_sessions.id = agent_pending_actions.session_id AND agent_sessions.user_id = auth.uid()));


-- ==== from 20_sync_operations.sql ====
-- 启用 RLS
ALTER TABLE sync_operations ENABLE ROW LEVEL SECURITY;

-- 用户只能读写自己的 sync_operations
CREATE POLICY "Users can view own sync_operations"
  ON sync_operations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sync_operations"
  ON sync_operations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sync_operations"
  ON sync_operations FOR DELETE
  USING (auth.uid() = user_id);


-- ==== from 21_revoked_tokens.sql ====
-- RLS 策略：用户只能查询自己的 revoked_tokens
ALTER TABLE revoked_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own revoked tokens"
  ON revoked_tokens FOR SELECT
  USING (auth.uid() = user_id);


-- ==== from 22_notes.sql ====
-- notes: user_id = auth.uid() 才能访问自己的
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notes" ON notes FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes" ON notes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes" ON notes FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes" ON notes FOR DELETE USING (auth.uid() = user_id);

-- note_node_links: 通过 note_id JOIN notes 验证 user_id
ALTER TABLE note_node_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own note node links" ON note_node_links FOR SELECT USING (
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_node_links.note_id AND notes.user_id = auth.uid())
);

CREATE POLICY "Users can insert own note node links" ON note_node_links FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_node_links.note_id AND notes.user_id = auth.uid())
);

CREATE POLICY "Users can delete own note node links" ON note_node_links FOR DELETE USING (
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_node_links.note_id AND notes.user_id = auth.uid())
);

-- note_templates: 用户能查所有可见模板（自己的 + 系统的），只能改/删自己的
ALTER TABLE note_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own or system note templates" ON note_templates FOR SELECT USING (
  auth.uid() = user_id OR is_system = TRUE
);

CREATE POLICY "Users can insert own note templates" ON note_templates FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own note templates" ON note_templates FOR UPDATE USING (
  auth.uid() = user_id AND is_system = FALSE
);

CREATE POLICY "Users can delete own note templates" ON note_templates FOR DELETE USING (
  auth.uid() = user_id AND is_system = FALSE
);


-- ==== from 23_notes_embedding.sql ====
-- =====================================================
-- 2. RLS 行级安全策略
-- 通过 note_id JOIN notes 验证 user_id (参考 32_notes.sql 的 note_node_links 模式)
-- =====================================================
ALTER TABLE note_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own note embeddings" ON note_embeddings FOR SELECT USING (
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_embeddings.note_id AND notes.user_id = auth.uid())
);

CREATE POLICY "Users can insert own note embeddings" ON note_embeddings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_embeddings.note_id AND notes.user_id = auth.uid())
);

CREATE POLICY "Users can update own note embeddings" ON note_embeddings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_embeddings.note_id AND notes.user_id = auth.uid())
);

CREATE POLICY "Users can delete own note embeddings" ON note_embeddings FOR DELETE USING (
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_embeddings.note_id AND notes.user_id = auth.uid())
);


-- ==== from 24_note_block_refs.sql ====
-- =====================================================
-- 2. RLS 行级安全策略（双向校验：source_note 与 target_note 均属当前用户）
-- =====================================================
ALTER TABLE note_block_refs ENABLE ROW LEVEL SECURITY;

-- SELECT：source 与 target 均属当前用户
CREATE POLICY "note_block_refs_select_own" ON note_block_refs FOR SELECT USING (
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_block_refs.source_note_id AND notes.user_id = auth.uid())
  AND
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_block_refs.target_note_id AND notes.user_id = auth.uid())
);

-- INSERT：source 与 target 均属当前用户
CREATE POLICY "note_block_refs_insert_own" ON note_block_refs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_block_refs.source_note_id AND notes.user_id = auth.uid())
  AND
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_block_refs.target_note_id AND notes.user_id = auth.uid())
);

-- UPDATE：source 与 target 均属当前用户（USING 控制可更新行，WITH CHECK 控制更新后状态）
CREATE POLICY "note_block_refs_update_own" ON note_block_refs FOR UPDATE USING (
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_block_refs.source_note_id AND notes.user_id = auth.uid())
  AND
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_block_refs.target_note_id AND notes.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_block_refs.source_note_id AND notes.user_id = auth.uid())
  AND
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_block_refs.target_note_id AND notes.user_id = auth.uid())
);

-- DELETE：source 或 target 任一方属当前用户即可删除（允许任一方属主解除引用关系）
CREATE POLICY "note_block_refs_delete_own" ON note_block_refs FOR DELETE USING (
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_block_refs.source_note_id AND notes.user_id = auth.uid())
  OR
  EXISTS (SELECT 1 FROM notes WHERE notes.id = note_block_refs.target_note_id AND notes.user_id = auth.uid())
);


-- ==== from 25_audit_logs.sql ====
-- RLS：默认仅允许写入（service_role 绕过 RLS 由服务端写入），普通用户仅可读自己的审计记录
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own audit logs" ON audit_logs FOR SELECT USING (auth.uid() = user_id);


-- ==== from 26_error_reports.sql ====
-- RLS：遥测错误可能含栈/URL 等内部信息，默认仅允许服务端
-- （getSupabaseAdmin 作为 service_role 绕过 RLS）写入与读取，普通客户端不可读写。
ALTER TABLE error_reports ENABLE ROW LEVEL SECURITY;


-- ==== from 27_literature_sources.sql ====
-- RLS Policies
ALTER TABLE literature_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view literature sources for their graphs"
  ON literature_sources FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_graphs
      WHERE knowledge_graphs.id = literature_sources.graph_id
        AND (
          knowledge_graphs.user_id = auth.uid()
          OR knowledge_graphs.is_public = true
        )
    )
  );

CREATE POLICY "Users can insert literature sources for their own graphs"
  ON literature_sources FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM knowledge_graphs
      WHERE knowledge_graphs.id = literature_sources.graph_id
        AND knowledge_graphs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update literature sources for their own graphs"
  ON literature_sources FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_graphs
      WHERE knowledge_graphs.id = literature_sources.graph_id
        AND knowledge_graphs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete literature sources for their own graphs"
  ON literature_sources FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_graphs
      WHERE knowledge_graphs.id = literature_sources.graph_id
        AND knowledge_graphs.user_id = auth.uid()
    )
  );


-- ==== from 28_learning_material_schemas.sql ====
-- =====================================================
-- RLS Policies
-- =====================================================
ALTER TABLE learning_material_schemas ENABLE ROW LEVEL SECURITY;

-- System schemas: 所有登录用户可见
CREATE POLICY "System learning schemas are viewable by everyone"
  ON learning_material_schemas FOR SELECT
  USING (scope = 'system');

-- Graph-level schemas: 对应图谱内用户可见（图谱所有权在 service 层校验）
CREATE POLICY "Users can view graph-level learning schemas"
  ON learning_material_schemas FOR SELECT
  USING (scope = 'graph' AND auth.uid() = user_id);

-- User-level schemas: 只有拥有者可见
CREATE POLICY "Users can view their own learning schemas"
  ON learning_material_schemas FOR SELECT
  USING (scope = 'user' AND auth.uid() = user_id);

-- User/Graph schema 写入: 只有拥有者
CREATE POLICY "Users can insert their own learning schemas"
  ON learning_material_schemas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own learning schemas"
  ON learning_material_schemas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own learning schemas"
  ON learning_material_schemas FOR DELETE
  USING (auth.uid() = user_id);

