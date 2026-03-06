-- =====================================================
-- Knowledge Map - Initial Seed Data
-- Generated: 2026-02-26 (Consolidated Migration)
-- =====================================================

-- =====================================================
-- DEFAULT QUEUES FOR NEW USERS
-- =====================================================

-- Function to create default queues for new users
CREATE OR REPLACE FUNCTION create_default_queues_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO queues (user_id, name, color, time_slice, priority) VALUES
    (NEW.id, '紧急队列', 'cyan', 25, 0),
    (NEW.id, '重要队列', 'emerald', 45, 1),
    (NEW.id, '待办队列', 'amber', 90, 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-create default queues when a new user is created
DROP TRIGGER IF EXISTS on_user_created_queues ON users;
CREATE TRIGGER on_user_created_queues
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION create_default_queues_for_user();

-- =====================================================
-- APP SETTINGS
-- =====================================================

INSERT INTO app_settings (key, value, description) VALUES 
    ('ai_provider_config', '{
        "deepseek": { "enabled": true, "apiKey": "", "baseURL": "https://api.deepseek.com", "model": "deepseek-chat" },
        "volcengine": { "enabled": true, "apiKey": "", "baseURL": "https://ark.cn-beijing.volces.com/api/v3", "model": "doubao-seed-1-8-251228", "embeddingModel": "doubao-embedding-vision-251215" },
        "aliyun": { "enabled": true, "apiKey": "", "baseURL": "https://dashscope.aliyuncs.com/compatible-mode/v1", "model": "qwen-long-latest" }
    }'::jsonb, 'Configuration for AI Providers'),
    ('system_config', '{
        "default_provider": "deepseek",
        "task_mapping": { "text": "deepseek", "embedding": "volcengine", "reasoning": "aliyun" }
    }'::jsonb, 'Global system settings and defaults')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- ACHIEVEMENTS
-- =====================================================

INSERT INTO achievements (code, name, description, category, icon, color, xp_reward, condition_type, condition_value, is_hidden) VALUES
-- Study streak achievements
  ('streak_3', '初出茅庐', '保持3天连续学习', 'study', 'Flame', '#F97316', 100, 'streak_days', 3, FALSE),
  ('streak_7', '坚持不懈', '保持7天连续学习', 'study', 'Zap', '#3B82F6', 300, 'streak_days', 7, FALSE),
  ('streak_14', '持之以恒', '保持14天连续学习', 'study', 'Zap', '#8B5CF6', 500, 'streak_days', 14, FALSE),
  ('streak_30', '月度大师', '保持30天连续学习', 'study', 'Crown', '#A855F7', 1000, 'streak_days', 30, FALSE),
  ('streak_100', '百日筑基', '保持100天连续学习', 'study', 'Crown', '#FCD34D', 5000, 'streak_days', 100, FALSE),
-- Focus time achievements
  ('focus_10', '专注时刻', '完成10分钟专注时间', 'focus', 'Timer', '#10B981', 50, 'focus_minutes', 10, FALSE),
  ('focus_60', '深度潜入', '完成60分钟专注时间', 'focus', 'Timer', '#3B82F6', 150, 'focus_minutes', 60, FALSE),
  ('focus_300', '专注大师', '完成300分钟(5小时)专注时间', 'focus', 'Brain', '#8B5CF6', 500, 'focus_minutes', 300, FALSE),
  ('focus_1000', '心流境界', '完成1000分钟专注时间', 'focus', 'Brain', '#EC4899', 1500, 'focus_minutes', 1000, FALSE),
-- Mastery achievements
  ('mastery_1', '初试牛刀', '掌握1张知识卡片', 'study', 'GraduationCap', '#10B981', 50, 'cards_mastered', 1, FALSE),
  ('mastery_10', '跬步千里', '掌握10张知识卡片', 'study', 'GraduationCap', '#3B82F6', 100, 'cards_mastered', 10, FALSE),
  ('mastery_50', '求知若渴', '掌握50张知识卡片', 'study', 'BookOpen', '#8B5CF6', 300, 'cards_mastered', 50, FALSE),
  ('mastery_100', '领域专家', '掌握100张知识卡片', 'study', 'Trophy', '#F59E0B', 600, 'cards_mastered', 100, FALSE),
  ('mastery_500', '博闻强识', '掌握500张知识卡片', 'study', 'Trophy', '#FCD34D', 2500, 'cards_mastered', 500, FALSE),
-- Creation achievements
  ('creation_graph_1', '创世之初', '创建第1个知识图谱', 'creation', 'BookOpen', '#10B981', 200, 'graphs_created', 1, FALSE),
  ('creation_graph_5', '知识架构师', '创建5个知识图谱', 'creation', 'BookOpen', '#3B82F6', 800, 'graphs_created', 5, FALSE),
  ('creation_node_10', '萌芽', '创建10个知识节点', 'creation', 'Target', '#F59E0B', 100, 'nodes_created', 10, FALSE),
  ('creation_node_100', '枝繁叶茂', '创建100个知识节点', 'creation', 'Target', '#8B5CF6', 500, 'nodes_created', 100, FALSE),
  ('creation_node_1000', '知识森林', '创建1000个知识节点', 'creation', 'Target', '#FCD34D', 2000, 'nodes_created', 1000, FALSE),
-- Focus achievements (new)
  ('first_focus', '初次专注', '完成第一次专注会话', 'focus', '🎯', '#10B981', 10, 'focus_sessions', 1, FALSE),
  ('focus_1h', '一小时达人', '累计专注时间达到1小时', 'focus', '⏱️', '#3B82F6', 20, 'total_focus_hours', 1, FALSE),
  ('focus_10h', '专注新手', '累计专注时间达到10小时', 'focus', '🔥', '#F59E0B', 50, 'total_focus_hours', 10, FALSE),
  ('focus_50h', '专注达人', '累计专注时间达到50小时', 'focus', '💪', '#8B5CF6', 100, 'total_focus_hours', 50, FALSE),
  ('focus_100h', '专注大师', '累计专注时间达到100小时', 'focus', '🏆', '#EC4899', 200, 'total_focus_hours', 100, FALSE),
  ('focus_500h', '专注传奇', '累计专注时间达到500小时', 'focus', '👑', '#FCD34D', 500, 'total_focus_hours', 500, FALSE),
  ('daily_4h', '高效一天', '单日专注时间达到4小时', 'focus', '⚡', '#06B6D4', 50, 'daily_focus_hours', 4, FALSE),
  ('daily_8h', '极限挑战', '单日专注时间达到8小时', 'focus', '🚀', '#EF4444', 100, 'daily_focus_hours', 8, FALSE),
-- Streak achievements (new)
  ('streak_3_new', '三天坚持', '连续专注3天', 'streak', '🌟', '#F97316', 30, 'consecutive_days', 3, FALSE),
  ('streak_7_new', '一周达人', '连续专注7天', 'streak', '✨', '#84CC16', 70, 'consecutive_days', 7, FALSE),
  ('streak_14_new', '两周毅力', '连续专注14天', 'streak', '💫', '#14B8A6', 140, 'consecutive_days', 14, FALSE),
  ('streak_30_new', '月度冠军', '连续专注30天', 'streak', '🏅', '#A855F7', 300, 'consecutive_days', 30, FALSE),
  ('streak_100_new', '百日传奇', '连续专注100天', 'streak', '💎', '#F43F5E', 1000, 'consecutive_days', 100, FALSE),
-- Task achievements
  ('tasks_10', '任务新手', '完成10个任务', 'tasks', '📋', '#6366F1', 30, 'tasks_completed', 10, FALSE),
  ('tasks_50', '任务达人', '完成50个任务', 'tasks', '📝', '#8B5CF6', 100, 'tasks_completed', 50, FALSE),
  ('tasks_100', '任务大师', '完成100个任务', 'tasks', '🎖️', '#EC4899', 200, 'tasks_completed', 100, FALSE),
  ('tasks_500', '任务传奇', '完成500个任务', 'tasks', '🏅', '#F59E0B', 500, 'tasks_completed', 500, FALSE),
-- Pomodoro achievements
  ('pomodoro_10', '番茄新手', '完成10个番茄钟', 'focus', '🍅', '#EF4444', 20, 'pomodoros_completed', 10, FALSE),
  ('pomodoro_50', '番茄达人', '完成50个番茄钟', 'focus', '🍅', '#F97316', 50, 'pomodoros_completed', 50, FALSE),
  ('pomodoro_100', '番茄大师', '完成100个番茄钟', 'focus', '🍅', '#DC2626', 100, 'pomodoros_completed', 100, FALSE),
-- Special achievements
  ('night_owl', '夜猫子', '在凌晨(0:00-5:00)完成专注会话', 'special', '🦉', '#6366F1', 30, 'special_condition', 1, TRUE),
  ('early_bird', '早起鸟', '在早晨(5:00-7:00)完成专注会话', 'special', '🐦', '#FBBF24', 30, 'special_condition', 1, TRUE),
  ('weekend_warrior', '周末战士', '在周末完成4小时专注', 'special', '⚔️', '#8B5CF6', 50, 'special_condition', 1, TRUE),
  ('perfectionist', '完美主义者', '一天内完成所有计划任务', 'special', '✅', '#10B981', 50, 'special_condition', 1, TRUE),
  ('multitasker', '多面手', '在一天内完成5个不同任务', 'special', '🎭', '#EC4899', 40, 'special_condition', 1, TRUE),
-- Weekly streak achievements
  ('weekly_streak_4', '四周坚持', '连续完成4周所有周任务', 'streak', '📅', '#10B981', 100, 'weekly_streak', 4, FALSE),
  ('weekly_streak_8', '两月坚持', '连续完成8周所有周任务', 'streak', '📆', '#3B82F6', 200, 'weekly_streak', 8, FALSE),
  ('weekly_streak_12', '季度坚持', '连续完成12周所有周任务', 'streak', '🗓️', '#8B5CF6', 400, 'weekly_streak', 12, FALSE),
-- Monthly streak achievements
  ('monthly_streak_3', '三月连冠', '连续完成3个月所有月任务', 'streak', '🏆', '#F59E0B', 300, 'monthly_streak', 3, FALSE),
  ('monthly_streak_6', '半年传奇', '连续完成6个月所有月任务', 'streak', '👑', '#EC4899', 600, 'monthly_streak', 6, FALSE),
  ('monthly_streak_12', '年度霸主', '连续完成12个月所有月任务', 'streak', '💎', '#FCD34D', 1500, 'monthly_streak', 12, FALSE),
-- Quarterly streak achievements
  ('quarterly_streak_2', '半年坚持', '连续完成2个季度所有任务', 'streak', '🌟', '#14B8A6', 500, 'quarterly_streak', 2, FALSE),
  ('quarterly_streak_4', '年度传奇', '连续完成4个季度所有任务', 'streak', '🏅', '#A855F7', 1000, 'quarterly_streak', 4, FALSE),
-- Daily task streak achievements
  ('daily_streak_7', '周常达人', '连续7天完成所有每日任务', 'streak', '🔥', '#F97316', 50, 'daily_task_streak', 7, FALSE),
  ('daily_streak_14', '两周毅力', '连续14天完成所有每日任务', 'streak', '💪', '#EF4444', 100, 'daily_task_streak', 14, FALSE),
  ('daily_streak_30', '月度坚持', '连续30天完成所有每日任务', 'streak', '🎯', '#DC2626', 300, 'daily_task_streak', 30, FALSE),
  ('daily_streak_60', '双月传奇', '连续60天完成所有每日任务', 'streak', '⭐', '#7C3AED', 600, 'daily_task_streak', 60, FALSE),
  ('daily_streak_100', '百日王者', '连续100天完成所有每日任务', 'streak', '👑', '#FCD34D', 1000, 'daily_task_streak', 100, FALSE)
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- TEMPLATES
-- =====================================================

INSERT INTO templates (user_id, name, description, category, is_system, nodes, edges, layout) VALUES
  (NULL, '概念学习', '适用于学习新概念，从定义到应用的完整学习路径', 'learning', true, 
   '[{"id":"node-1","title":"主题","level":"root"},{"id":"node-2","title":"定义","level":"core"},{"id":"node-3","title":"特点","level":"core"}]'::jsonb,
   '[{"source":"node-1","target":"node-2"},{"source":"node-1","target":"node-3"}]'::jsonb,
   NULL)
ON CONFLICT DO NOTHING;

-- =====================================================
-- AI ACTIONS
-- =====================================================

INSERT INTO ai_actions (name, description, icon, target_mode, scope, prompt_template) VALUES
  ('精炼内容', '将节点内容精炼为简洁的几句话', 'Minimize2', 'update_node', 'system', '请将以下内容精炼为3-5句话，保留核心观点和关键事实。直接返回精炼后的内容，不要有开场白。

内容：
{{nodeContent}}'),
  ('反向辩驳', '提出该观点的反面论证或潜在缺陷', 'MessageSquareWarning', 'show_result', 'system', '请扮演一个批判性思维者，针对以下观点提出反面论证、潜在缺陷或被忽视的视角。

观点：{{nodeTitle}}
详细内容：{{nodeContent}}')
ON CONFLICT DO NOTHING;

-- =====================================================
-- PROMPT TEMPLATES
-- =====================================================

INSERT INTO prompt_templates ("code", "scope", "user_id", "graph_id", "template_content", "created_at", "updated_at") VALUES 
('expand_knowledge', 'system', null, null, 'You are a knowledge graph expert. Suggest a comprehensive list of related sub-topics or concepts for the given node to expand the graph deeply.

Goal: Prioritize generating NEW, specific concepts to broaden the graph''s coverage.
Quantity: Generate up to 8 nodes. Focus on representativeness and hierarchy.

Linking Strategy:
{{#if isRootOrCore}}
Linking Strategy (HIERARCHICAL):
1. **NO Same-Level Links**: Do NOT link to nodes that are at the SAME level (siblings/cousins).
2. **Vertical Links OK**: You MAY link to nodes that would be considered a ''parent'' (higher level) or ''child'' (lower level) contextually.
3. **Focus**: Primary goal is to generate NEW specific child nodes for the current node.
{{else}}
{{#if isLeaf}}
Linking Strategy (NETWORK): You are expanding a leaf node. You are encouraged to link to ''Existing Nodes'' if they are highly relevant, especially other leaf nodes, to form knowledge connections.
{{else}}
Linking Strategy (HIERARCHICAL):
1. **NO Same-Level Links**: Do NOT link to nodes that are at the SAME level (siblings/cousins).
2. **Vertical Links OK**: You MAY link to nodes that would be considered a ''parent'' (higher level) or ''child'' (lower level) contextually.
3. **Focus**: Primary goal is to generate NEW specific child nodes for the current node.
{{/if}}
{{/if}}

Content Strategy:
{{#if isRootOrCore}}
Content Strategy (HIGH LEVEL): Suggest BROAD CATEGORIES or MAJOR BRANCHES. The ''content'' should be a high-level summary or definition.
{{else}}
{{#if isLeaf}}
Content Strategy (LEAF LEVEL): Suggest ATOMIC DETAILS, EXAMPLES, or ATTRIBUTES. The ''content'' should be very specific, technical, and detailed.
{{else}}
Content Strategy (MID LEVEL): Suggest SPECIFIC CONCEPTS or FUNCTIONAL COMPONENTS. The ''content'' should be descriptive and explain ''how'' or ''why''.
{{/if}}
{{/if}}

Do not suggest topics that are already listed in ''Current Direct Children''.', NOW(), NOW()),
('generate_cards', 'system', null, null, 'You are an educational expert. Generate {{count}} flashcards based on the provided topic and content.

Context: The current node is part of a larger knowledge structure.
{{#if context}}Parent/Context Info: {{context}}{{/if}}

Requirements:
1. Generate exactly {{count}} cards.
2. Allowed Types: {{allowedTypes}}.
3. Mix the types if multiple are selected.

{{#if includesQA}}
For ''qa'' type: Create thought-provoking open-ended questions that test deep understanding. Provide a detailed ''explanation'' analyzing the answer.
{{/if}}

{{#if includesChoice}}
For ''choice'' type: Create multiple-choice questions with 4 plausible options. Provide the correct answer and a detailed ''explanation'' of why it is correct and others are wrong.
{{/if}}

{{#if includesTrueFalse}}
For ''true_false'' type: Create statements focusing on common misconceptions or key details. Provide a detailed ''explanation''.
{{/if}}

{{#if includesMultiChoice}}
For ''multi_choice'' type: Create multiple-choice questions where ONE OR MORE options can be correct. Provide 4 options, the ''answer'' as a JSON array of correct strings, and a detailed ''explanation''.
{{/if}}

{{#if includesFillBlank}}
For ''fill_in_the_blank'' type: Create a sentence with one or more ''___'' (3 underscores) as blanks. The ''answer'' should be the missing text. Provide a detailed ''explanation''.
{{/if}}

{{#if includesEssay}}
For ''essay'' type: Create complex questions requiring a long-form structured answer. The ''answer'' should be a model response with key points. Provide a detailed ''explanation'' with scoring criteria.
{{/if}}', NOW(), NOW()),
('chat', 'system', null, null, 'You are an intelligent assistant for a Knowledge Graph.
Answer the user''s question based on the provided Graph Context.

Graph Context:
{{contextText}}

Instructions:
1. Use the information in the Graph Context to answer.
2. If the answer is not in the context, use your general knowledge but mention that it''s not explicitly in the graph.
3. Be concise and helpful.
4. Respond in the same language as the user''s question (default to Chinese).', NOW(), NOW()),
('text_to_graph', 'system', null, null, 'You are a knowledge graph expert. Analyze the provided text and extract key concepts to build a structured Knowledge Tree.

Requirements:
1. Identify ONE main Topic as the ''root'' node.
2. Filter out irrelevant text, noise, or meta-commentary (e.g., "exam points", "irrelevant context", "ads", "author info"). Focus ONLY on the main subject matter.
3. Organize nodes into a strict 5-level hierarchy: ''root'' -> ''core'' -> ''sub'' -> ''normal'' -> ''leaf''.
   - ''root'': The main topic (1 node).
   - ''core'': Key categories or major concepts (direct children of root).
   - ''sub'': Secondary concepts or branches (children of core).
   - ''normal'': Detailed concepts or standard nodes (children of sub).
   - ''leaf'': Specific examples, minor details, or data points (children of normal).
4. Output a TREE structure. Minimise cross-links to keep it clean. Ensure every node (except root) has a valid parent.
5. **Content Richness**: Every node must have substantial ''content'' description, not just a title.
6. IMPORTANT: All mathematical formulas in ''content'' must be wrapped in standard LaTeX delimiters. Use $...$ for inline formulas and $$...$$ for block formulas.
7. Limit the output to a maximum of 50-100 nodes. Prioritize the most important concepts to fit within this limit.', NOW(), NOW()),
('tutor_chat', 'system', null, null, 'You are an intelligent knowledge tutor for a Knowledge Graph application.

{{#if isGuided}}
Guided Mode: Follow a structured learning path. Guide the user step-by-step through the knowledge graph. Ask questions to assess understanding before moving to the next topic.
{{else}}
Free Mode: Allow open-ended discussion. Answer questions freely and explore topics based on user interest. Extract key concepts from the conversation that could be added to the knowledge graph.
{{/if}}

Current Context:
{{#if currentNodeId}}
Current Node:
- Title: {{currentNodeTitle}}
- Content: {{currentNodeContent}}
{{/if}}

{{#if existingNodes}}
Existing Nodes in Graph:
{{existingNodes}}
{{/if}}

Instructions:
1. Be conversational and engaging
2. Use markdown formatting for better readability
3. When explaining concepts, provide examples
4. In free mode, identify key concepts that could be new nodes in the knowledge graph
5. In guided mode, follow the learning path and check understanding
6. Respond in the same language as the user (default to Chinese)
7. All mathematical formulas must be wrapped in LaTeX: $inline$ or $$block$$', NOW(), NOW()),
('branch_suggestions', 'system', null, null, 'You are a knowledge graph expert specializing in creating interactive exploration paths like story branches or adventure game choices.

Goal: Generate 3-5 distinct branch suggestions for the user to explore from the current node.
Each branch should represent a different direction or perspective the user could take.

Quantity: Generate exactly 3-5 branches.

Linking Strategy:
{{#if isRootOrCore}}
Linking Strategy (HIERARCHICAL):
1. **NO Same-Level Links**: Do NOT link to nodes that are at the SAME level.
2. **Vertical Links OK**: You MAY link to parent or child nodes.
{{else}}
{{#if isLeaf}}
Linking Strategy (NETWORK): You are expanding a leaf node. Encourage linking to ''Existing Nodes'' if relevant.
{{else}}
Linking Strategy (HIERARCHICAL):
1. **NO Same-Level Links**: Do NOT link to nodes that are at the SAME level.
2. **Vertical Links OK**: You MAY link to parent or child nodes.
{{/if}}
{{/if}}

Content Strategy:
{{#if isRootOrCore}}
Content Strategy (HIGH LEVEL): Suggest BROAD CATEGORIES or MAJOR BRANCHES.
{{else}}
{{#if isLeaf}}
Content Strategy (LEAF LEVEL): Suggest ATOMIC DETAILS, EXAMPLES, or ATTRIBUTES.
{{else}}
Content Strategy (MID LEVEL): Suggest SPECIFIC CONCEPTS or FUNCTIONAL COMPONENTS.
{{/if}}
{{/if}}

Do not suggest topics that are already listed in ''Current Direct Children''.', NOW(), NOW()),
('deep_analysis', 'system', null, null, 'You are an expert professor and researcher. Your task is to provide a deep analysis of the following concept: "{{node_title}}".

Context:
{{node_content}}

Please provide a structured analysis including:
1. Historical Context & Origin
2. Core Principles & Mechanisms
3. Advanced Applications & Edge Cases
4. Cross-disciplinary Connections
5. Current Research Trends (if applicable)

Format your response in Markdown.
IMPORTANT: Directly output the analysis content. Do NOT include any conversational filler (e.g., "Okay", "Here is the analysis", "As an expert...").', NOW(), NOW()),
('document_to_graph', 'system', null, null, 'You are a top-tier knowledge architect, skilled in reconstructing original knowledge outlines and logical hierarchies from unstructured documents.

Your Task:
1. **Identify Hierarchy Cues**: Deeply analyze numbering (e.g., Chapter 1, 1.1, I, (1)), font features (ALL CAPS), and logical progression.
2. **Reconstruct Outline**: Map the document structure to the 5-level model:
   - ''root'': Document title or core subject (1 node).
   - ''core'': Level 1 headers/Chapters.
   - ''sub'': Level 2 headers/Sections.
   - ''normal'': Level 3 headers/Sub-sections or core concepts.
   - ''leaf'': Details, definitions, examples.
3. **Maintain Logic Chain**: Ensure edges accurately reflect parent-child inclusion. Every child MUST point to its direct parent ID.
4. **Clean Noise**: Ignore page numbers, headers, irrelevant symbols.

Output Requirements:
- Node titles must preserve core terminology.
- **Content Richness**: Each node MUST have substantial ''content'' (100-200 words), not just a title.
- Node count: 40-60 nodes to ensure completeness.
- All titles and descriptions in Chinese.', NOW(), NOW()),
('generate_content', 'system', null, null, 'You are an expert tutor and content creator. Generate detailed, structured educational content for the topic "{{topic}}".

Context: {{context}}

{{#if isRoot}}
Strategy (ROOT/CORE): Provide a comprehensive overview, high-level definitions, and major categories. Focus on the big picture and foundational concepts.
{{else}}
{{#if isLeaf}}
Strategy (LEAF): Provide specific details, technical specifications, examples, and deep analysis. Focus on the "how" and "why" of this specific atomic concept.
{{else}}
Strategy (NORMAL/SUB): Provide a balanced explanation covering key components, relationships, and functional descriptions. Connect the concept to its parent context.
{{/if}}
{{/if}}

Format your response in Markdown. Use headers, bullet points, and code blocks (if applicable) to make it readable.', NOW(), NOW()),
('recommend_connections', 'system', null, null, 'You are a knowledge graph expert. Given a new node (title and content) and a list of existing nodes in a graph, suggest 1-3 most relevant existing nodes to connect to.

New Node:
Title: {{node_title}}
Content: {{node_content}}

Existing Nodes:
{{existing_nodes_json}}', NOW(), NOW()),
('term_annotation', 'system', null, null, '你是一个专业的学术助手。请分析以下文本，提取其中的关键专业术语。', NOW(), NOW()),
('generate_cards_choice', 'system', null, null, 'For ''choice'' type: Create multiple-choice questions with 4 plausible options. 
Provide the correct answer and a detailed ''explanation'' of why it is correct and others are wrong.
Distractors should be common misconceptions if possible.', NOW(), NOW()),
('generate_cards_essay', 'system', null, null, 'For ''essay'' type: Create complex questions requiring a long-form structured answer. 
The ''answer'' should be a model response with key points. 
Provide a detailed ''explanation'' with scoring criteria and key concepts to cover.', NOW(), NOW()),
('generate_cards_fill_blank', 'system', null, null, 'For ''fill_in_the_blank'' type: Create a sentence with one or more ''___'' (3 underscores) as blanks. 
The ''answer'' should be the missing text. Provide a detailed ''explanation''.', NOW(), NOW()),
('generate_cards_multi_choice', 'system', null, null, 'For ''multi_choice'' type: Create multiple-choice questions where ONE OR MORE options can be correct. 
Provide 4 options, the ''answer'' as a JSON array of correct strings, and a detailed ''explanation''.', NOW(), NOW()),
('generate_cards_qa', 'system', null, null, 'For ''qa'' type: Create thought-provoking open-ended questions that test deep understanding. 
Provide a detailed ''explanation'' analyzing the answer.
Focus on explaining the "Why" and "How" rather than just "What".', NOW(), NOW()),
('generate_cards_true_false', 'system', null, null, 'For ''true_false'' type: Create statements focusing on common misconceptions or key details. 
Provide a detailed ''explanation'' clarifying the fact.', NOW(), NOW()),
('auto_graph_init', 'system', null, null, 'You are a knowledge graph expert. Initialize a new knowledge graph based on the given topic.

## Task
Generate the ROOT node and 3-5 CORE nodes for the topic. This is the FIRST step of progressive graph building.

{{#if isCustom}}
## Custom Instructions
{{customPrompt}}
{{else}}
## Style Guidelines
{{#if isAcademic}}
### Academic Style (学术风格)
- Use professional terminology and academic language
- Focus on accurate definitions and theoretical frameworks
- Include relevant theories and principles
{{else}}
{{#if isPractical}}
### Practical Style (实用风格)
- Use plain, easy-to-understand language
- Focus on practical application scenarios
- Include examples and best practices
{{else}}
### Beginner Style (入门风格)
- Use simple, easy-to-understand language
- Use analogies and real-life examples
- Each concept should have a concise explanation
{{/if}}
{{/if}}
{{/if}}

{{#if hasSources}}
## Reference Sources
Use the following sources as reference:
{{sources}}
{{/if}}

Topic: {{topic}}

Respond in Chinese.', NOW(), NOW()),
('auto_graph_expand', 'system', null, null, 'You are a knowledge graph expert. Expand a node by generating its child nodes.

## Task
Generate 3-5 child nodes for the given parent node. Each child should be a specific sub-concept or detail.

## Context
- Parent Node: {{nodeTitle}}
{{#if nodeContent}}- Parent Content: {{nodeContent}}{{/if}}
- Parent Level: {{nodeLevel}}

{{#if isCustom}}
## Custom Instructions
{{customPrompt}}
{{else}}
## Style Guidelines
{{#if isAcademic}}
### Academic Style (学术风格)
- Use professional terminology
- Focus on theoretical aspects
- Include relevant principles
{{else}}
{{#if isPractical}}
### Practical Style (实用风格)
- Use plain language
- Focus on practical applications
- Include examples
{{else}}
### Beginner Style (入门风格)
- Use simple language
- Use analogies
- Keep explanations concise
{{/if}}
{{/if}}
{{/if}}

{{#if hasExistingChildren}}
## Existing Children
The following child nodes already exist: {{existingChildren}}
Generate NEW, DIFFERENT child nodes.
{{/if}}

Respond in Chinese.', NOW(), NOW()),
('learning_path_generate', 'system', null, null, 'You are an expert learning path planner. Create an optimal learning path based on the given knowledge graph and user goals.

## Task
Analyze the knowledge graph and create a personalized learning path that helps the user achieve their learning goal efficiently.

## Context
- Graph Title: {{graphTitle}}
- Learning Goal: {{targetGoal}}
- Daily Study Time: {{dailyTimeMinutes}} minutes
- Current Knowledge: {{currentKnowledge}}
- Total Nodes: {{nodesCount}}

## Learning Style Guidelines
{{#if isSequential}}
### Sequential Learning
- Follow a strict prerequisite order
- Complete each topic before moving to the next
- Build knowledge step by step
{{else}}
{{#if isExploratory}}
### Exploratory Learning
- Allow jumping between related topics
- Encourage discovering connections
- Mix different difficulty levels
{{else}}
{{#if isFocused}}
### Focused Learning
- Prioritize core concepts directly related to the goal
- Skip peripheral topics
- Intensive practice on key areas
{{/if}}
{{/if}}
{{/if}}

## Output Requirements
1. Order nodes based on prerequisites and learning efficiency
2. Estimate time for each node (5-60 minutes)
3. Assign priority: high (must learn), medium (should learn), low (nice to have)
4. Provide a brief reason for each node''s placement
5. List prerequisite node IDs for each node

Respond in Chinese.', NOW(), NOW()),
('learning_path_questions', 'system', null, null, 'You are an expert learning path designer. Generate guided questions to help users plan their learning journey.

## Task
Based on the knowledge graph information, generate:
1. Suggested learning goals (3-4 options)
2. Prerequisite knowledge assessment questions (3-5 questions)

## Context
- Graph Title: {{graphTitle}}
{{#if graphDescription}}- Description: {{graphDescription}}{{/if}}
- Total Nodes: {{nodesCount}}
- Nodes Preview: {{nodesPreview}}

## Guidelines for Learning Goals
- Goals should be specific and achievable
- Cover different levels: basic understanding, practical application, deep mastery
- Use clear, motivating language
- Relate to real-world outcomes when possible

## Guidelines for Prerequisite Questions
- Identify knowledge that would help learn this topic
- Include both theoretical and practical knowledge
- Questions should be relevant to the graph content
- Each question should have 4 options: 不了解, 了解一点, 比较熟悉, 非常熟悉

## Output Format
Return a JSON object with:
{
  "suggestedGoals": [
    "Goal 1 description",
    "Goal 2 description",
    "Goal 3 description"
  ],
  "prerequisiteQuestions": [
    {
      "topic": "Knowledge area name",
      "description": "Brief description of what this includes",
      "options": ["不了解", "了解一点", "比较熟悉", "非常熟悉"]
    }
  ]
}

Respond in Chinese.', NOW(), NOW()),
('infinite_graph_expansion', 'system', null, null, '你是一个知识图谱专家。你的任务是根据给定的知识领域，分析并生成**其他独立的知识领域**。

## 重要概念区分

**知识领域（Knowledge Domain）**：一个独立的学科或技术领域，可以作为一个完整的知识图谱存在。
- 例如：量子密码学、密码学、量子计算、信息安全、线性代数、机器学习

**知识点（Knowledge Point）**：知识领域内部的子主题或概念，不应该作为独立的知识领域。
- 例如：量子密钥分发是量子密码学内部的知识点，不是独立领域
- 例如：后量子密码是量子密码学的分支，不是独立领域
- 例如：CNN是深度学习的知识点，不是独立领域

## 你的任务

分析给定的知识领域，找出与之相关的**其他独立知识领域**，而不是该领域内部的子主题。

## 关系类型说明

1. **前置知识（prerequisite）**：学习当前领域之前需要掌握的独立领域
   - 例如：学习"量子密码学"前需要掌握"密码学"、"量子力学"、"线性代数"
   
2. **扩展知识（extension）**：当前领域学习后可以深入探索的独立领域
   - 例如：学完"量子密码学"后可以学习"量子通信"、"量子计算应用"
   
3. **相关知识（related）**：与当前领域有交叉或关联的独立领域
   - 例如："量子密码学"的相关领域有"信息安全"、"网络安全"

## 当前知识领域

领域名称：{{domainTitle}}
{{#if domainDescription}}
领域描述：{{domainDescription}}
{{/if}}

## 注意事项

1. 每种类型最多生成 {{maxGraphsPerLevel}} 个领域
2. **必须生成独立的知识领域**，不要生成当前领域的子主题或知识点
3. 生成的领域应该足够"大"，可以独立成为一个知识图谱
4. 如果某个方向没有合适的独立领域，可以返回空数组
5. 描述应该说明该领域包含什么内容，而不是它与当前领域的关系

请用中文回复。', NOW(), NOW()),
('cross_graph_connection_analysis', 'system', null, null, '你是一个知识图谱专家。你的任务是分析两个知识图谱之间的节点关系，找出潜在的连接。

## 图谱信息

**图谱 1**：{{graph1Title}}
{{#if graph1Description}}描述：{{graph1Description}}{{/if}}

**图谱 2**：{{graph2Title}}
{{#if graph2Description}}描述：{{graph2Description}}{{/if}}

## 图谱 1 的节点

{{graph1Nodes}}

## 图谱 2 的节点

{{graph2Nodes}}

## 分析任务

请分析两个图谱中的节点，找出语义相似或相关的节点对。重点关注：

1. **相同概念（same_concept）**：两个节点描述的是同一个概念或知识点
2. **相关概念（related_concept）**：两个节点描述的是相关但不同的概念
3. **互补知识（complementary）**：两个节点互为补充，可以一起学习
4. **前置知识（prerequisite）**：一个节点是另一个节点的前置知识

## 注意事项

1. 只建议相似度 >= 0.5 的连接
2. 每个节点最多建议 3 个连接
3. 提供清晰的连接理由
4. 相似度范围：0 到 1

请用中文回复。', NOW(), NOW()),
('generate_task_details', 'system', null, null, '你是一个专业的任务管理助手。根据用户提供的任务标题，生成详细的任务描述和建议。

请分析任务标题{{#if context}}和补充信息：{{context}}{{/if}}，生成以下内容：

1. **任务描述**：详细说明任务目标、关键步骤、预期成果（50-150字）
2. **标签**：推荐2-5个相关标签（如：学习、工作、阅读、编程、复习、项目、会议、运动、休息等）
3. **预计时长**：根据任务复杂度估算完成时间（15-180分钟）
4. **优先级**：评估任务重要程度（1=低，2=中，3=高，4=紧急）
5. **队列建议**：推荐任务应该放入的队列

队列判断标准：
- **Q0 紧急队列**：需要立即处理、有紧迫截止日期、高优先级任务
- **Q1 重要队列**：重要但不紧急、需要专注完成的任务  
- **Q2 待办队列**：常规任务、可以稍后处理的任务

请确保：
- 描述具体、可操作
- 标签实用、常用
- 时长合理、符合任务复杂度', NOW(), NOW())
ON CONFLICT (code, scope, user_id, graph_id) DO NOTHING;

-- =====================================================
-- RELATIONSHIP TYPES
-- =====================================================

-- 层级结构 (hierarchical)
INSERT INTO relationship_types (name, display_name, category, color, line_style, show_arrow, is_builtin) VALUES
  ('contains', '包含', 'hierarchical', '#3B82F6', 'solid', 'auto', true),
  ('part_of', '属于', 'hierarchical', '#3B82F6', 'solid', 'auto', true),
  ('parent_child', '父子', 'hierarchical', '#3B82F6', 'solid', 'auto', true)
ON CONFLICT (name) DO NOTHING;

-- 依赖约束 (dependency)
INSERT INTO relationship_types (name, display_name, category, color, line_style, show_arrow, is_builtin) VALUES
  ('depends_on', '依赖', 'dependency', '#F59E0B', 'dashed', 'true', true),
  ('prerequisite', '前提', 'dependency', '#F59E0B', 'dashed', 'true', true),
  ('constrains', '制约', 'dependency', '#F59E0B', 'dashed', 'true', true),
  ('supports', '支撑', 'dependency', '#F59E0B', 'dashed', 'true', true),
  ('mutex', '互斥', 'dependency', '#EF4444', 'dotted', 'false', true),
  ('exclusive', '排他', 'dependency', '#EF4444', 'dotted', 'false', true)
ON CONFLICT (name) DO NOTHING;

-- 语义关系 (semantic)
INSERT INTO relationship_types (name, display_name, category, color, line_style, show_arrow, is_builtin) VALUES
  ('related', '相关', 'semantic', '#6B7280', 'solid', 'false', true),
  ('similar_to', '相似', 'semantic', '#8B5CF6', 'solid', 'false', true),
  ('opposite', '相反', 'semantic', '#EC4899', 'solid', 'false', true),
  ('synonym', '同义', 'semantic', '#8B5CF6', 'solid', 'false', true),
  ('equivalent', '等价', 'semantic', '#8B5CF6', 'solid', 'false', true),
  ('generalization', '泛化', 'semantic', '#10B981', 'solid', 'true', true),
  ('specialization', '特化', 'semantic', '#10B981', 'solid', 'true', true)
ON CONFLICT (name) DO NOTHING;

-- 时序流程 (temporal)
INSERT INTO relationship_types (name, display_name, category, color, line_style, show_arrow, is_builtin) VALUES
  ('follows', '后续', 'temporal', '#06B6D4', 'dashed', 'true', true),
  ('parallel', '并行', 'temporal', '#06B6D4', 'solid', 'false', true),
  ('branch', '分支', 'temporal', '#06B6D4', 'solid', 'true', true),
  ('merge', '汇合', 'temporal', '#06B6D4', 'solid', 'true', true),
  ('trigger', '触发', 'temporal', '#06B6D4', 'dashed', 'true', true),
  ('loop', '循环', 'temporal', '#06B6D4', 'dashed', 'true', true)
ON CONFLICT (name) DO NOTHING;

-- 交互行为 (interaction)
INSERT INTO relationship_types (name, display_name, category, color, line_style, show_arrow, is_builtin) VALUES
  ('points_to', '指向', 'interaction', '#F97316', 'solid', 'true', true),
  ('acts_on', '作用', 'interaction', '#F97316', 'solid', 'true', true),
  ('influences', '影响', 'interaction', '#F97316', 'dashed', 'true', true),
  ('feedback', '反馈', 'interaction', '#F97316', 'dashed', 'true', true),
  ('calls', '调用', 'interaction', '#F97316', 'solid', 'true', true)
ON CONFLICT (name) DO NOTHING;

-- 因果推导 (causal)
INSERT INTO relationship_types (name, display_name, category, color, line_style, show_arrow, is_builtin) VALUES
  ('causes', '因果', 'causal', '#DC2626', 'solid', 'true', true),
  ('derives', '推导', 'causal', '#DC2626', 'solid', 'true', true),
  ('proportional', '正比', 'causal', '#DC2626', 'solid', 'false', true),
  ('inverse', '反比', 'causal', '#DC2626', 'solid', 'false', true)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- TASK TEMPLATES
-- =====================================================

INSERT INTO task_templates (name, description, category, title_template, description_template, estimated_duration, tags, priority, is_system, is_default) VALUES
-- Study templates
('深度学习', '专注学习新知识', 'study', '学习：{{topic}}', '深入学习 {{topic}}，理解核心概念和应用场景', 45, ARRAY['学习', '专注'], 3, TRUE, TRUE),
('复习巩固', '复习已学内容', 'study', '复习：{{topic}}', '复习 {{topic}}，巩固知识点，查漏补缺', 25, ARRAY['学习', '复习'], 2, TRUE, FALSE),
('阅读笔记', '阅读并做笔记', 'study', '阅读：{{book_name}}', '阅读 {{book_name}}，记录要点和心得', 30, ARRAY['学习', '阅读'], 2, TRUE, FALSE),
('练习题', '做练习题巩固知识', 'study', '练习：{{subject}}', '完成 {{subject}} 相关练习题', 40, ARRAY['学习', '练习'], 2, TRUE, FALSE),

-- Work templates
('项目开发', '开发项目任务', 'work', '开发：{{feature}}', '开发 {{feature}} 功能，包括设计、编码和测试', 60, ARRAY['工作', '开发'], 3, TRUE, TRUE),
('会议准备', '准备会议材料', 'work', '准备会议：{{meeting_name}}', '准备 {{meeting_name}} 会议材料和演示文稿', 30, ARRAY['工作', '会议'], 2, TRUE, FALSE),
('代码审查', '审查代码', 'work', '代码审查：{{project}}', '审查 {{project}} 项目代码，检查代码质量和规范', 45, ARRAY['工作', '代码'], 2, TRUE, FALSE),
('文档编写', '编写文档', 'work', '文档：{{doc_name}}', '编写 {{doc_name}} 相关文档', 40, ARRAY['工作', '文档'], 2, TRUE, FALSE),
('邮件处理', '处理邮件', 'work', '处理邮件', '检查和回复重要邮件', 15, ARRAY['工作', '邮件'], 1, TRUE, FALSE),

-- Life templates
('购物清单', '采购物品', 'life', '购物：{{items}}', '购买 {{items}}', 30, ARRAY['生活', '购物'], 1, TRUE, TRUE),
('家务整理', '整理家务', 'life', '家务：{{task}}', '完成 {{task}} 家务整理', 30, ARRAY['生活', '家务'], 1, TRUE, FALSE),
('账单支付', '支付账单', 'life', '支付账单', '处理各类账单支付', 15, ARRAY['生活', '财务'], 2, TRUE, FALSE),

-- Health templates
('运动健身', '锻炼身体', 'health', '运动：{{type}}', '进行 {{type}} 运动，保持身体健康', 45, ARRAY['健康', '运动'], 2, TRUE, TRUE),
('冥想放松', '冥想放松身心', 'health', '冥想放松', '进行冥想练习，放松身心', 15, ARRAY['健康', '冥想'], 1, TRUE, FALSE),
('健康检查', '健康相关事项', 'health', '健康：{{item}}', '处理 {{item}} 健康相关事项', 30, ARRAY['健康'], 2, TRUE, FALSE)
ON CONFLICT DO NOTHING;

-- =====================================================
-- PASS REWARDS
-- =====================================================

INSERT INTO pass_rewards (period_type, level, points_required, reward_type, reward_value, name, description, icon) VALUES
-- Weekly Pass (15 levels, 40 points total to complete all tasks = 4 tasks * 10 points each)
('weekly', 1, 10, 'xp', 50, '起步者', '完成第一个周任务', '🌱'),
('weekly', 2, 20, 'xp', 50, '初见成效', '继续努力', '⭐'),
('weekly', 3, 30, 'xp', 75, '渐入佳境', '保持势头', '✨'),
('weekly', 4, 40, 'xp', 75, '周常达人', '完成所有周任务', '🏆'),
('weekly', 5, 50, 'achievement', 0, '周冠军', '连续完成周任务', '🥇'),

-- Monthly Pass (20 levels, ~160 points total)
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

-- Quarterly Pass (20 levels, ~480 points total)
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
