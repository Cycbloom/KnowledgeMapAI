-- =====================================================
-- 远程数据库迁移脚本
-- 日期: 2026-04-15
-- 说明: AI 图谱创建流程重构 - 模板分类体系重构 + 提示词集成
-- 在 Supabase Dashboard SQL Editor 中执行
-- =====================================================

-- =====================================================
-- 1. TEMPLATES 表 Schema 变更
-- =====================================================

-- 删除旧的 category CHECK 约束
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_category_check;

-- 添加新的 category CHECK 约束（新分类体系）
ALTER TABLE templates ADD CONSTRAINT templates_category_check 
  CHECK (category IN ('knowledge', 'project', 'analysis', 'architecture'));

-- 添加 template_type 列
ALTER TABLE templates ADD COLUMN IF NOT EXISTS template_type VARCHAR(30);

-- 修改 category 默认值
ALTER TABLE templates ALTER COLUMN category SET DEFAULT 'knowledge';

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_templates_template_type ON templates(template_type);

-- 更新列注释
COMMENT ON COLUMN templates.category IS '模板分类：knowledge(知识), project(项目), analysis(分析), architecture(架构)';
COMMENT ON COLUMN templates.template_type IS '模板类型标识：knowledge_tree, skill_map, project_lifecycle, root_cause, tech_ecosystem 等';

-- =====================================================
-- 2. TEMPLATES 数据更新
-- =====================================================

-- 更新现有模板的 category（旧值 → 新值）
UPDATE templates SET category = 'knowledge' WHERE category = 'learning';
UPDATE templates SET category = 'knowledge' WHERE category = 'story';
UPDATE templates SET category = 'knowledge' WHERE category = 'custom';

-- 为现有模板设置 template_type
UPDATE templates SET template_type = 'knowledge_tree' WHERE name = '知识树模板' AND template_type IS NULL;
UPDATE templates SET template_type = 'skill_map' WHERE name = '技能图谱模板' AND template_type IS NULL;
UPDATE templates SET template_type = 'project_lifecycle' WHERE name = '项目生命周期模板' AND template_type IS NULL;
UPDATE templates SET template_type = 'root_cause' WHERE name = '根因分析模板' AND template_type IS NULL;
UPDATE templates SET template_type = 'tech_ecosystem' WHERE name = '技术生态模板' AND template_type IS NULL;

-- 插入新的系统模板（如果不存在）
INSERT INTO templates (user_id, name, description, category, template_type, is_system, nodes, edges, tags, difficulty, estimated_nodes) VALUES
  (NULL, '知识树模板', '适用于构建知识体系，从基础到进阶的层级学习', 'knowledge', 'knowledge_tree', true, 
   '[{"id":"node-1","title":"知识领域","level":"root","description":"核心主题"},{"id":"node-2","title":"基础知识","level":"core","description":"基础概念和定义"},{"id":"node-3","title":"核心概念","level":"core","description":"核心理论和方法"},{"id":"node-4","title":"进阶内容","level":"sub","description":"深入理解和应用"},{"id":"node-5","title":"实践案例","level":"leaf","description":"实际应用案例"}]'::jsonb,
   '[{"source":"node-1","target":"node-2"},{"source":"node-1","target":"node-3"},{"source":"node-2","target":"node-4"},{"source":"node-3","target":"node-4"},{"source":"node-4","target":"node-5"}]'::jsonb,
   ARRAY['系统学习', '循序渐进'],
   'medium',
   20
  ),
  (NULL, '技能图谱模板', '适用于梳理技能前置关系，规划学习路径', 'knowledge', 'skill_map', true,
   '[{"id":"node-1","title":"目标技能","level":"root","description":"要掌握的技能"},{"id":"node-2","title":"前置技能A","level":"core","description":"必须先掌握的基础技能"},{"id":"node-3","title":"前置技能B","level":"core","description":"另一项前置技能"},{"id":"node-4","title":"基础技能A1","level":"sub","description":"前置技能A的基础"},{"id":"node-5","title":"基础技能B1","level":"sub","description":"前置技能B的基础"}]'::jsonb,
   '[{"source":"node-2","target":"node-1","relationship_type":"prerequisite"},{"source":"node-3","target":"node-1","relationship_type":"prerequisite"},{"source":"node-4","target":"node-2","relationship_type":"prerequisite"},{"source":"node-5","target":"node-3","relationship_type":"prerequisite"}]'::jsonb,
   ARRAY['技能学习', '路径规划'],
   'medium',
   15
  ),
  (NULL, '项目生命周期模板', '适用于项目管理，从规划到交付的全流程', 'project', 'project_lifecycle', true,
   '[{"id":"node-1","title":"项目目标","level":"root","description":"项目总体目标"},{"id":"node-2","title":"规划阶段","level":"core","description":"需求分析和规划"},{"id":"node-3","title":"执行阶段","level":"core","description":"开发与实施"},{"id":"node-4","title":"交付阶段","level":"core","description":"测试与交付"},{"id":"node-5","title":"复盘总结","level":"sub","description":"项目复盘和经验总结"}]'::jsonb,
   '[{"source":"node-1","target":"node-2"},{"source":"node-2","target":"node-3"},{"source":"node-3","target":"node-4"},{"source":"node-4","target":"node-5"}]'::jsonb,
   ARRAY['项目管理', '生命周期'],
   'medium',
   15
  ),
  (NULL, '根因分析模板', '适用于问题分析，5Why/鱼骨图式深入分析', 'analysis', 'root_cause', true,
   '[{"id":"node-1","title":"问题现象","level":"root","description":"观察到的核心问题"},{"id":"node-2","title":"人因","level":"core","description":"人员相关原因"},{"id":"node-3","title":"流程因","level":"core","description":"流程相关原因"},{"id":"node-4","title":"技术因","level":"core","description":"技术相关原因"},{"id":"node-5","title":"环境因","level":"core","description":"环境相关原因"}]'::jsonb,
   '[{"source":"node-2","target":"node-1"},{"source":"node-3","target":"node-1"},{"source":"node-4","target":"node-1"},{"source":"node-5","target":"node-1"}]'::jsonb,
   ARRAY['问题分析', '根因分析'],
   'hard',
   12
  ),
  (NULL, '技术生态模板', '适用于梳理技术栈关系和依赖', 'architecture', 'tech_ecosystem', true,
   '[{"id":"node-1","title":"技术生态","level":"root","description":"核心技术栈概览"},{"id":"node-2","title":"前端技术","level":"core","description":"前端框架和工具"},{"id":"node-3","title":"后端技术","level":"core","description":"后端框架和服务"},{"id":"node-4","title":"基础设施","level":"core","description":"部署和运维技术"},{"id":"node-5","title":"数据技术","level":"sub","description":"数据库和数据处理"}]'::jsonb,
   '[{"source":"node-1","target":"node-2"},{"source":"node-1","target":"node-3"},{"source":"node-1","target":"node-4"},{"source":"node-2","target":"node-3","relationship_type":"related"},{"source":"node-3","target":"node-5","relationship_type":"related"}]'::jsonb,
   ARRAY['技术栈', '生态图'],
   'hard',
   18
  )
ON CONFLICT DO NOTHING;

-- =====================================================
-- 3. PROMPT_TEMPLATES 数据更新
-- =====================================================

-- 更新 template_generation 提示词，添加 templateType 条件块
UPDATE prompt_templates SET 
  template_content = 'You are an expert knowledge graph template designer. Your task is to generate 3 different template schemes for the given topic.

## Requirements

For each template scheme, provide:
1. **Unique Structure**: Each template should have a different organizational approach
2. **Node Hierarchy**: Clear parent-child relationships with appropriate levels (root, core, sub, normal, leaf)
3. **Edge Relationships**: Meaningful connections between nodes
4. **Content Suggestions**: Brief description of what each node should contain
5. **Layout Recommendation**: Suggest the best layout type (radial, tree, network, hierarchical)
6. **Difficulty Assessment**: Rate the complexity (easy, medium, hard)
7. **Tags**: Auto-generate relevant tags for categorization

## Template Types to Consider

1. **Hierarchical/Tree Structure**: Top-down organization with clear levels
2. **Network/Mesh Structure**: Interconnected concepts with multiple relationships
3. **Process/Flow Structure**: Sequential or cyclical knowledge flow
4. **Quadrant/Matrix Structure**: Organized by two dimensions
5. **Timeline Structure**: Chronological or evolutionary progression

## Guidelines

1. Generate exactly 3 different template schemes
2. Each template should have 5-15 nodes as examples
3. Use meaningful node titles (not generic like "Node 1")
4. Ensure all edge references point to valid node IDs
5. Consider the topic''s nature when choosing structures
6. Provide clear reasoning for each template choice
7. Respond in Chinese for all descriptions and content

{{#if category}}
## Category Guidance
{{categoryGuidance}}
{{/if}}

{{#if templateType}}
## Template Type Guidance
You are creating a "{{templateType}}" type graph. Follow this specific guidance:
{{templateTypeGuidance}}
{{/if}}

{{#if preferredLayout}}
## Preferred Layout
{{layoutGuidance}}
{{/if}}',
  updated_at = NOW()
WHERE code = 'template_generation' AND scope = 'system';

INSERT INTO prompt_templates (code, scope, user_id, graph_id, template_content, created_at, updated_at) VALUES
  ('template_type_knowledge_tree', 'system', null, null, 'Create a hierarchical knowledge tree structure. Organize from root concept to core topics to sub-topics to leaf details. Use tree-like parent-child relationships. Each level should progressively detail the topic. The root node represents the main domain, core nodes are major topic areas, sub-nodes are specific concepts, and leaf nodes are detailed facts or examples. Ensure clear hierarchical progression from general to specific.', NOW(), NOW()),
  ('template_type_skill_map', 'system', null, null, 'Create a skill map showing prerequisite relationships between skills. Focus on which skills must be learned before others. Use prerequisite relationships as the primary edge type. Show learning paths through connected skills. Each skill node should clearly state what it enables and what it requires. Organize skills from foundational to advanced, making the learning progression obvious.', NOW(), NOW()),
  ('template_type_concept_network', 'system', null, null, 'Create an interconnected concept network. Focus on how concepts relate to each other, including cross-connections between different areas. Use related relationships primarily. Show the web of connections between ideas. Concepts should be linked based on similarity, causation, or dependency. Highlight hub concepts that connect multiple areas. Allow for non-hierarchical connections that show the richness of the topic.', NOW(), NOW()),
  ('template_type_learning_path', 'system', null, null, 'Create a sequential learning path. Organize as a step-by-step progression from beginner to advanced. Use chain-like prerequisite relationships. Each step should build on the previous one. Include milestones and checkpoints. Make the progression logical and achievable, with clear prerequisites at each stage. Suggest estimated time or effort for each step if appropriate.', NOW(), NOW()),
  ('template_type_topic_research', 'system', null, null, 'Create a deep research structure for a specific topic. Explore multiple angles and perspectives. Use radial structure from the central topic. Include cross-connections between different research aspects. Cover historical context, current state, key debates, and future directions. Ensure comprehensive coverage of the topic from academic, practical, and critical perspectives.', NOW(), NOW()),
  ('template_type_project_lifecycle', 'system', null, null, 'Create a project lifecycle structure showing phases from planning to execution to delivery. Use timeline/sequential organization. Include milestones and deliverables at each phase. Each phase should have clear objectives, key activities, and expected outcomes. Show dependencies between phases and critical path items. Include risk considerations at each stage.', NOW(), NOW()),
  ('template_type_dev_workflow', 'system', null, null, 'Create a software development workflow. Show the flow from requirements through design, development, testing, to deployment. Use prerequisite chain relationships. Include quality gates between phases. Each phase should define inputs, activities, outputs, and validation criteria. Consider both waterfall and iterative approaches. Include feedback loops where appropriate.', NOW(), NOW()),
  ('template_type_task_breakdown', 'system', null, null, 'Create a Work Breakdown Structure (WBS). Decompose the project into hierarchical tasks and subtasks. Use containment/parent-child relationships. Each task should be clearly scoped and assignable. Ensure tasks are MECE (Mutually Exclusive, Collectively Exhaustive). Include effort estimates and dependencies. Organize by deliverable or phase as appropriate.', NOW(), NOW()),
  ('template_type_sprint_planning', 'system', null, null, 'Create a sprint planning structure. Organize work into iterations/sprints with goals and tasks. Use timeline + hierarchical structure. Include sprint goals, user stories, and tasks. Each sprint should have a clear theme and deliverable. Show capacity allocation and priority ordering. Include definition of done criteria for each sprint.', NOW(), NOW()),
  ('template_type_root_cause', 'system', null, null, 'Create a root cause analysis structure using 5Why or Fishbone diagram approach. Start from the problem and branch into possible causes. Use radial structure from the central problem. Dig deeper into each cause branch with successive why questions. Categorize causes by type (people, process, technology, environment). Identify the most likely root causes and suggest corrective actions.', NOW(), NOW()),
  ('template_type_swot', 'system', null, null, 'Create a SWOT analysis structure. Organize into four quadrants: Strengths (internal positive factors), Weaknesses (internal negative factors), Opportunities (external positive factors), Threats (external negative factors). Use quadrant-based layout. Include specific analysis points under each category. Show relationships between SWOT elements where they exist. Conclude with strategic recommendations based on the analysis.', NOW(), NOW()),
  ('template_type_comparison', 'system', null, null, 'Create a comparative analysis structure. Organize items being compared with their attributes and differences. Use grouped structure with comparison relationships. Highlight key differences and similarities. Include evaluation criteria and scoring where appropriate. Provide a clear conclusion or recommendation based on the comparison. Consider multiple dimensions of comparison.', NOW(), NOW()),
  ('template_type_decision_tree', 'system', null, null, 'Create a decision tree structure. Show conditional branches and decision points. Use tree structure with condition relationships. Each branch should represent a choice or outcome. Include probabilities or criteria at each decision point. Show consequences of each decision path. Conclude with recommended decisions based on the analysis.', NOW(), NOW()),
  ('template_type_tech_ecosystem', 'system', null, null, 'Create a technology ecosystem map. Show how technologies relate, depend on, and complement each other. Use network structure with dependency relationships. Include version information and compatibility notes where relevant. Group technologies by layer or function (frontend, backend, infrastructure, data). Show alternative technologies and trade-offs. Highlight the core technologies and their role in the ecosystem.', NOW(), NOW()),
  ('template_type_org_structure', 'system', null, null, 'Create an organizational structure. Show reporting lines and functional relationships. Use hierarchical tree structure. Include roles, departments, and their relationships. Show both formal reporting lines and cross-functional collaborations. Include key responsibilities for each unit. Consider the organizational culture and communication patterns.', NOW(), NOW()),
  ('template_type_system_architecture', 'system', null, null, 'Create a system architecture diagram. Show modules, components, and their dependencies. Use layered network structure. Include interfaces and data flow between components. Show both logical and physical architecture where relevant. Include technology choices and their rationale. Consider scalability, reliability, and security aspects in the architecture.', NOW(), NOW()),
  ('template_type_knowledge_system', 'system', null, null, 'Create a cross-domain knowledge system. Show how knowledge areas connect across different domains. Use network structure with cross-domain relationships. Highlight interdisciplinary connections and shared concepts. Include both domain-specific and universal knowledge elements. Show how insights from one domain can apply to another. Consider the evolution and convergence of knowledge areas.', NOW(), NOW()),
  ('template_type_blank', 'system', null, null, 'Create a knowledge graph freely based on the topic. No specific structural constraints. Use whatever structure best represents the topic. Follow the natural organization of the subject matter. Be creative and adaptive in your approach.', NOW(), NOW())
ON CONFLICT (code, scope, user_id, graph_id) DO NOTHING;

-- =====================================================
-- 完成
-- =====================================================
