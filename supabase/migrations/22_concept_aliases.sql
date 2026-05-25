-- =====================================================
-- Knowledge Map - [Concept Aliases]
-- =====================================================

-- 为 knowledge_points 表添加别名字段
ALTER TABLE knowledge_points
ADD COLUMN IF NOT EXISTS aliases TEXT[] DEFAULT '{}';

COMMENT ON COLUMN knowledge_points.aliases IS '概念别名列表，用于同义词聚合和搜索匹配';
