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

// --- Node Schemas ---
export const createNodeSchema = z.object({
  id: z.string().uuid().optional(),
  graph_id: z.string().uuid('无效的图谱ID'),
  title: z.string().min(1, '标题不能为空'),
  content: z.string().optional(),
  x_position: z.number().optional(),
  y_position: z.number().optional(),
  color: z.string().optional(),
  properties: z.record(z.any()).optional(),
  learning_material: z.string().optional(),
  level: z.enum(['root', 'core', 'sub', 'normal', 'leaf']).optional(),
});

export const updateNodeSchema = createNodeSchema.partial().omit({ graph_id: true });

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
  existing_nodes: z.array(z.string()).optional(),
  child_nodes: z.array(z.string()).optional(), // Add child_nodes
  context_level: z.string().optional(),
  provider: z.enum(['deepseek', 'volcengine', 'aliyun']).optional(),
  model: z.string().optional(),
});

export const generateCardsSchema = z.object({
  node_title: z.string().min(1, '节点标题不能为空'),
  node_content: z.string().optional(),
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
