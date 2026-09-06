-- =====================================================
-- Knowledge Map - 任务子任务编排（刷新/重置/按学习路径切换）
-- =====================================================

-- 图任务当前应用的学习路径（一图一大任务，多条路径间切换时记忆当前编排来源）
-- 指向 learning_paths.id；路径被删除时自动置空（SET NULL）
ALTER TABLE user_tasks
  ADD COLUMN IF NOT EXISTS active_learning_path_id UUID
    REFERENCES learning_paths(id) ON DELETE SET NULL;

COMMENT ON COLUMN user_tasks.active_learning_path_id IS
  '图任务当前编排采用的学习路径ID（task_type=graph_learning 时使用）；空表示不按路径（展示全部子任务）';