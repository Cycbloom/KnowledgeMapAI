import { Router, type Response } from 'express';
import OpenAI from 'openai';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import dotenv from 'dotenv';
import { validate } from '../middleware/validate.js';
import { generateContentSchema, expandKnowledgeSchema, generateCardsSchema, textToGraphSchema, chatSchema } from '../schemas/index.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { AppError } from '../middleware/errorHandler.js';
import { CacheKeys, cacheService } from '../services/cache.js';
import { graphService } from '../services/graphService.js';

dotenv.config();

const router = Router();

const apiKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
const baseURL = process.env.DEEPSEEK_API_KEY ? 'https://api.deepseek.com' : undefined;
const model = process.env.DEEPSEEK_API_KEY ? 'deepseek-chat' : 'gpt-3.5-turbo';

const openai = apiKey ? new OpenAI({ apiKey, baseURL }) : null;

// Helper to generate mock response if no API key
const getMockResponse = (type: string, prompt: string) => {
  if (type === 'content') {
    return `[模拟 AI 内容] 为以下主题生成的内容: ${prompt}。 \n\n这是一个占位符响应，因为 API 密钥未配置。`;
  }
  if (type === 'expand') {
    return [
      { title: `与 ${prompt} 相关 1`, content: '描述 1' },
      { title: `与 ${prompt} 相关 2`, content: '描述 2' },
      { title: `与 ${prompt} 相关 3`, content: '描述 3' },
    ];
  }
  if (type === 'chat') {
     return `[模拟 AI 回复] 我收到了你的问题: "${prompt}"。这是一个模拟回复，因为后端没有配置 API Key。`;
  }
  return '';
};

router.post('/generate-content', requireAuth, validate(generateContentSchema), async (req: AuthRequest, res: Response) => {
  const { topic, context } = req.body;

  if (!openai) {
    return res.json({ content: getMockResponse('content', topic) });
  }

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful knowledge assistant. Generate detailed content for a knowledge graph node. Please respond in Chinese." },
        { role: "user", content: `Topic: ${topic}\nContext: ${context || 'General knowledge'}` }
      ],
      model: model,
    });

    res.json({ content: completion.choices[0].message.content });
  } catch (error: any) {
    console.error('AI Error:', error);
    res.status(500).json({ error: error.message || 'AI 生成失败' });
  }
});

router.post('/generate-content-stream', requireAuth, validate(generateContentSchema), async (req: AuthRequest, res: Response) => {
  const { topic, context } = req.body;

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (!openai) {
    // Mock Streaming
    const mockContent = getMockResponse('content', topic) as string;
    const chunks = mockContent.split('');
    
    const sendMockChunks = async () => {
      for (const chunk of chunks) {
         res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
         await new Promise(resolve => setTimeout(resolve, 30)); // Simulate delay
      }
      res.write('data: [DONE]\n\n');
      res.end();
    };
    
    sendMockChunks();
    return;
  }

  try {
    const stream = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a helpful knowledge assistant. Generate detailed content for a knowledge graph node. Please respond in Chinese." },
        { role: "user", content: `Topic: ${topic}\nContext: ${context || 'General knowledge'}` }
      ],
      model: model,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error('AI Stream Error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'AI 生成失败', code: ErrorCodes.INTERNAL_ERROR })}\n\n`);
    res.end();
  }
});

router.post('/expand-knowledge', requireAuth, validate(expandKnowledgeSchema), async (req: AuthRequest, res: Response) => {
  const { node_title } = req.body;

  if (!openai) {
    return res.json({ suggestions: getMockResponse('expand', node_title) });
  }

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are a knowledge graph expert. Suggest 3-5 related sub-topics for the given node to expand the graph. Return JSON array of objects with 'title' and 'content'. Please respond in Chinese." },
        { role: "user", content: `Node: ${node_title}` }
      ],
      model: model,
      response_format: { type: "json_object" }, // Ensure JSON output
    });

    const content = completion.choices[0].message.content;
    const parsed = JSON.parse(content || '{"suggestions": []}');
    res.json({ suggestions: parsed.suggestions || parsed });
  } catch (error: any) {
    console.error('AI Error:', error);
    throw new AppError(error.message || 'AI expansion failed', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.post('/generate-cards', requireAuth, validate(generateCardsSchema), async (req: AuthRequest, res: Response) => {
  const { node_title, node_content } = req.body;

  if (!openai) {
    // Mock response
    return res.json({ 
      cards: [
        { type: 'qa', question: `什么是 ${node_title}?`, answer: `${node_title} 的定义是... (Mock)` },
        { type: 'choice', question: `${node_title} 属于哪一类?`, options: ['A类', 'B类', 'C类', 'D类'], answer: 'A类' },
        { type: 'true_false', question: `${node_title} 是一个重要的概念吗?`, answer: 'True' }
      ] 
    });
  }

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: "You are an educational expert. Generate 3-5 flashcards based on the provided topic and content. Mix different types: 'qa' (Question/Answer), 'choice' (Multiple Choice with 4 options), and 'true_false'. Return a JSON object with a 'cards' array. Each card object must have: 'type' (qa|choice|true_false), 'question', 'answer'. For 'choice' type, add 'options' array. Please respond in Chinese." },
        { role: "user", content: `Topic: ${node_title}\nContent: ${node_content || 'No detailed content provided.'}` }
      ],
      model: model,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    const parsed = JSON.parse(content || '{"cards": []}');
    res.json({ cards: parsed.cards || [] });
  } catch (error: any) {
    console.error('AI Error:', error);
    throw new AppError(error.message || 'AI card generation failed', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.post('/text-to-graph', requireAuth, validate(textToGraphSchema), async (req: AuthRequest, res: Response) => {
  const { text, graph_id, action = 'analyze', nodes, edges } = req.body;

  // Handle Save Action (Batch Insert)
  if (action === 'save') {
    if (!graph_id) {
      throw new AppError('Graph ID is required for saving', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      throw new AppError('No nodes provided for saving', 400, ErrorCodes.VALIDATION_ERROR);
    }

    try {
      // 1. Prepare Nodes with UUIDs
      const nodeMap = new Map<string, string>(); // temp_id -> real_uuid
      
      const nodesToInsert = nodes.map((node: any) => {
        // Generate UUID
        const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
        
        // If node has an ID (temp_id), map it. 
        if (node.id) nodeMap.set(node.id, uuid);
        
        return {
          id: uuid,
          graph_id,
          title: node.title,
          content: node.content || '',
          x_position: Math.round((Math.random() - 0.5) * 50),
          y_position: Math.round((Math.random() - 0.5) * 50),
          color: node.level === 'root' ? '#8B5CF6' : 
                 node.level === 'core' ? '#EF4444' : 
                 node.level === 'sub' ? '#F59E0B' : 
                 node.level === 'normal' ? '#3B82F6' : '#10B981',
          level: node.level || 'leaf',
          properties: { 
            ...node.properties, 
            source: 'ai-text-to-graph' 
          }
        };
      });

      // 2. Batch Insert Nodes
      const { error: nodeError } = await req.supabase!
        .from('nodes')
        .insert(nodesToInsert);

      if (nodeError) throw new AppError(nodeError.message, 500, ErrorCodes.INTERNAL_ERROR);

      // 3. Prepare Edges
      const edgesToInsert: any[] = [];
      if (edges && Array.isArray(edges)) {
        edges.forEach((edge: any) => {
          const sourceUuid = nodeMap.get(edge.source);
          const targetUuid = nodeMap.get(edge.target);
          
          if (sourceUuid && targetUuid) {
            edgesToInsert.push({
              source_node_id: sourceUuid,
              target_node_id: targetUuid,
              relationship_type: edge.relationship || 'related',
              graph_id
            });
          }
        });
      }

      // 4. Batch Insert Edges
      if (edgesToInsert.length > 0) {
        const { error: edgeError } = await req.supabase!
          .from('edges')
          .insert(edgesToInsert);
          
        if (edgeError) console.error('Edge insertion error:', edgeError);
      }

      // 5. Invalidate Cache
      cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graph_id));

      return res.json({ 
        success: true, 
        nodeCount: nodesToInsert.length, 
        edgeCount: edgesToInsert.length 
      });

    } catch (error: any) {
      console.error('Save Graph Error:', error);
      throw new AppError(error.message || 'Failed to save graph', 500, ErrorCodes.INTERNAL_ERROR);
    }
  }

  // Handle Analyze Action (AI Generation)
  if (!text || text.length < 10) {
    throw new AppError('Text content must be at least 10 characters long', 400, ErrorCodes.VALIDATION_ERROR);
  }

  if (!openai) {
    // Mock response for dev
    return res.json({
      nodes: [
        { id: 'mock_1', title: '核心主题 (Mock)', content: '这是核心主题', level: 'root' },
        { id: 'mock_2', title: '主要分支 A', content: '分支 A 的描述', level: 'core' },
        { id: 'mock_3', title: '主要分支 B', content: '分支 B 的描述', level: 'core' },
        { id: 'mock_4', title: '子节点 A1', content: 'A 的子节点', level: 'sub' },
        { id: 'mock_5', title: '子节点 B1', content: 'B 的子节点', level: 'sub' },
      ],
      edges: [
        { source: 'mock_1', target: 'mock_2', relationship: 'contains' },
        { source: 'mock_1', target: 'mock_3', relationship: 'contains' },
        { source: 'mock_2', target: 'mock_4', relationship: 'related' },
        { source: 'mock_3', target: 'mock_5', relationship: 'related' },
      ]
    });
  }

  try {
    const completion = await openai.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: `You are a knowledge graph expert. Analyze the provided text and extract key concepts to build a structured Knowledge Tree.

Requirements:
1. Identify ONE main Topic as the 'root' node.
2. Filter out irrelevant text, noise, or meta-commentary (e.g., "exam points", "irrelevant context", "ads", "author info"). Focus ONLY on the main subject matter.
3. Organize nodes into a strict 5-level hierarchy: 'root' -> 'core' -> 'sub' -> 'normal' -> 'leaf'.
   - 'root': The main topic (1 node).
   - 'core': Key categories or major concepts (direct children of root).
   - 'sub': Secondary concepts or branches (children of core).
   - 'normal': Detailed concepts or standard nodes (children of sub).
   - 'leaf': Specific examples, minor details, or data points (children of normal).
4. Output a TREE structure. Minimise cross-links to keep it clean. Ensure every node (except root) has a valid parent.
5. Return a JSON object with 'nodes' and 'edges' arrays.
   - Nodes: { "id": "temp_id", "title": "Title", "content": "Description", "level": "root|core|sub|normal|leaf" }
   - Edges: { "source": "parent_temp_id", "target": "child_temp_id", "relationship": "contains|related" }
6. IMPORTANT: Limit the output to a maximum of 50-100 nodes. Prioritize the most important concepts to fit within this limit.
   
Please respond in Chinese.` 
        },
        { role: "user", content: `Text: ${text.substring(0, 15000)}` } // Limit input to avoid context overflow
       ],
       model: model,
       response_format: { type: "json_object" },
       max_tokens: 8000,
     });

    const content = completion.choices[0].message.content;
    let parsed;
    try {
      parsed = JSON.parse(content || '{"nodes": [], "edges": []}');
    } catch (e) {
      console.error('JSON Parse Error (Truncated?):', content?.slice(-100));
      throw new AppError('AI 生成内容过长被截断，请尝试减少文本量或分段生成。', 422, ErrorCodes.INTERNAL_ERROR);
    }
    
    // Return parsed data for preview
    res.json(parsed);

  } catch (error: any) {
    console.error('AI Text-to-Graph Error:', error);
    throw new AppError(error.message || 'AI processing failed', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Chat with Graph
router.post('/chat', requireAuth, validate(chatSchema), async (req: AuthRequest, res: Response) => {
  const { message, graph_id, context_node_ids } = req.body;

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (!openai) {
    const mockContent = getMockResponse('chat', message) as string;
    const chunks = mockContent.split('');
    const sendMockChunks = async () => {
      for (const chunk of chunks) {
         res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
         await new Promise(resolve => setTimeout(resolve, 30)); 
      }
      res.write('data: [DONE]\n\n');
      res.end();
    };
    sendMockChunks();
    return;
  }

  try {
    // 1. Fetch Graph Context
    const { nodes } = await graphService.getGraphNodes(req.supabase!, req.user.id, graph_id);
    
    // 2. Filter/Prepare Context
    // If specific nodes are selected (context_node_ids), prioritise them.
    // Otherwise, use all nodes (summary).
    let contextText = "";
    const MAX_CONTEXT_LENGTH = 10000; // Characters

    if (context_node_ids && context_node_ids.length > 0) {
      const selectedNodes = nodes.filter((n: any) => context_node_ids.includes(n.id));
      contextText = selectedNodes.map((n: any) => `- ${n.title}: ${n.content || '(No content)'}`).join('\n');
    } else {
      // Use all nodes, but maybe just titles if too many
      if (nodes.length > 50) {
        contextText = nodes.map((n: any) => `- ${n.title}`).join('\n');
      } else {
        contextText = nodes.map((n: any) => `- ${n.title}: ${n.content || '(No content)'}`).join('\n');
      }
    }

    // Truncate if too long
    if (contextText.length > MAX_CONTEXT_LENGTH) {
      contextText = contextText.substring(0, MAX_CONTEXT_LENGTH) + "...(truncated)";
    }

    // 3. Call AI
    const stream = await openai.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: `You are an intelligent assistant for a Knowledge Graph. 
Answer the user's question based on the provided Graph Context.
If the answer is not in the context, use your general knowledge but mention that it's external info.
Respond in Chinese.` 
        },
        { role: "user", content: `Graph Context:\n${contextText}\n\nUser Question: ${message}` }
      ],
      model: model,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error: any) {
    console.error('AI Chat Error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'AI Chat failed', code: ErrorCodes.INTERNAL_ERROR })}\n\n`);
    res.end();
  }
});

export default router;
