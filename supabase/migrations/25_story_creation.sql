-- =====================================================
-- Story Creation - 小说/故事创作图谱 (MVP)
-- =====================================================

-- =====================================================
-- Table 1: story_structures（故事结构骨架）⭐ 核心
-- =====================================================

CREATE TABLE IF NOT EXISTS story_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  structure_level VARCHAR(20) NOT NULL CHECK (
    structure_level IN ('story', 'act', 'sequence', 'chapter', 'scene')
  ),
  parent_structure_id UUID REFERENCES story_structures(id) ON DELETE CASCADE,
  title VARCHAR(512) NOT NULL,
  synopsis TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  template_beat_id VARCHAR(100),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_structures_graph_id ON story_structures(graph_id);
CREATE INDEX IF NOT EXISTS idx_story_structures_parent_id ON story_structures(parent_structure_id);
CREATE INDEX IF NOT EXISTS idx_story_structures_level ON story_structures(structure_level);

COMMENT ON TABLE story_structures IS '故事结构骨架表，存储幕/序列/章节/场景的层级结构';
COMMENT ON COLUMN story_structures.id IS '主键ID';
COMMENT ON COLUMN story_structures.graph_id IS '关联的知识图谱ID';
COMMENT ON COLUMN story_structures.structure_level IS '结构层级: story(故事), act(幕), sequence(序列), chapter(章), scene(场景)';
COMMENT ON COLUMN story_structures.parent_structure_id IS '父节点ID，用于构建树形结构';
COMMENT ON COLUMN story_structures.title IS '标题';
COMMENT ON COLUMN story_structures.synopsis IS '简短描述/摘要';
COMMENT ON COLUMN story_structures.display_order IS '显示顺序';
COMMENT ON COLUMN story_structures.template_beat_id IS '关联模板节拍ID';
COMMENT ON COLUMN story_structures.metadata IS '扩展元数据，JSON格式';

-- =====================================================
-- Table 2: story_characters（角色档案）⭐ 核心
-- =====================================================

CREATE TABLE IF NOT EXISTS story_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  role_type VARCHAR(50) NOT NULL CHECK (
    role_type IN ('protagonist', 'antagonist', 'supporting', 'minor')
  ),
  archetype VARCHAR(100),
  appearance TEXT,
  age VARCHAR(50),
  gender VARCHAR(20),
  motivation TEXT,
  fear TEXT,
  desire TEXT,
  flaw TEXT,
  backstory TEXT,
  arc_start TEXT,
  arc_end TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_characters_graph_id ON story_characters(graph_id);

COMMENT ON TABLE story_characters IS '角色档案表，存储故事中的角色信息和心理画像';
COMMENT ON COLUMN story_characters.id IS '主键ID';
COMMENT ON COLUMN story_characters.graph_id IS '关联的知识图谱ID';
COMMENT ON COLUMN story_characters.name IS '角色名称';
COMMENT ON COLUMN story_characters.role_type IS '角色类型: protagonist(主角), antagonist(反派), supporting(配角), minor(次要)';
COMMENT ON COLUMN story_characters.archetype IS '角色原型（如英雄、智者、阴影等）';
COMMENT ON COLUMN story_characters.appearance IS '外貌描述';
COMMENT ON COLUMN story_characters.age IS '年龄';
COMMENT ON COLUMN story_characters.gender IS '性别';
COMMENT ON COLUMN story_characters.motivation IS '核心动机';
COMMENT ON COLUMN story_characters.fear IS '核心恐惧';
COMMENT ON COLUMN story_characters.desire IS '核心欲望';
COMMENT ON COLUMN story_characters.flaw IS '致命弱点';
COMMENT ON COLUMN story_characters.backstory IS '背景故事';
COMMENT ON COLUMN story_characters.arc_start IS '角色弧线起点';
COMMENT ON COLUMN story_characters.arc_end IS '角色弧线终点';

-- =====================================================
-- Table 3: story_character_relationships（角色关系）
-- =====================================================

CREATE TABLE IF NOT EXISTS story_character_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  source_character_id UUID NOT NULL REFERENCES story_characters(id) ON DELETE CASCADE,
  target_character_id UUID NOT NULL REFERENCES story_characters(id) ON DELETE CASCADE,
  relationship_type VARCHAR(50) NOT NULL,
  strength INTEGER NOT NULL DEFAULT 5 CHECK (strength BETWEEN 1 AND 10),
  status VARCHAR(50) DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(graph_id, source_character_id, target_character_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_story_char_rel_graph ON story_character_relationships(graph_id);

COMMENT ON TABLE story_character_relationships IS '角色关系表，记录角色间的复杂关系网络';
COMMENT ON COLUMN story_character_relationships.id IS '主键ID';
COMMENT ON COLUMN story_character_relationships.graph_id IS '关联的知识图谱ID';
COMMENT ON COLUMN story_character_relationships.source_character_id IS '源角色ID（关系的发起方）';
COMMENT ON COLUMN story_character_relationships.target_character_id IS '目标角色ID（关系的接受方）';
COMMENT ON COLUMN story_character_relationships.relationship_type IS '关系类型（如朋友、敌人、恋人等）';
COMMENT ON COLUMN story_character_relationships.strength IS '关系强度（1-10）';
COMMENT ON COLUMN story_character_relationships.status IS '关系状态（默认active）';
COMMENT ON COLUMN story_character_relationships.notes IS '关系说明/备注';

-- =====================================================
-- Table 4: story_scene_details（场景详情）⭐ 核心
-- =====================================================

CREATE TABLE IF NOT EXISTS story_scene_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  structure_id UUID NOT NULL REFERENCES story_structures(id) ON DELETE CASCADE,
  pov_character_id UUID REFERENCES story_characters(id),
  synopsis TEXT,
  content TEXT,
  location_name VARCHAR(255),
  time_setting VARCHAR(100),
  writing_status VARCHAR(20) DEFAULT 'draft' CHECK (
    writing_status IN ('draft', 'revising', 'complete')
  ),
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_scene_details_graph ON story_scene_details(graph_id);
CREATE INDEX IF NOT EXISTS idx_story_scene_details_structure ON story_scene_details(structure_id);

COMMENT ON TABLE story_scene_details IS '场景详情表，存储场景的具体内容、元数据和写作状态';
COMMENT ON COLUMN story_scene_details.id IS '主键ID';
COMMENT ON COLUMN story_scene_details.graph_id IS '关联的知识图谱ID';
COMMENT ON COLUMN story_scene_details.structure_id IS '关联的结构节点ID（story_structures.id）';
COMMENT ON COLUMN story_scene_details.pov_character_id IS 'POV视角角色ID';
COMMENT ON COLUMN story_scene_details.synopsis IS '场景摘要';
COMMENT ON COLUMN story_scene_details.content IS '场景正文内容';
COMMENT ON COLUMN story_scene_details.location_name IS '地点名称';
COMMENT ON COLUMN story_scene_details.time_setting IS '时间设定';
COMMENT ON COLUMN story_scene_details.writing_status IS '写作状态: draft(草稿), revising(修改中), complete(完成)';
COMMENT ON COLUMN story_scene_details.word_count IS '字数统计';

-- =====================================================
-- Table 5: story_appearances（出场记录）
-- =====================================================

CREATE TABLE IF NOT EXISTS story_appearances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_id UUID NOT NULL REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
  character_id UUID NOT NULL REFERENCES story_characters(id) ON DELETE CASCADE,
  scene_detail_id UUID NOT NULL REFERENCES story_scene_details(id) ON DELETE CASCADE,
  role_in_scene VARCHAR(20) DEFAULT 'supporting' CHECK (
    role_in_scene IN ('protagonist', 'antagonist', 'supporting', 'minor', 'mentioned')
  ),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(graph_id, character_id, scene_detail_id)
);

CREATE INDEX IF NOT EXISTS idx_story_appearances_graph ON story_appearances(graph_id);

COMMENT ON TABLE story_appearances IS '出场记录表，记录角色在哪些场景中出现及其角色定位';
COMMENT ON COLUMN story_appearances.id IS '主键ID';
COMMENT ON COLUMN story_appearances.graph_id IS '关联的知识图谱ID';
COMMENT ON COLUMN story_appearances.character_id IS '角色ID';
COMMENT ON COLUMN story_appearances.scene_detail_id IS '场景详情ID';
COMMENT ON COLUMN story_appearances.role_in_scene IS '在该场景中的角色类型: protagonist(主角), antagonist(反派), supporting(配角), minor(次要), mentioned(提及)';
COMMENT ON COLUMN story_appearances.notes IS '出场说明/备注';

-- =====================================================
-- Table 6: story_templates（故事结构模板）
-- =====================================================

CREATE TABLE IF NOT EXISTS story_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  name_zh VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) DEFAULT 'classical',
  beats JSONB NOT NULL DEFAULT '[]',
  is_system BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE story_templates IS '故事结构模板表，存储经典叙事结构的节拍定义';
COMMENT ON COLUMN story_templates.id IS '主键ID';
COMMENT ON COLUMN story_templates.template_code IS '模板唯一标识码（如 three_act）';
COMMENT ON COLUMN story_templates.name IS '英文名称';
COMMENT ON COLUMN story_templates.name_zh IS '中文名称';
COMMENT ON COLUMN story_templates.description IS '模板描述';
COMMENT ON COLUMN story_templates.category IS '模板分类（默认classical）';
COMMENT ON COLUMN story_templates.beats IS '节拍定义数组，JSON格式';
COMMENT ON COLUMN story_templates.is_system IS '是否系统内置模板';

-- =====================================================
-- Seed Data: 三幕式模板（Three-Act Structure）
-- =====================================================

INSERT INTO story_templates (template_code, name, name_zh, description, category, beats, is_system) VALUES
(
  'three_act',
  'Three-Act Structure',
  '三幕式结构',
  '经典的叙事结构，将故事分为开端、对抗、解决三个部分。适用于大多数商业小说和电影。',
  'classical',
  '[
    {
      "id": "act1_setup",
      "name": "Act I: Setup",
      "name_zh": "第一幕：铺垫",
      "order": 1,
      "level": "act",
      "percentage_start": 0,
      "percentage_end": 25,
      "description": "介绍平凡世界、角色现状和核心问题。建立读者的情感连接。"
    },
    {
      "id": "act1_call",
      "name": "Call to Adventure",
      "name_zh": "冒险召唤",
      "order": 2,
      "level": "sequence",
      "parent_act": "act1_setup",
      "description": "打破日常的事件发生，主角面临选择。"
    },
    {
      "id": "act1_threshold",
      "name": "Crossing the Threshold",
      "name_zh": "跨越门槛",
      "order": 3,
      "level": "sequence",
      "parent_act": "act1_setup",
      "description": "主角决定踏上旅程，离开舒适区。"
    },
    {
      "id": "act2_confrontation",
      "name": "Act II: Confrontation",
      "name_zh": "第二幕：对抗",
      "order": 4,
      "level": "act",
      "percentage_start": 25,
      "percentage_end": 75,
      "description": "试炼、盟友、敌人，逐渐接近目标。故事的主要冲突在此展开。"
    },
    {
      "id": "act2_rising",
      "name": "Rising Action",
      "name_zh": "上升动作",
      "order": 5,
      "level": "sequence",
      "parent_act": "act2_confrontation",
      "description": "一系列挑战和考验，主角逐步成长。"
    },
    {
      "id": "act2_midpoint",
      "name": "Midpoint",
      "name_zh": "中点",
      "order": 6,
      "level": "sequence",
      "parent_act": "act2_confrontation",
      "description": "重大转折点，信息揭露或方向改变。主角从被动转为主动。"
    },
    {
      "id": "act2_crisis",
      "name": "Crisis / All Is Lost",
      "name_zh": "危机/一无所有",
      "order": 7,
      "level": "sequence",
      "parent_act": "act2_confrontation",
      "description": "看似失败的低谷时刻，主角必须面对最大的恐惧。"
    },
    {
      "id": "act3_resolution",
      "name": "Act III: Resolution",
      "name_zh": "第三幕：解决",
      "order": 8,
      "level": "act",
      "percentage_start": 75,
      "percentage_end": 100,
      "description": "最终对决、变革和新的平衡。故事的高潮和收尾。"
    },
    {
      "id": "act3_climax",
      "name": "Climax",
      "name_zh": "高潮",
      "order": 9,
      "level": "sequence",
      "parent_act": "act3_resolution",
      "description": "最大的冲突和转折，主角面对终极挑战。"
    },
    {
      "id": "act3_denouement",
      "name": "Denouement",
      "name_zh": "尾声",
      "order": 10,
      "level": "sequence",
      "parent_act": "act3_resolution",
      "description": "收尾和新常态，展示角色的成长和变化。"
    }
  ]'::jsonb,
  true
);

-- =====================================================
-- Triggers: 自动更新 updated_at 字段
-- =====================================================

CREATE TRIGGER story_structures_updated_at
  BEFORE UPDATE ON story_structures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER story_characters_updated_at
  BEFORE UPDATE ON story_characters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER story_character_relationships_updated_at
  BEFORE UPDATE ON story_character_relationships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER story_scene_details_updated_at
  BEFORE UPDATE ON story_scene_details
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
