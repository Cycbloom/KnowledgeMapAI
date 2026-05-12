-- =====================================================
-- Knowledge Map - Graph Backbone Modules
-- =====================================================

CREATE TABLE IF NOT EXISTS graph_backbone_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  module_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  icon VARCHAR(10),
  color VARCHAR(20),
  description TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(graph_id, module_type)
);

COMMENT ON TABLE graph_backbone_modules IS '图谱骨干模块配置表，存储专题研究图谱的骨干模块信息';
COMMENT ON COLUMN graph_backbone_modules.graph_id IS '所属图谱ID';
COMMENT ON COLUMN graph_backbone_modules.module_type IS '模块类型：research_background, literature_review, research_methods, core_concepts, application_domains, future_directions';
COMMENT ON COLUMN graph_backbone_modules.title IS '模块标题';
COMMENT ON COLUMN graph_backbone_modules.icon IS '模块图标（emoji）';
COMMENT ON COLUMN graph_backbone_modules.color IS '模块颜色';
COMMENT ON COLUMN graph_backbone_modules.description IS '模块描述';
COMMENT ON COLUMN graph_backbone_modules.display_order IS '显示顺序';

CREATE INDEX IF NOT EXISTS idx_graph_backbone_modules_graph_id ON graph_backbone_modules(graph_id);
CREATE INDEX IF NOT EXISTS idx_graph_backbone_modules_module_type ON graph_backbone_modules(module_type);
