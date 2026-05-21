-- =====================================================
-- Knowledge Map - [Seed: Achievements]
-- =====================================================

INSERT INTO achievements (code, name, description, category, icon, color, xp_reward, condition_type, condition_value, is_hidden, trigger_events) VALUES
-- Study streak achievements
  ('streak_3', '初出茅庐', '保持3天连续学习', 'study', 'Flame', '#F97316', 100, 'streak_days', 3, FALSE, '{focus_session_ended}'),
  ('streak_7', '坚持不懈', '保持7天连续学习', 'study', 'Zap', '#3B82F6', 300, 'streak_days', 7, FALSE, '{focus_session_ended}'),
  ('streak_14', '持之以恒', '保持14天连续学习', 'study', 'Zap', '#8B5CF6', 500, 'streak_days', 14, FALSE, '{focus_session_ended}'),
  ('streak_30', '月度大师', '保持30天连续学习', 'study', 'Crown', '#A855F7', 1000, 'streak_days', 30, FALSE, '{focus_session_ended}'),
  ('streak_100', '百日筑基', '保持100天连续学习', 'study', 'Crown', '#FCD34D', 5000, 'streak_days', 100, FALSE, '{focus_session_ended}'),
-- Focus time achievements
  ('focus_10', '专注时刻', '完成10分钟专注时间', 'focus', 'Timer', '#10B981', 50, 'focus_minutes', 10, FALSE, '{focus_session_ended}'),
  ('focus_60', '深度潜入', '完成60分钟专注时间', 'focus', 'Timer', '#3B82F6', 150, 'focus_minutes', 60, FALSE, '{focus_session_ended}'),
  ('focus_300', '专注大师', '完成300分钟(5小时)专注时间', 'focus', 'Brain', '#8B5CF6', 500, 'focus_minutes', 300, FALSE, '{focus_session_ended}'),
  ('focus_1000', '心流境界', '完成1000分钟专注时间', 'focus', 'Brain', '#EC4899', 1500, 'focus_minutes', 1000, FALSE, '{focus_session_ended}'),
-- Mastery achievements
  ('mastery_1', '初试牛刀', '掌握1张知识卡片', 'study', 'GraduationCap', '#10B981', 50, 'cards_mastered', 1, FALSE, '{review_completed}'),
  ('mastery_10', '跬步千里', '掌握10张知识卡片', 'study', 'GraduationCap', '#3B82F6', 100, 'cards_mastered', 10, FALSE, '{review_completed}'),
  ('mastery_50', '求知若渴', '掌握50张知识卡片', 'study', 'BookOpen', '#8B5CF6', 300, 'cards_mastered', 50, FALSE, '{review_completed}'),
  ('mastery_100', '领域专家', '掌握100张知识卡片', 'study', 'Trophy', '#F59E0B', 600, 'cards_mastered', 100, FALSE, '{review_completed}'),
  ('mastery_500', '博闻强识', '掌握500张知识卡片', 'study', 'Trophy', '#FCD34D', 2500, 'cards_mastered', 500, FALSE, '{review_completed}'),
-- Creation achievements
  ('creation_graph_1', '创世之初', '创建第1个知识图谱', 'creation', 'BookOpen', '#10B981', 200, 'graphs_created', 1, FALSE, '{graph_created}'),
  ('creation_graph_5', '知识架构师', '创建5个知识图谱', 'creation', 'BookOpen', '#3B82F6', 800, 'graphs_created', 5, FALSE, '{graph_created}'),
  ('creation_node_10', '萌芽', '创建10个知识节点', 'creation', 'Target', '#F59E0B', 100, 'nodes_created', 10, FALSE, '{node_created, graph_created}'),
  ('creation_node_100', '枝繁叶茂', '创建100个知识节点', 'creation', 'Target', '#8B5CF6', 500, 'nodes_created', 100, FALSE, '{node_created, graph_created}'),
  ('creation_node_1000', '知识森林', '创建1000个知识节点', 'creation', 'Target', '#FCD34D', 2000, 'nodes_created', 1000, FALSE, '{node_created, graph_created}'),
-- Focus achievements (new)
  ('first_focus', '初次专注', '完成第一次专注会话', 'focus', '🎯', '#10B981', 10, 'focus_sessions', 1, FALSE, '{focus_session_ended}'),
  ('focus_1h', '一小时达人', '累计专注时间达到1小时', 'focus', '⏱️', '#3B82F6', 20, 'total_focus_hours', 1, FALSE, '{focus_session_ended}'),
  ('focus_10h', '专注新手', '累计专注时间达到10小时', 'focus', '🔥', '#F59E0B', 50, 'total_focus_hours', 10, FALSE, '{focus_session_ended}'),
  ('focus_50h', '专注达人', '累计专注时间达到50小时', 'focus', '💪', '#8B5CF6', 100, 'total_focus_hours', 50, FALSE, '{focus_session_ended}'),
  ('focus_100h', '专注大师', '累计专注时间达到100小时', 'focus', '🏆', '#EC4899', 200, 'total_focus_hours', 100, FALSE, '{focus_session_ended}'),
  ('focus_500h', '专注传奇', '累计专注时间达到500小时', 'focus', '👑', '#FCD34D', 500, 'total_focus_hours', 500, FALSE, '{focus_session_ended}'),
  ('daily_4h', '高效一天', '单日专注时间达到4小时', 'focus', '⚡', '#06B6D4', 50, 'daily_focus_hours', 4, FALSE, '{focus_session_ended}'),
  ('daily_8h', '极限挑战', '单日专注时间达到8小时', 'focus', '🚀', '#EF4444', 100, 'daily_focus_hours', 8, FALSE, '{focus_session_ended}'),
-- Streak achievements (new)
  ('streak_3_new', '三天坚持', '连续专注3天', 'streak', '🌟', '#F97316', 30, 'consecutive_days', 3, FALSE, '{focus_session_ended}'),
  ('streak_7_new', '一周达人', '连续专注7天', 'streak', '✨', '#84CC16', 70, 'consecutive_days', 7, FALSE, '{focus_session_ended}'),
  ('streak_14_new', '两周毅力', '连续专注14天', 'streak', '💫', '#14B8A6', 140, 'consecutive_days', 14, FALSE, '{focus_session_ended}'),
  ('streak_30_new', '月度冠军', '连续专注30天', 'streak', '🏅', '#A855F7', 300, 'consecutive_days', 30, FALSE, '{focus_session_ended}'),
  ('streak_100_new', '百日传奇', '连续专注100天', 'streak', '💎', '#F43F5E', 1000, 'consecutive_days', 100, FALSE, '{focus_session_ended}'),
-- Task achievements
  ('tasks_10', '任务新手', '完成10个任务', 'tasks', '📋', '#6366F1', 30, 'tasks_completed', 10, FALSE, '{task_completed}'),
  ('tasks_50', '任务达人', '完成50个任务', 'tasks', '📝', '#8B5CF6', 100, 'tasks_completed', 50, FALSE, '{task_completed}'),
  ('tasks_100', '任务大师', '完成100个任务', 'tasks', '🎖️', '#EC4899', 200, 'tasks_completed', 100, FALSE, '{task_completed}'),
  ('tasks_500', '任务传奇', '完成500个任务', 'tasks', '🏅', '#F59E0B', 500, 'tasks_completed', 500, FALSE, '{task_completed}'),
-- Pomodoro achievements
  ('pomodoro_10', '番茄新手', '完成10个番茄钟', 'focus', '🍅', '#EF4444', 20, 'pomodoros_completed', 10, FALSE, '{focus_session_ended}'),
  ('pomodoro_50', '番茄达人', '完成50个番茄钟', 'focus', '🍅', '#F97316', 50, 'pomodoros_completed', 50, FALSE, '{focus_session_ended}'),
  ('pomodoro_100', '番茄大师', '完成100个番茄钟', 'focus', '🍅', '#DC2626', 100, 'pomodoros_completed', 100, FALSE, '{focus_session_ended}'),
-- Special achievements
  ('night_owl', '夜猫子', '在凌晨(0:00-5:00)完成专注会话', 'special', '🦉', '#6366F1', 30, 'special_condition', 1, TRUE, '{focus_session_ended, task_completed}'),
  ('early_bird', '早起鸟', '在早晨(5:00-7:00)完成专注会话', 'special', '🐦', '#FBBF24', 30, 'special_condition', 1, TRUE, '{focus_session_ended, task_completed}'),
  ('weekend_warrior', '周末战士', '在周末完成4小时专注', 'special', '⚔️', '#8B5CF6', 50, 'special_condition', 1, TRUE, '{focus_session_ended, task_completed}'),
  ('perfectionist', '完美主义者', '一天内完成所有计划任务', 'special', '✅', '#10B981', 50, 'special_condition', 1, TRUE, '{focus_session_ended, task_completed}'),
  ('multitasker', '多面手', '在一天内完成5个不同任务', 'special', '🎭', '#EC4899', 40, 'special_condition', 1, TRUE, '{focus_session_ended, task_completed}'),
-- Weekly streak achievements
  ('weekly_streak_4', '四周坚持', '连续完成4周所有周任务', 'streak', '📅', '#10B981', 100, 'weekly_streak', 4, FALSE, '{}'),
  ('weekly_streak_8', '两月坚持', '连续完成8周所有周任务', 'streak', '📆', '#3B82F6', 200, 'weekly_streak', 8, FALSE, '{}'),
  ('weekly_streak_12', '季度坚持', '连续完成12周所有周任务', 'streak', '🗓️', '#8B5CF6', 400, 'weekly_streak', 12, FALSE, '{}'),
-- Monthly streak achievements
  ('monthly_streak_3', '三月连冠', '连续完成3个月所有月任务', 'streak', '🏆', '#F59E0B', 300, 'monthly_streak', 3, FALSE, '{}'),
  ('monthly_streak_6', '半年传奇', '连续完成6个月所有月任务', 'streak', '👑', '#EC4899', 600, 'monthly_streak', 6, FALSE, '{}'),
  ('monthly_streak_12', '年度霸主', '连续完成12个月所有月任务', 'streak', '💎', '#FCD34D', 1500, 'monthly_streak', 12, FALSE, '{}'),
-- Quarterly streak achievements
  ('quarterly_streak_2', '半年坚持', '连续完成2个季度所有任务', 'streak', '🌟', '#14B8A6', 500, 'quarterly_streak', 2, FALSE, '{}'),
  ('quarterly_streak_4', '年度传奇', '连续完成4个季度所有任务', 'streak', '🏅', '#A855F7', 1000, 'quarterly_streak', 4, FALSE, '{}'),
-- Daily task streak achievements
  ('daily_streak_7', '周常达人', '连续7天完成所有每日任务', 'streak', '🔥', '#F97316', 50, 'daily_task_streak', 7, FALSE, '{}'),
  ('daily_streak_14', '两周毅力', '连续14天完成所有每日任务', 'streak', '💪', '#EF4444', 100, 'daily_task_streak', 14, FALSE, '{}'),
  ('daily_streak_30', '月度坚持', '连续30天完成所有每日任务', 'streak', '🎯', '#DC2626', 300, 'daily_task_streak', 30, FALSE, '{}'),
  ('daily_streak_60', '双月传奇', '连续60天完成所有每日任务', 'streak', '⭐', '#7C3AED', 600, 'daily_task_streak', 60, FALSE, '{}'),
  ('daily_streak_100', '百日王者', '连续100天完成所有每日任务', 'streak', '👑', '#FCD34D', 1000, 'daily_task_streak', 100, FALSE, '{}')
ON CONFLICT (code) DO NOTHING;
