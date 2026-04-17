-- =====================================================
-- Knowledge Map - [Seed: Pass Rewards]
-- =====================================================

INSERT INTO pass_rewards (period_type, level, points_required, reward_type, reward_value, name, description, icon) VALUES
-- Weekly Pass (5 levels, 50 points total)
('weekly', 1, 10, 'xp', 50, '起步者', '完成第一个周任务', '🌱'),
('weekly', 2, 20, 'xp', 50, '初见成效', '继续努力', '⭐'),
('weekly', 3, 30, 'xp', 75, '渐入佳境', '保持势头', '✨'),
('weekly', 4, 40, 'xp', 75, '周常达人', '完成所有周任务', '🏆'),
('weekly', 5, 50, 'achievement', 0, '周冠军', '连续完成周任务', '🥇'),

-- Monthly Pass (15 levels, ~150 points total)
('monthly', 1, 10, 'xp', 50, '月度起步', '开始你的月度旅程', '📅'),
('monthly', 2, 20, 'xp', 50, '稳步前行', '持续进步', '📈'),
('monthly', 3, 30, 'xp', 75, '小有成就', '月度任务进行中', '🎯'),
('monthly', 4, 40, 'xp', 75, '坚持就是胜利', '保持专注', '💪'),
('monthly', 5, 50, 'xp', 100, '月度中坚', '完成一半目标', '🌟'),
('monthly', 6, 60, 'xp', 100, '势不可挡', '继续冲刺', '🔥'),
('monthly', 7, 70, 'xp', 125, '接近终点', '胜利在望', '💫'),
('monthly', 8, 80, 'xp', 125, '月度精英', '即将完成', '🏅'),
('monthly', 9, 90, 'xp', 150, '月度大师', '几乎完成', '👑'),
('monthly', 10, 100, 'achievement', 0, '月度冠军', '完成所有月任务', '🥇'),
('monthly', 11, 110, 'xp', 150, '超额完成', '超越目标', '🚀'),
('monthly', 12, 120, 'xp', 175, '月度传奇', '持续超越', '💎'),
('monthly', 13, 130, 'xp', 175, '月度神话', '非凡成就', '🌈'),
('monthly', 14, 140, 'xp', 200, '月度至尊', '登峰造极', '🏆'),
('monthly', 15, 150, 'achievement', 0, '月度之神', '完美月度', '⚡'),

-- Quarterly Pass (15 levels, ~300 points total)
('quarterly', 1, 20, 'xp', 75, '季度启程', '开始你的季度旅程', '🗓️'),
('quarterly', 2, 40, 'xp', 75, '季度进展', '稳步前进', '📊'),
('quarterly', 3, 60, 'xp', 100, '季度中坚', '保持势头', '🎯'),
('quarterly', 4, 80, 'xp', 100, '季度精英', '持续努力', '⭐'),
('quarterly', 5, 100, 'xp', 125, '季度达人', '表现优秀', '🌟'),
('quarterly', 6, 120, 'xp', 125, '季度高手', '技艺精湛', '💫'),
('quarterly', 7, 140, 'xp', 150, '季度专家', '专业水准', '🏅'),
('quarterly', 8, 160, 'xp', 150, '季度大师', '登峰造极', '👑'),
('quarterly', 9, 180, 'xp', 175, '季度传奇', '非凡成就', '💎'),
('quarterly', 10, 200, 'achievement', 0, '季度冠军', '完成所有季度任务', '🥇'),
('quarterly', 11, 220, 'xp', 175, '超额完成', '超越目标', '🚀'),
('quarterly', 12, 240, 'xp', 200, '季度神话', '持续超越', '🌈'),
('quarterly', 13, 260, 'xp', 200, '季度至尊', '非凡表现', '🏆'),
('quarterly', 14, 280, 'xp', 225, '季度之神', '登峰造极', '⚡'),
('quarterly', 15, 300, 'achievement', 0, '完美季度', '季度完美表现', '🌟')
ON CONFLICT (period_type, level) DO NOTHING;
