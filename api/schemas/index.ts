import { z } from 'zod';

// --- Auth Schemas ---
export const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少需要6位'),
  name: z.string().min(1, '姓名不能为空'),
});

export const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '密码不能为空'),
});

export const updateProfileSchema = z.object({
  name: z.string().optional(),
  settings: z.record(z.any()).optional(),
});

// --- Common Schemas ---
export const uuidParamsSchema = z.object({
  id: z.string().uuid('无效的ID格式'),
});

// --- Graph Schemas ---
export const createGraphSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  description: z.string().optional(),
});

export const updateGraphSchema = z.object({
  title: z.string().min(1, '标题不能为空').optional(),
  description: z.string().optional(),
  settings: z.record(z.any()).optional(),
});

export const shareGraphSchema = z.object({
  is_public: z.boolean({ required_error: '必须指定是否公开' }),
});

// --- Node Schemas ---
export const createNodeSchema = z.object({
  id: z.string().uuid().optional(),
  graph_id: z.string().uuid('无效的图谱ID'),
  title: z.string().min(1, '标题不能为空'),
  content: z.string().optional(),
  x_position: z.number().optional(),
  y_position: z.number().optional(),
  properties: z.record(z.any()).optional(),
  learning_material: z.string().optional(),
  level: z.enum(['root', 'core', 'sub', 'normal', 'leaf']).optional(),
  is_accepted: z.boolean().optional(),
});

export const updateNodeSchema = createNodeSchema.partial().omit({ graph_id: true });

export const batchDeleteNodesSchema = z.object({
  node_ids: z.array(z.string().uuid()).min(1, '请提供有效的节点ID列表'),
});

export const relatedNodesQuerySchema = z.object({
  limit: z.string().optional().transform(val => (val ? parseInt(val, 10) : 5)),
});

// --- Edge Schemas ---
export const createEdgeSchema = z.object({
  source_node_id: z.string().uuid('无效的源节点ID'),
  target_node_id: z.string().uuid('无效的目标节点ID'),
  relationship_type: z.string().optional(),
});

export const updateEdgeSchema = z.object({
  relationship_type: z.string().optional(),
});

// --- Study Schemas ---
export const createCardSchema = z.object({
  node_id: z.string().uuid('无效的节点ID'),
  question: z.string().min(1, '问题不能为空'),
  answer: z.string().min(1, '答案不能为空'),
});

export const createCardsBatchSchema = z.object({
  cards: z.array(z.object({
    node_id: z.string().uuid('无效的节点ID'),
    question: z.string().min(1, '问题不能为空'),
    answer: z.string().min(1, '答案不能为空'),
    type: z.enum(['qa', 'choice', 'true_false']).optional(),
    options: z.any().optional(),
  })).min(1, '至少需要一张卡片'),
});

export const updateCardProgressSchema = z.object({
  quality: z.number().min(0).max(5, '质量评分必须在0-5之间'),
});

// --- AI Schemas ---
export const generateContentSchema = z.object({
  topic: z.string().min(1, '主题不能为空'),
  context: z.string().optional(),
  level: z.string().optional(),
  provider: z.enum(['deepseek', 'volcengine', 'aliyun']).optional(),
  model: z.string().optional(),
});

export const generateLearningMaterialSchema = z.object({
  topic: z.string().min(1, '主题不能为空'),
  context: z.string().optional(),
  level: z.string().optional(),
  provider: z.enum(['deepseek', 'volcengine', 'aliyun']).optional(),
  model: z.string().optional(),
});

export const expandKnowledgeSchema = z.object({
  node_title: z.string().min(1, '节点标题不能为空'),
  node_content: z.string().optional(),
  node_level: z.string().optional(),
  existing_titles: z.array(z.string()).optional(),
  current_children: z.array(z.string()).optional(),
  expand_prompt: z.string().optional(),
  provider: z.enum(['deepseek', 'volcengine', 'aliyun']).optional(),
  model: z.string().optional(),
});

export const generateCardsSchema = z.object({
  node_title: z.string().min(1, '节点标题不能为空'),
  node_content: z.string().optional(),
  count: z.number().min(1).max(50).optional(),
  types: z.array(z.enum(['qa', 'choice', 'true_false', 'multi_choice', 'fill_in_the_blank', 'essay'])).optional(),
  provider: z.enum(['deepseek', 'volcengine', 'aliyun']).optional(),
  model: z.string().optional(),
});

export const generateCardsBatchSchema = z.object({
  node_ids: z.array(z.string().uuid()).min(1),
  config: z.object({
    types: z.array(z.enum(['qa', 'choice', 'true_false', 'multi_choice', 'fill_in_the_blank', 'essay'])).optional(),
    count: z.number().min(1).max(50).optional(), // Increased max count for packs
    pack_template: z.enum(['standard', 'comprehensive', 'exam', 'quick']).optional(),
    provider: z.enum(['deepseek', 'volcengine', 'aliyun']).optional(),
    model: z.string().optional(),
  }).optional(),
});

export const textToGraphSchema = z.object({
  text: z.string().optional(),
  graph_id: z.string().uuid('无效的图谱ID'),
  action: z.enum(['analyze', 'save']).optional(),
  nodes: z.array(z.any()).optional(),
  edges: z.array(z.any()).optional(),
  provider: z.enum(['deepseek', 'volcengine', 'aliyun']).optional(),
  model: z.string().optional(),
});

export const chatSchema = z.object({
  message: z.string().min(1, '消息不能为空'),
  graph_id: z.string().uuid('无效的图谱ID'),
  history: z.array(z.any()).optional(),
  context_node_ids: z.array(z.string().uuid()).optional(),
  provider: z.enum(['deepseek', 'volcengine', 'aliyun']).optional(),
  model: z.string().optional(),
});

export const recommendConnectionsSchema = z.object({
  graph_id: z.string().uuid('无效的图谱ID'),
  node_title: z.string().min(1, '节点标题不能为空'),
  node_content: z.string().optional(),
  provider: z.enum(['deepseek', 'volcengine', 'aliyun']).optional(),
  model: z.string().optional(),
});

export const documentToGraphSchema = z.object({
  graph_id: z.string().uuid('无效的图谱ID'),
});

export const branchSuggestionsSchema = z.object({
  node_title: z.string().min(1, '节点标题不能为空'),
  node_content: z.string().optional(),
  existing_nodes: z.array(z.string()).optional(),
  child_nodes: z.array(z.string()).optional(),
  context_level: z.string().optional(),
  provider: z.enum(['deepseek', 'volcengine', 'aliyun']).optional(),
  model: z.string().optional(),
});

export const tutorChatSchema = z.object({
  message: z.string().min(1, '消息不能为空'),
  graph_id: z.string().uuid('无效的图谱ID').optional(),
  history: z.array(z.any()).optional(),
  context_node_ids: z.array(z.string().uuid()).optional(),
  mode: z.enum(['free', 'guided']).optional(),
  provider: z.enum(['deepseek', 'volcengine', 'aliyun']).optional(),
  model: z.string().optional(),
});

export const extractConceptsSchema = z.object({
  text: z.string().min(1, '文本不能为空'),
  existing_nodes: z.array(z.string()).optional(),
  max_concepts: z.number().min(1).max(10).optional(),
  provider: z.enum(['deepseek', 'volcengine', 'aliyun']).optional(),
  model: z.string().optional(),
});

export const suggestNextTopicSchema = z.object({
  node_title: z.string().min(1, '节点标题不能为空'),
  node_content: z.string().optional(),
  existing_nodes: z.array(z.string()).optional(),
  user_progress: z.object({
    mastered_count: z.number().optional(),
    due_count: z.number().optional(),
    current_level: z.string().optional(),
  }).optional(),
  provider: z.enum(['deepseek', 'volcengine', 'aliyun']).optional(),
  model: z.string().optional(),
});

// --- Data Schemas ---
export const importDataSchema = z.object({
  graph_title: z.string().min(1, '图谱标题不能为空'),
  nodes: z.array(z.object({
    id: z.string().optional(), // Old ID for mapping
    title: z.string().min(1, '节点标题不能为空'),
    content: z.string().optional(),
    x_position: z.number().optional(),
    y_position: z.number().optional(),
    color: z.string().optional(),
    level: z.string().optional(),
  })).optional(),
  edges: z.array(z.object({
    source: z.string(), // ID or index
    target: z.string(), // ID or index
    relationship: z.string().optional(),
  })).optional(),
});

// --- Template Schemas ---
export const createTemplateSchema = z.object({
  name: z.string().min(1, '模板名称不能为空'),
  description: z.string().optional(),
  category: z.enum(['learning', 'story', 'project', 'analysis', 'custom']),
  nodes: z.array(z.object({
    id: z.string().min(1, '节点ID不能为空'),
    title: z.string().min(1, '节点标题不能为空'),
    level: z.enum(['root', 'core', 'sub', 'normal', 'leaf']),
    parentId: z.string().optional(),
    aiPrompt: z.string().optional(),
    color: z.string().optional(),
    x_position: z.number().optional(),
    y_position: z.number().optional(),
    position_zone: z.string().optional(),
  })).min(1, '至少需要一个节点'),
  edges: z.array(z.object({
    source: z.string().min(1, '源节点ID不能为空'),
    target: z.string().min(1, '目标节点ID不能为空'),
    relationship_type: z.string().optional(),
  })).optional(),
  layout: z.object({
    type: z.enum(['default', 'quadrant', 'timeline', 'flowchart', 'mindmap']),
    showAxes: z.boolean().optional(),
    showGrid: z.boolean().optional(),
    showLabels: z.boolean().optional(),
    axes: z.object({
      x: z.object({
        label: z.string().optional(),
        min: z.number().optional(),
        max: z.number().optional(),
      }).optional(),
      y: z.object({
        label: z.string().optional(),
        min: z.number().optional(),
        max: z.number().optional(),
      }).optional(),
    }).optional(),
    zones: z.array(z.object({
      id: z.string(),
      label: z.string(),
      bounds: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }),
      color: z.string().optional(),
    })).optional(),
    timeline: z.object({
      direction: z.enum(['horizontal', 'vertical']),
      startLabel: z.string().optional(),
      endLabel: z.string().optional(),
    }).optional(),
  }).optional(),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const createGraphFromTemplateSchema = z.object({
  template_id: z.string().uuid('无效的模板ID'),
  title: z.string().min(1, '标题不能为空'),
  description: z.string().optional(),
});

// --- TTS Schemas ---
export const ttsSchema = z.object({
  text: z.string().min(1, '文本不能为空').max(5000, '文本过长'),
  voice: z.string().optional(),
  speed: z.number().min(0.5).max(2.0).optional(),
  output_format: z.enum(['mp3', 'wav']).optional(),
});

export const ttsVoicesSchema = z.object({});
