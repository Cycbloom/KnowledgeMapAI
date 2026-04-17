-- =====================================================
-- Knowledge Map - [Seed: Templates]
-- =====================================================

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
