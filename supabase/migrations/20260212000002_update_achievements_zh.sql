-- Update existing achievements to Chinese
UPDATE achievements SET name = '初出茅庐', description = '保持3天连续学习' WHERE code = 'streak_3';
UPDATE achievements SET name = '坚持不懈', description = '保持7天连续学习' WHERE code = 'streak_7';
UPDATE achievements SET name = '月度大师', description = '保持30天连续学习' WHERE code = 'streak_30';

UPDATE achievements SET name = '深度潜入', description = '完成60分钟专注时间' WHERE code = 'focus_60';
UPDATE achievements SET name = '专注大师', description = '完成300分钟(5小时)专注时间' WHERE code = 'focus_300';

UPDATE achievements SET name = '跬步千里', description = '掌握10张知识卡片' WHERE code = 'mastery_10';
UPDATE achievements SET name = '求知若渴', description = '掌握50张知识卡片' WHERE code = 'mastery_50';
UPDATE achievements SET name = '领域专家', description = '掌握100张知识卡片' WHERE code = 'mastery_100';

-- Insert new achievements
INSERT INTO achievements (code, name, description, category, icon, xp_reward, condition_type, condition_value) VALUES
  -- Streak
  ('streak_14', '持之以恒', '保持14天连续学习', 'study', 'Zap', 500, 'streak_days', 14),
  ('streak_100', '百日筑基', '保持100天连续学习', 'study', 'Crown', 5000, 'streak_days', 100),
  
  -- Focus
  ('focus_10', '专注时刻', '完成10分钟专注时间', 'focus', 'Timer', 50, 'focus_minutes', 10),
  ('focus_1000', '心流境界', '完成1000分钟专注时间', 'focus', 'Brain', 1500, 'focus_minutes', 1000),
  
  -- Mastery
  ('mastery_1', '初试牛刀', '掌握1张知识卡片', 'study', 'GraduationCap', 50, 'cards_mastered', 1),
  ('mastery_500', '博闻强识', '掌握500张知识卡片', 'study', 'Trophy', 2500, 'cards_mastered', 500),

  -- Creation (New)
  ('creation_graph_1', '创世之初', '创建第1个知识图谱', 'creation', 'BookOpen', 200, 'graphs_created', 1),
  ('creation_graph_5', '知识架构师', '创建5个知识图谱', 'creation', 'BookOpen', 800, 'graphs_created', 5),
  ('creation_node_10', '萌芽', '创建10个知识节点', 'creation', 'Target', 100, 'nodes_created', 10),
  ('creation_node_100', '枝繁叶茂', '创建100个知识节点', 'creation', 'Target', 500, 'nodes_created', 100),
  ('creation_node_1000', '知识森林', '创建1000个知识节点', 'creation', 'Target', 2000, 'nodes_created', 1000)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  xp_reward = EXCLUDED.xp_reward;
