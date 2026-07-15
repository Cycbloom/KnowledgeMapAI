-- =====================================================
-- Knowledge Map - Row Level Security Policies
-- =====================================================

-- Helper function to check if user is a collaborator (breaks RLS circular dependency)
CREATE OR REPLACE FUNCTION public.is_graph_collaborator(p_graph_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM graph_collaborators
    WHERE graph_id = p_graph_id
    AND user_id = p_user_id
    AND accepted_at IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

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
CREATE POLICY "Anyone can view templates" ON templates FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create custom templates" ON templates FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own templates" ON templates FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own templates" ON templates FOR DELETE USING (auth.uid() = user_id OR is_system = false);

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


