-- =====================================================
-- Knowledge Map - Initial Seed Data
-- Generated: 2026-02-19 (consolidated migrations)
-- =====================================================

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

INSERT INTO achievements (code, name, description, category, icon, xp_reward, condition_type, condition_value) VALUES
  ('streak_3', '初出茅庐', '保持3天连续学习', 'study', 'Flame', 100, 'streak_days', 3),
  ('streak_7', '坚持不懈', '保持7天连续学习', 'study', 'Zap', 300, 'streak_days', 7),
  ('streak_14', '持之以恒', '保持14天连续学习', 'study', 'Zap', 500, 'streak_days', 14),
  ('streak_30', '月度大师', '保持30天连续学习', 'study', 'Crown', 1000, 'streak_days', 30),
  ('streak_100', '百日筑基', '保持100天连续学习', 'study', 'Crown', 5000, 'streak_days', 100),
  ('focus_10', '专注时刻', '完成10分钟专注时间', 'focus', 'Timer', 50, 'focus_minutes', 10),
  ('focus_60', '深度潜入', '完成60分钟专注时间', 'focus', 'Timer', 150, 'focus_minutes', 60),
  ('focus_300', '专注大师', '完成300分钟(5小时)专注时间', 'focus', 'Brain', 500, 'focus_minutes', 300),
  ('focus_1000', '心流境界', '完成1000分钟专注时间', 'focus', 'Brain', 1500, 'focus_minutes', 1000),
  ('mastery_1', '初试牛刀', '掌握1张知识卡片', 'study', 'GraduationCap', 50, 'cards_mastered', 1),
  ('mastery_10', '跬步千里', '掌握10张知识卡片', 'study', 'GraduationCap', 100, 'cards_mastered', 10),
  ('mastery_50', '求知若渴', '掌握50张知识卡片', 'study', 'BookOpen', 300, 'cards_mastered', 50),
  ('mastery_100', '领域专家', '掌握100张知识卡片', 'study', 'Trophy', 600, 'cards_mastered', 100),
  ('mastery_500', '博闻强识', '掌握500张知识卡片', 'study', 'Trophy', 2500, 'cards_mastered', 500),
  ('creation_graph_1', '创世之初', '创建第1个知识图谱', 'creation', 'BookOpen', 200, 'graphs_created', 1),
  ('creation_graph_5', '知识架构师', '创建5个知识图谱', 'creation', 'BookOpen', 800, 'graphs_created', 5),
  ('creation_node_10', '萌芽', '创建10个知识节点', 'creation', 'Target', 100, 'nodes_created', 10),
  ('creation_node_100', '枝繁叶茂', '创建100个知识节点', 'creation', 'Target', 500, 'nodes_created', 100),
  ('creation_node_1000', '知识森林', '创建1000个知识节点', 'creation', 'Target', 2000, 'nodes_created', 1000)
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

Do not suggest topics that are already listed in ''Current Direct Children''.', '2026-02-09 08:32:26.326666+00', '2026-02-09 08:32:26.326666+00'),
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
{{/if}}', '2026-02-09 08:32:26.326666+00', '2026-02-09 08:32:26.326666+00'),
('chat', 'system', null, null, 'You are an intelligent assistant for a Knowledge Graph.
Answer the user''s question based on the provided Graph Context.

Graph Context:
{{contextText}}

Instructions:
1. Use the information in the Graph Context to answer.
2. If the answer is not in the context, use your general knowledge but mention that it''s not explicitly in the graph.
3. Be concise and helpful.
4. Respond in the same language as the user''s question (default to Chinese).', '2026-02-09 08:32:26.326666+00', '2026-02-09 08:32:26.326666+00'),
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
7. Limit the output to a maximum of 50-100 nodes. Prioritize the most important concepts to fit within this limit.', '2026-02-09 08:32:26.326666+00', '2026-02-09 08:32:26.326666+00'),
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
7. All mathematical formulas must be wrapped in LaTeX: $inline$ or $$block$$', '2026-02-09 08:32:26.326666+00', '2026-02-09 08:32:26.326666+00'),
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

Do not suggest topics that are already listed in ''Current Direct Children''.', '2026-02-09 08:32:26.326666+00', '2026-02-09 08:32:26.326666+00'),
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
IMPORTANT: Directly output the analysis content. Do NOT include any conversational filler (e.g., "Okay", "Here is the analysis", "As an expert...").', '2026-02-09 17:07:36.60188+00', '2026-02-09 17:07:36.60188+00'),
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
- All titles and descriptions in Chinese.', '2026-02-09 08:32:26.326666+00', '2026-02-09 08:32:26.326666+00'),
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

Format your response in Markdown. Use headers, bullet points, and code blocks (if applicable) to make it readable.', '2026-02-09 08:32:26.326666+00', '2026-02-09 08:32:26.326666+00'),
('recommend_connections', 'system', null, null, 'You are a knowledge graph expert. Given a new node (title and content) and a list of existing nodes in a graph, suggest 1-3 most relevant existing nodes to connect to.

New Node:
Title: {{node_title}}
Content: {{node_content}}

Existing Nodes:
{{existing_nodes_json}}', '2026-02-09 08:32:26.326666+00', '2026-02-09 08:32:26.326666+00'),
('term_annotation', 'system', null, null, '你是一个专业的学术助手。请分析以下文本，提取其中的关键专业术语。', '2026-02-09 15:15:32.619571+00', '2026-02-09 15:15:32.619571+00'),
('generate_cards_choice', 'system', null, null, 'For ''choice'' type: Create multiple-choice questions with 4 plausible options. 
Provide the correct answer and a detailed ''explanation'' of why it is correct and others are wrong.
Distractors should be common misconceptions if possible.', '2026-02-10 13:37:50.705989+00', '2026-02-10 13:37:50.705989+00'),
('generate_cards_essay', 'system', null, null, 'For ''essay'' type: Create complex questions requiring a long-form structured answer. 
The ''answer'' should be a model response with key points. 
Provide a detailed ''explanation'' with scoring criteria and key concepts to cover.', '2026-02-10 13:37:50.705989+00', '2026-02-10 13:37:50.705989+00'),
('generate_cards_fill_blank', 'system', null, null, 'For ''fill_in_the_blank'' type: Create a sentence with one or more ''___'' (3 underscores) as blanks. 
The ''answer'' should be the missing text. Provide a detailed ''explanation''.', '2026-02-10 13:37:50.705989+00', '2026-02-10 13:37:50.705989+00'),
('generate_cards_multi_choice', 'system', null, null, 'For ''multi_choice'' type: Create multiple-choice questions where ONE OR MORE options can be correct. 
Provide 4 options, the ''answer'' as a JSON array of correct strings, and a detailed ''explanation''.', '2026-02-10 13:37:50.705989+00', '2026-02-10 13:37:50.705989+00'),
('generate_cards_qa', 'system', null, null, 'For ''qa'' type: Create thought-provoking open-ended questions that test deep understanding. 
Provide a detailed ''explanation'' analyzing the answer.
Focus on explaining the "Why" and "How" rather than just "What".', '2026-02-10 13:37:50.705989+00', '2026-02-10 13:37:50.705989+00'),
('generate_cards_true_false', 'system', null, null, 'For ''true_false'' type: Create statements focusing on common misconceptions or key details. 
Provide a detailed ''explanation'' clarifying the fact.', '2026-02-10 13:37:50.705989+00', '2026-02-10 13:37:50.705989+00'),
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

请用中文回复。', NOW(), NOW())
ON CONFLICT (code, scope, user_id, graph_id) DO NOTHING;
