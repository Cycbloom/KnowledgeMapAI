-- =====================================================
-- Knowledge Map - Prompt Metadata Seed
-- =====================================================
-- 为 prompt_templates 补充用途描述（description JSONB {zh,en}）元数据，
-- 供设置面板「AI 提示词管理」展示。
--
-- 维护约定：新增 prompt code 时，需在此文件同步补充元数据。
-- 元数据为只读展示信息。

-- 图谱构建
UPDATE prompt_templates SET description = '{"zh":"把一段文本提炼为知识树结构并生成图谱","en":"Extract concepts from text into a structured knowledge tree"}' WHERE code = 'text_to_graph' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"从非结构化文档重建知识大纲与逻辑层级","en":"Rebuild knowledge outlines and hierarchies from unstructured documents"}' WHERE code = 'document_to_graph' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"解析图片内容并抽取为知识图谱节点","en":"Analyze visual content and extract it into graph nodes"}' WHERE code = 'image_to_graph' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"根据主题初始化一张新知识图谱","en":"Initialize a new knowledge graph from a given topic"}' WHERE code = 'auto_graph_init' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"展开节点并生成其子节点","en":"Expand a node by generating its child nodes"}' WHERE code = 'auto_graph_expand' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"按知识领域分析并生成其他独立领域","en":"Generate additional independent knowledge domains"}' WHERE code = 'infinite_graph_expansion' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"为当前节点生成交互式探索分支建议","en":"Suggest interactive exploration branches for a node"}' WHERE code = 'branch_suggestions' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"为新节点推荐 1-3 个最相关的既有节点连线","en":"Recommend the most relevant existing nodes to connect to"}' WHERE code = 'recommend_connections' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"分析图谱内部节点间值得建立的非层级连线","en":"Discover potential non-hierarchical relations inside a graph"}' WHERE code = 'node_relation_discovery' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"分析不同知识领域之间的关联","en":"Analyze connections across knowledge domains"}' WHERE code = 'discover_graph_relations' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"分析两个知识图谱之间的节点连接","en":"Find potential connections between two knowledge graphs"}' WHERE code = 'cross_graph_connection_analysis' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"按主题学科相关性为知识图谱聚类合成领域","en":"Cluster knowledge graphs into synthesized domains by topic"}' WHERE code = 'auto_domain_classify' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"识别概念间的 is-a 层次关系","en":"Recognize is-a hierarchical relations between concepts"}' WHERE code = 'concept_hierarchy' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"分析节点列表找出缺失的知识领域或概念","en":"Identify missing knowledge areas or concepts from a node list"}' WHERE code = 'knowledge_gap_analysis' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"对给定概念进行深度分析与展开","en":"Provide a deep analysis of a given concept"}' WHERE code = 'deep_analysis' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"为学术研究构建骨干网络结构","en":"Build a backbone network structure for academic research"}' WHERE code = 'backbone_generation' AND scope = 'system';

-- 卡片生成
UPDATE prompt_templates SET description = '{"zh":"根据主题与上下文批量生成学习卡片","en":"Generate study flashcards from a topic and context"}' WHERE code = 'generate_cards' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"生成开放式问答（qa）类型卡片","en":"Generate open-ended qa flashcard items"}' WHERE code = 'generate_cards_qa' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"生成单选题（choice）类型卡片","en":"Generate multiple-choice flashcard items"}' WHERE code = 'generate_cards_choice' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"生成判断题（true_false）类型卡片","en":"Generate true/false flashcard items"}' WHERE code = 'generate_cards_true_false' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"生成多选题（multi_choice）类型卡片","en":"Generate multi-select flashcard items"}' WHERE code = 'generate_cards_multi_choice' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"生成填空题（fill_blank）类型卡片","en":"Generate fill-in-the-blank flashcard items"}' WHERE code = 'generate_cards_fill_blank' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"生成论述题（essay）类型卡片","en":"Generate long-form essay flashcard items"}' WHERE code = 'generate_cards_essay' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"生成完形填空（cloze）类型卡片","en":"Generate cloze flashcard items"}' WHERE code = 'generate_cards_cloze' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"生成选项选择（select_from_options）类型卡片","en":"Generate select-from-options flashcard items"}' WHERE code = 'generate_cards_select_from_options' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"生成双列配对（matching）类型卡片","en":"Generate two-column matching flashcard items"}' WHERE code = 'generate_cards_matching' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"生成排序（ordering）类型卡片","en":"Generate sequence ordering flashcard items"}' WHERE code = 'generate_cards_ordering' AND scope = 'system';

-- AI 对话
UPDATE prompt_templates SET description = '{"zh":"知识图谱应用中的通用 AI 对话助手","en":"General AI assistant for the knowledge graph app"}' WHERE code = 'chat' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"引导式学习助教，结合图谱节点答疑","en":"Guided learning tutor that explains graph nodes"}' WHERE code = 'tutor_chat' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"基于知识图谱内容的智能问答助手","en":"Knowledge-graph-aware RAG question answering assistant"}' WHERE code = 'rag_chat' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"基于原始问答生成 2-3 个后续问题","en":"Generate 2-3 follow-up questions from a Q&A"}' WHERE code = 'suggest_questions' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"根据当前节点与进度推荐下一个学习主题","en":"Suggest next topics based on current node and progress"}' WHERE code = 'suggest_next_topic' AND scope = 'system';

-- 学习路径
UPDATE prompt_templates SET description = '{"zh":"基于知识图谱与目标规划最佳学习路径","en":"Plan an optimal learning path from a graph and goals"}' WHERE code = 'learning_path_generate' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"生成引导性问题帮助用户规划学习旅程","en":"Design guided questions to help plan a learning journey"}' WHERE code = 'learning_path_questions' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"跨图谱场景下澄清用户学习目标的对话引导","en":"Coach users to clarify cross-graph learning goals"}' WHERE code = 'cross_graph_goal_dialog' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"生成 5-6 条跨图谱、跨领域的学习目标建议","en":"Suggest distinct cross-graph learning goal ideas"}' WHERE code = 'cross_graph_goal_suggest' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"根据澄清后的目标生成多条候选跨图谱学习路径","en":"Generate candidate cross-graph learning path variants"}' WHERE code = 'cross_graph_path_variants' AND scope = 'system';

-- 内容生成
UPDATE prompt_templates SET description = '{"zh":"按章节结构生成结构化学习材料","en":"Write a comprehensive structured learning module"}' WHERE code = 'learning_material' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"辅助创建学习材料的章节结构 schema","en":"Assist building a chapter-structure schema for materials"}' WHERE code = 'learning_schema_assist' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"生成播客主持人口播脚本","en":"Write a podcast host spoken script"}' WHERE code = 'podcast_script' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"播客脚本撰写的系统级约束与格式","en":"System-level constraints for podcast script writing"}' WHERE code = 'podcast_system' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"针对主题生成结构化教育内容","en":"Generate detailed structured educational content"}' WHERE code = 'generate_content' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"根据任务标题生成详细任务描述与建议","en":"Generate detailed task description from a title"}' WHERE code = 'generate_task_details' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"按模板结构为知识图谱生成详细内容","en":"Generate graph content following a template structure"}' WHERE code = 'template_application' AND scope = 'system';

-- 模板生成
UPDATE prompt_templates SET description = '{"zh":"为给定主题生成 3 套不同的图谱模板方案","en":"Generate 3 template schemes for a given topic"}' WHERE code = 'template_generation' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"模板：层级知识树结构","en":"Template: hierarchical knowledge tree"}' WHERE code = 'template_type_knowledge_tree' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"模板：技能依赖图谱","en":"Template: skill prerequisite map"}' WHERE code = 'template_type_skill_map' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"模板：互连概念网络","en":"Template: interconnected concept network"}' WHERE code = 'template_type_concept_network' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"模板：由浅入深的学习路径","en":"Template: sequential learning path"}' WHERE code = 'template_type_learning_path' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"模板：专题深度研究（骨干网络）","en":"Template: topic deep research backbone"}' WHERE code = 'template_type_topic_research' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"模板：项目生命周期","en":"Template: project lifecycle"}' WHERE code = 'template_type_project_lifecycle' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"模板：软件开发流程","en":"Template: software development workflow"}' WHERE code = 'template_type_dev_workflow' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"模板：工作分解结构 WBS","en":"Template: work breakdown structure"}' WHERE code = 'template_type_task_breakdown' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"模板：迭代规划","en":"Template: sprint planning"}' WHERE code = 'template_type_sprint_planning' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"模板：根因分析（5Why/鱼骨图）","en":"Template: root cause analysis"}' WHERE code = 'template_type_root_cause' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"模板：SWOT 分析","en":"Template: SWOT analysis"}' WHERE code = 'template_type_swot' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"模板：对比分析","en":"Template: comparative analysis"}' WHERE code = 'template_type_comparison' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"模板：决策树","en":"Template: decision tree"}' WHERE code = 'template_type_decision_tree' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"模板：技术生态地图","en":"Template: technology ecosystem"}' WHERE code = 'template_type_tech_ecosystem' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"模板：组织架构","en":"Template: organizational structure"}' WHERE code = 'template_type_org_structure' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"模板：系统架构","en":"Template: system architecture"}' WHERE code = 'template_type_system_architecture' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"模板：跨领域知识体系","en":"Template: cross-domain knowledge system"}' WHERE code = 'template_type_knowledge_system' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"模板：空白自由结构","en":"Template: blank free-form structure"}' WHERE code = 'template_type_blank' AND scope = 'system';

-- 文献分析
UPDATE prompt_templates SET description = '{"zh":"从文献内容提取关键概念与知识点","en":"Extract key concepts and knowledge points from literature"}' WHERE code = 'literature_concept_extraction' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"从文献引用信息提取结构化元数据","en":"Extract structured metadata from citation info"}' WHERE code = 'literature_metadata_extraction' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"推断文献概念之间的语义关系","en":"Infer semantic relations between extracted concepts"}' WHERE code = 'literature_relation_inference' AND scope = 'system';

-- 笔记与写作
UPDATE prompt_templates SET description = '{"zh":"基于当日学习数据生成反思总结","en":"Write a daily reflection summary from study data"}' WHERE code = 'notes_daily_summary' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"从笔记正文提取可作为图谱节点的知识点","en":"Extract concept candidates from note content"}' WHERE code = 'notes_extract_concepts' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"续写笔记内容","en":"Continue writing note content"}' WHERE code = 'notes_writing_continue' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"改写笔记内容","en":"Rewrite note content"}' WHERE code = 'notes_writing_rewrite' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"扩写笔记内容","en":"Expand note content"}' WHERE code = 'notes_writing_expand' AND scope = 'system';

-- 检索与 RAG
UPDATE prompt_templates SET description = '{"zh":"改写检索查询文本，提升向量/关键词召回","en":"Rewrite queries for better retrieval recall"}' WHERE code = 'query_rewrite' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"为文档分块生成上下文定位说明","en":"Generate contextual descriptions for document chunks"}' WHERE code = 'chunk_contextualize' AND scope = 'system';

-- 系统工具
UPDATE prompt_templates SET description = '{"zh":"优化给定的 LLM 提示词模板","en":"Optimize an LLM prompt template"}' WHERE code = 'optimize_prompt' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"严格对照参考答案为作答打分","en":"Grade an answer against the reference answer"}' WHERE code = 'grade_answer' AND scope = 'system';
UPDATE prompt_templates SET description = '{"zh":"从文本中提取专业术语并给出简短解释","en":"Extract key terms and brief explanations from text"}' WHERE code = 'term_annotation' AND scope = 'system';

-- 变量注册表（variables）：供编辑面板变量栏使用；由模板自动提取生成，新增 code 需同步
UPDATE prompt_templates SET variables = ARRAY['graphList', 'maxDomains'] WHERE code = 'auto_domain_classify' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['customPrompt', 'existingChildren', 'existingNodesInGraph', 'hasExistingChildren', 'isAcademic', 'isCustom', 'isLeaf', 'isPractical', 'isRootOrCore', 'maxCount', 'minCount', 'nodeContent', 'nodeLevel', 'nodeTitle', 'useLevelStrategy'] WHERE code = 'auto_graph_expand' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['customPrompt', 'existingNodesInGraph', 'hasExistingNodes', 'hasSources', 'isAcademic', 'isCustom', 'isPractical', 'outputLanguage', 'sources', 'topic'] WHERE code = 'auto_graph_init' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'backbone_generation' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['isLeaf', 'isRootOrCore'] WHERE code = 'branch_suggestions' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['contextText'] WHERE code = 'chat' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['chunksJson', 'documentContent', 'documentTitle'] WHERE code = 'chunk_contextualize' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'concept_hierarchy' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['graph1Description', 'graph1Nodes', 'graph1Title', 'graph2Description', 'graph2Nodes', 'graph2Title'] WHERE code = 'cross_graph_connection_analysis' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['graphContextSummary', 'outputLanguage', 'selectionContext'] WHERE code = 'cross_graph_goal_dialog' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['domainSummary', 'graphContextSummary', 'outputLanguage', 'selectionContext'] WHERE code = 'cross_graph_goal_suggest' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['conversationTranscript', 'dailyTimeMinutes', 'graphContextSummary', 'outputLanguage', 'selectionContext', 'targetGoal', 'variantCount'] WHERE code = 'cross_graph_path_variants' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['node_content', 'node_title'] WHERE code = 'deep_analysis' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['core_concepts', 'description', 'domain', 'existing_relations', 'from_title', 'graphs', 'include_cross_domain', 'max_suggestions', 'node_count', 'title', 'to_title', 'type'] WHERE code = 'discover_graph_relations' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'document_to_graph' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['allowedTypes', 'context', 'count', 'difficulty', 'includesChoice', 'includesCloze', 'includesEssay', 'includesFillBlank', 'includesMatching', 'includesMultiChoice', 'includesOrdering', 'includesQA', 'includesSelectFromOptions', 'includesTrueFalse'] WHERE code = 'generate_cards' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'generate_cards_choice' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'generate_cards_cloze' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'generate_cards_essay' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'generate_cards_fill_blank' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'generate_cards_matching' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'generate_cards_multi_choice' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'generate_cards_ordering' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'generate_cards_qa' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'generate_cards_select_from_options' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'generate_cards_true_false' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['context', 'isLeaf', 'isRoot', 'topic'] WHERE code = 'generate_content' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['context'] WHERE code = 'generate_task_details' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'image_to_graph' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['domainContext', 'domainDescription', 'domainTitle', 'maxGraphsPerLevel', 'parentDomainName'] WHERE code = 'infinite_graph_expansion' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'knowledge_gap_analysis' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['categoryOptions', 'context', 'level', 'outputLanguage', 'topic'] WHERE code = 'learning_material' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['currentKnowledge', 'dailyTimeMinutes', 'graphTitle', 'isExploratory', 'isFocused', 'isSequential', 'nodesCount', 'targetGoal'] WHERE code = 'learning_path_generate' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['graphDescription', 'graphTitle', 'nodesCount', 'nodesPreview'] WHERE code = 'learning_path_questions' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['existingSections', 'goal', 'isOptimize', 'modeLabel', 'outputLanguage', 'topic'] WHERE code = 'learning_schema_assist' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['abstract', 'authors', 'content', 'maxConcepts', 'preferredCount', 'title'] WHERE code = 'literature_concept_extraction' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'literature_metadata_extraction' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['concepts', 'existingNodes', 'title'] WHERE code = 'literature_relation_inference' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['allowedTypes', 'graphDescription', 'graphTitle', 'maxSuggestions', 'nodes'] WHERE code = 'node_relation_discovery' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['date', 'today_completed_tasks', 'today_completed_tasks_list', 'today_focus_time', 'today_reviewed_card_contents', 'today_reviewed_cards'] WHERE code = 'notes_daily_summary' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['content'] WHERE code = 'notes_extract_concepts' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['contextAfter', 'contextBefore', 'selectedText'] WHERE code = 'notes_writing_continue' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['contextAfter', 'contextBefore', 'selectedText'] WHERE code = 'notes_writing_expand' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['contextAfter', 'contextBefore', 'selectedText'] WHERE code = 'notes_writing_rewrite' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['variable'] WHERE code = 'optimize_prompt' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['context', 'outputLanguage'] WHERE code = 'podcast_script' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'podcast_system' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['query'] WHERE code = 'query_rewrite' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['context', 'graphContextHint'] WHERE code = 'rag_chat' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['existing_nodes_json', 'node_content', 'node_title'] WHERE code = 'recommend_connections' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'suggest_next_topic' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'suggest_questions' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'template_application' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['category', 'categoryGuidance', 'layoutGuidance', 'preferredLayout', 'templateType', 'templateTypeGuidance'] WHERE code = 'template_generation' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'template_type_blank' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'template_type_comparison' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'template_type_concept_network' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'template_type_decision_tree' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'template_type_dev_workflow' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'template_type_knowledge_system' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'template_type_knowledge_tree' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'template_type_learning_path' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'template_type_org_structure' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'template_type_project_lifecycle' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'template_type_root_cause' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'template_type_skill_map' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'template_type_sprint_planning' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'template_type_swot' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'template_type_system_architecture' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'template_type_task_breakdown' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'template_type_tech_ecosystem' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'template_type_topic_research' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['nodeContent'] WHERE code = 'term_annotation' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY[]::text[] WHERE code = 'text_to_graph' AND scope = 'system';
UPDATE prompt_templates SET variables = ARRAY['currentNodeContent', 'currentNodeId', 'currentNodeTitle', 'existingNodes', 'isGuided'] WHERE code = 'tutor_chat' AND scope = 'system';
