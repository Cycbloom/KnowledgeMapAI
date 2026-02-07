import { Router, type Response } from 'express';
import OpenAI from 'openai';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import dotenv from 'dotenv';
import multer from 'multer';
import { validate } from '../middleware/validate.js';
import { 
  generateContentSchema, 
  generateLearningMaterialSchema,
  expandKnowledgeSchema, 
  generateCardsSchema, 
  generateCardsBatchSchema,
  textToGraphSchema, 
  chatSchema,
  recommendConnectionsSchema,
  documentToGraphSchema,
  branchSuggestionsSchema
} from '../schemas/index.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { AppError } from '../middleware/errorHandler.js';
import { CacheKeys, cacheService } from '../services/cache.js';
import { graphService } from '../services/graphService.js';
import { getMockResponse, aiService } from '../services/aiService.js';
import { getAIProviderForTask, getAIProvider } from '../services/ai/factory.js';
import { logger } from '../utils/logger.js';
import { scrapeUrl } from '../utils/scraper.js';
import { taskService } from '../services/taskService.js';

dotenv.config();

const router = Router();

// Multer setup for PDF uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.get('/status', requireAuth, async (req: AuthRequest, res: Response) => {
  const provider = await getAIProviderForTask('text');
  res.json({ 
    enabled: provider.hasKey, 
    provider: provider.providerType, 
    model: provider.model 
  });
});

router.post('/generate-content', requireAuth, validate(generateContentSchema), async (req: AuthRequest, res: Response) => {
  const { topic, context, provider: providerType, model } = req.body;
  const provider = providerType ? await getAIProvider(providerType) : await getAIProviderForTask('text');

  if (!provider.hasKey) {
    // @ts-ignore
    return res.json({ content: getMockResponse('content', topic) });
  }

  try {
    const completion = await provider.client.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "You are a helpful knowledge assistant. Generate detailed content for a knowledge graph node. " +
                   "IMPORTANT: All mathematical formulas must be wrapped in standard LaTeX delimiters. " +
                   "Use $...$ for inline formulas and $$...$$ for block formulas. " +
                   "Example: $E=mc^2$ or $$\\sum_{i=1}^n i = \\frac{n(n+1)}{2}$$. " +
                   "Please respond in Chinese." 
        },
        { role: "user", content: `Topic: ${topic}\nContext: ${context || 'General knowledge'}` }
      ],
      model: model || provider.model,
    });

    res.json({ content: completion.choices[0].message.content });
  } catch (error: any) {
    logger.error('AI Error:', error);
    res.status(500).json({ error: error.message || 'AI 生成失败' });
  }
});

router.post('/learning-material', requireAuth, validate(generateLearningMaterialSchema), async (req: AuthRequest, res: Response) => {
  const { topic, context, level, provider, model } = req.body;

  try {
    const content = await aiService.generateLearningMaterial(topic, context, { provider, model, level });
    res.json({ content });
  } catch (error: any) {
    logger.error('AI Learning Material Error:', error);
    res.status(500).json({ error: error.message || 'AI 生成学习内容失败' });
  }
});

router.post('/expand-knowledge', requireAuth, validate(expandKnowledgeSchema), async (req: AuthRequest, res: Response) => {
  const { node_title, node_content, node_level, existing_titles, current_children, expand_prompt, provider, model } = req.body;

  try {
    const result = await aiService.expandKnowledge(node_title, node_content, existing_titles || [], current_children || [], { provider, model, contextLevel: node_level, expandPrompt: expand_prompt });
    res.json(result);
  } catch (error: any) {
    logger.error('AI Expand Error:', error);
    res.status(500).json({ error: error.message || 'AI 扩展失败' });
  }
});

router.post('/branch-suggestions', requireAuth, validate(branchSuggestionsSchema), async (req: AuthRequest, res: Response) => {
  const { node_title, node_content, existing_nodes, child_nodes, context_level, provider, model } = req.body;

  try {
    const result = await aiService.getBranchSuggestions(node_title, node_content, existing_nodes || [], child_nodes || [], { provider, model, contextLevel: context_level });
    res.json(result);
  } catch (error: any) {
    logger.error('AI Branch Suggestions Error:', error);
    res.status(500).json({ error: error.message || 'AI 分支建议生成失败' });
  }
});

router.post('/generate-content-stream', requireAuth, validate(generateContentSchema), async (req: AuthRequest, res: Response) => {
  const { topic, context, level, provider: providerType, model } = req.body;
  const provider = providerType ? await getAIProvider(providerType) : await getAIProviderForTask('text');

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (!provider.hasKey) {
    // Mock Streaming
    // @ts-ignore
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
    let depthPrompt = "";
    if (level === 'root' || level === 'core') {
      depthPrompt = "Depth Requirement (High-Level): Provide a comprehensive OVERVIEW, core definitions, and high-level principles. Avoid excessive low-level details. Focus on the 'Why' and 'What'.";
    } else if (level === 'sub' || level === 'normal') {
      depthPrompt = "Depth Requirement (Mid-Level): Provide a balanced explanation covering key concepts, sub-components, and relationships. Bridge the gap between abstract theory and specific examples.";
    } else if (level === 'leaf') {
      depthPrompt = "Depth Requirement (Low-Level): Provide a HIGHLY DETAILED, specific, and concrete explanation. Include implementation details, code snippets (if applicable), edge cases, and practical nuances. Focus on the 'How'.";
    }

    const stream = await provider.client.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "You are a helpful knowledge assistant. Generate detailed content for a knowledge graph node. \n" +
                   `${depthPrompt}\n` +
                   "IMPORTANT: All mathematical formulas must be wrapped in standard LaTeX delimiters. " +
                   "Use $...$ for inline formulas and $$...$$ for block formulas. " +
                   "Example: $E=mc^2$ or $$\\sum_{i=1}^n i = \\frac{n(n+1)}{2}$$. " +
                   "Please respond in Chinese." 
        },
        { role: "user", content: `Topic: ${topic}\nContext: ${context || 'General knowledge'}` }
      ],
      model: provider.model,
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
    logger.error('AI Stream Error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'AI 生成失败', code: ErrorCodes.INTERNAL_ERROR })}\n\n`);
    res.end();
  }
});


router.post('/generate-cards', requireAuth, validate(generateCardsSchema), async (req: AuthRequest, res: Response) => {
  const { node_title, node_content, count, types, provider, model } = req.body;

  try {
    const aiResult = await aiService.generateCards(node_title, node_content, { count, types, provider, model });
    res.json({ cards: aiResult.cards || [] });
  } catch (error: any) {
    logger.error('AI Error:', error);
    throw new AppError(error.message || 'AI card generation failed', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.post('/batch-generate-cards', requireAuth, validate(generateCardsBatchSchema), async (req: AuthRequest, res: Response) => {
  const { node_ids, config } = req.body;

  try {
    const taskIds = [];
    const supabase = req.supabase!;

    // Fetch node details for titles (to name tasks)
    const { data: nodes } = await supabase
        .from('nodes')
        .select('id, title, content')
        .in('id', node_ids);

    if (nodes && nodes.length > 0) {
        for (const node of nodes) {
             const task = await taskService.createTask(
                 req.user.id, 
                 'generate_questions', 
                 { 
                     node_id: node.id, 
                     node_title: node.title, 
                     node_content: node.content,
                     config: config // Pass config (types, count) to individual task
                 }, 
                 `生成题目: ${node.title}`
             );
             taskIds.push(task.id);
        }
    }

    res.json({ success: true, taskIds: taskIds, message: `${taskIds.length} tasks started` });

  } catch (error: any) {
    logger.error('Batch Generation Error:', error);
    throw new AppError(error.message || 'Batch generation failed', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.get('/tasks/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  
  try {
    const { data: task, error } = await req.supabase!
      .from('tasks')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !task) {
        throw new AppError('Task not found', 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }
    
    // Check permission
    if (task.user_id !== req.user.id) {
        throw new AppError('Unauthorized', 403, ErrorCodes.FORBIDDEN);
    }

    res.json(task);

  } catch (error: any) {
     if (error instanceof AppError) throw error;
     throw new AppError('Failed to fetch task', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.post('/text-to-graph', requireAuth, validate(textToGraphSchema), async (req: AuthRequest, res: Response) => {
  const { text, graph_id, action = 'analyze', nodes, edges, provider: providerType, model } = req.body;

  // Handle Save Action (Batch Insert)
  if (action === 'save') {
    if (!graph_id) {
      throw new AppError('Graph ID is required for saving', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!nodes || !Array.isArray(nodes)) {
      throw new AppError('No nodes provided for saving', 400, ErrorCodes.VALIDATION_ERROR);
    }

    try {
      // 1. Prepare Nodes with UUIDs
      const nodeMap = new Map<string, string>(); // temp_id -> real_uuid
      
      const nodesToInsert = nodes
        .filter((node: any) => node.title && node.title.trim() !== "")
        .map((node: any) => {
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

      if (nodesToInsert.length === 0) {
        return res.json({ 
          success: true, 
          nodeCount: 0, 
          edgeCount: 0,
          message: 'No valid nodes found to save'
        });
      }

      // 1.5 Generate Embeddings
      try {
        await Promise.all(nodesToInsert.map(async (node: any) => {
           const text = node.content || node.title;
           if (text) {
             const embedding = await aiService.generateEmbedding(text);
             if (embedding) {
               node.embedding = embedding;
             }
           }
        }));
      } catch (e) {
        logger.error('Failed to generate embeddings for batch nodes:', e);
      }

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
          
        if (edgeError) logger.error('Edge insertion error:', edgeError);
      }

      // 5. Invalidate Cache
      cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graph_id));
      cacheService.del(CacheKeys.USER_GRAPHS(req.user.id));

      return res.json({ 
        success: true, 
        nodeCount: nodesToInsert.length, 
        edgeCount: edgesToInsert.length 
      });

    } catch (error: any) {
      logger.error('Save Graph Error:', error);
      throw new AppError(error.message || 'Failed to save graph', 500, ErrorCodes.INTERNAL_ERROR);
    }
  }

  // Handle Analyze Action (AI Generation)
  if (!text || text.length < 10) {
    throw new AppError('Text content must be at least 10 characters long', 400, ErrorCodes.VALIDATION_ERROR);
  }

  const provider = providerType ? await getAIProvider(providerType) : await getAIProviderForTask('text');

  if (!provider.hasKey) {
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
    const completion = await provider.client.chat.completions.create({
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
   - Nodes: { "id": "temp_id", "title": "Title", "content": "Description (must contain definition or core content, 100-200 words)", "level": "root|core|sub|normal|leaf" }
   - Edges: { "source": "parent_temp_id", "target": "child_temp_id", "relationship": "contains|related" }
6. **Content Richness**: Every node must have substantial 'content' description, not just a title.
7. IMPORTANT: All mathematical formulas in 'content' must be wrapped in standard LaTeX delimiters. Use $...$ for inline formulas and $$...$$ for block formulas.
8. Limit the output to a maximum of 50-100 nodes. Prioritize the most important concepts to fit within this limit.
   
Please respond in Chinese.` 
        },
        { role: "user", content: `Text: ${text.substring(0, 15000)}` } // Limit input to avoid context overflow
       ],
       model: model || provider.model,
       response_format: { type: "json_object" },
       max_tokens: 8000,
     });

    const content = completion.choices[0].message.content;
    let parsed;
    try {
      parsed = JSON.parse(content || '{"nodes": [], "edges": []}');
    } catch (e) {
      logger.error('JSON Parse Error (Truncated?):', { content: content?.slice(-100) });
      throw new AppError('AI 生成内容过长被截断，请尝试减少文本量或分段生成。', 422, ErrorCodes.INTERNAL_ERROR);
    }
    
    // Return parsed data for preview, ensure nodes have titles
    if (parsed.nodes) {
      parsed.nodes = parsed.nodes.filter((n: any) => n.title && n.title.trim() !== "");
    }
    res.json(parsed);

  } catch (error: any) {
    logger.error('AI Text-to-Graph Error:', error);
    throw new AppError(error.message || 'AI processing failed', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

// Chat with Graph
router.post('/chat', requireAuth, validate(chatSchema), async (req: AuthRequest, res: Response) => {
  const { message, graph_id, history = [], context_node_ids, provider: providerType, model } = req.body;
  const provider = providerType ? await getAIProvider(providerType) : await getAIProviderForTask('text');

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (!provider.hasKey) {
    // @ts-ignore
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
    const { nodes, edges } = await graphService.getGraphNodes(req.supabase!, req.user.id, graph_id);
    
    // 2. Prepare Context
    let contextText = "";
    const MAX_CONTEXT_LENGTH = 15000;

    if (context_node_ids && context_node_ids.length > 0) {
      const selectedNodes = nodes.filter((n: any) => context_node_ids.includes(n.id));
      
      // Node details
      const nodesText = selectedNodes.map((n: any) => `[Node] ${n.title}: ${n.content || '(No content)'}`).join('\n');
      
      // Internal edges (relationships between selected nodes)
      const relatedEdges = edges.filter((e: any) => 
        context_node_ids.includes(e.source_node_id) && context_node_ids.includes(e.target_node_id)
      );
      
      // Map IDs to Titles for better context
      const nodeTitleMap = new Map(nodes.map((n: any) => [n.id, n.title]));
      
      const edgesText = relatedEdges.map((e: any) => {
        const source = nodeTitleMap.get(e.source_node_id) || 'Unknown';
        const target = nodeTitleMap.get(e.target_node_id) || 'Unknown';
        return `[Edge] ${source} -> ${target} (${e.relationship || 'related'})`;
      }).join('\n');

      contextText = `Selected Nodes:\n${nodesText}\n\nRelationships:\n${edgesText}`;
    } else {
      // Use all nodes
      const nodeTitleMap = new Map(nodes.map((n: any) => [n.id, n.title]));
      
      if (nodes.length > 100) {
        // Too many nodes, just list titles
        const nodesText = nodes.map((n: any) => `- ${n.title}`).join('\n');
        contextText = `Graph Overview (Nodes Only):\n${nodesText}`;
      } else {
        const nodesText = nodes.map((n: any) => `[Node] ${n.title}: ${n.content || '(No content)'}`).join('\n');
        const edgesText = edges.map((e: any) => {
            const source = nodeTitleMap.get(e.source_node_id) || 'Unknown';
            const target = nodeTitleMap.get(e.target_node_id) || 'Unknown';
            return `[Edge] ${source} -> ${target} (${e.relationship || 'related'})`;
        }).join('\n');
        
        contextText = `All Nodes:\n${nodesText}\n\nAll Relationships:\n${edgesText}`;
      }
    }

    // Truncate if too long
    if (contextText.length > MAX_CONTEXT_LENGTH) {
      contextText = contextText.substring(0, MAX_CONTEXT_LENGTH) + "...(truncated)";
      logger.warn('Graph context truncated due to length', { graph_id, length: contextText.length });
    }

    // 3. Prepare Messages with History
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { 
        role: "system", 
        content: `You are an intelligent assistant for a Knowledge Graph. 
Answer the user's question based on the provided Graph Context.

Graph Context:
${contextText}

Instructions:
1. Use the [Node] content to answer questions about definitions or details.
2. Use the [Edge] relationships to explain connections, hierarchy, or flows.
3. If the answer is not in the context, use your general knowledge but mention that it's external info.
4. Respond in the same language as the user (default to Chinese).`
      },
      ...history.map((msg: any) => ({ role: msg.role, content: msg.content })),
      { role: "user", content: message }
    ];

    const stream = await provider.client.chat.completions.create({
      messages,
      model: model || provider.model,
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
    logger.error('AI Chat Error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'AI 对话失败', code: ErrorCodes.INTERNAL_ERROR })}\n\n`);
    res.end();
  }
});

// Smart Connection Recommendation
router.post('/recommend-connections', requireAuth, validate(recommendConnectionsSchema), async (req: AuthRequest, res: Response) => {
  const { graph_id, node_title, node_content } = req.body;
  const provider = await getAIProviderForTask('text');

  if (!provider.hasKey) {
    throw new AppError('AI provider not configured', 503, ErrorCodes.INTERNAL_ERROR);
  }

  try {
    // 1. Fetch Existing Nodes
    const { nodes } = await graphService.getGraphNodes(req.supabase!, req.user.id, graph_id);
    
    if (nodes.length === 0) return res.json({ recommendations: [] });

    // 2. Prepare existing nodes summary for AI
    const nodesSummary = nodes.map((n: any) => ({ id: n.id, title: n.title }));

    // 3. Ask AI for potential connections
    const completion = await provider.client.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: `You are a knowledge graph expert. Given a new node (title and content) and a list of existing nodes in a graph, suggest 1-3 most relevant existing nodes to connect to.
Return a JSON object with a 'recommendations' array. Each item should have 'node_id', 'node_title', and 'reason'.
Respond in Chinese.` 
        },
        { 
          role: "user", 
          content: `New Node:\nTitle: ${node_title}\nContent: ${node_content || ''}\n\nExisting Nodes:\n${JSON.stringify(nodesSummary)}` 
        }
      ],
      model: provider.model,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    const parsed = JSON.parse(content || '{"recommendations": []}');
    res.json(parsed);

  } catch (error: any) {
    logger.error('Recommendation Error:', error);
    res.status(500).json({ error: 'Failed to get recommendations' });
  }
});

// Document/PDF to Graph
router.post('/document-to-graph', requireAuth, upload.single('file'), async (req: AuthRequest, res: Response) => {
  const { graph_id, provider: providerOverride, model: modelOverride } = req.body;
  const file = req.file;
  const provider = await getAIProviderForTask('text', providerOverride, modelOverride);

  if (!file) {
    throw new AppError('No file uploaded', 400, ErrorCodes.VALIDATION_ERROR);
  }

  if (!provider.hasKey) {
    throw new AppError('AI provider not configured', 500, ErrorCodes.INTERNAL_ERROR);
  }

  try {
    let text = "";
    if (file.mimetype === 'application/pdf') {
      try {
        // Fix filename encoding
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        
        let data;
        if (typeof pdfParse === 'function') {
          data = await pdfParse(file.buffer);
        } else if (pdfParse.PDFParse) {
          const parser = new pdfParse.PDFParse({ data: file.buffer });
          const result = await parser.getText();
          data = { text: result.text, numpages: result.numpages || 0, info: result.info };
        } else {
          throw new Error('Unsupported pdf-parse version/structure');
        }
        
        text = data.text;
        const pdfTitle = data.info?.Title || originalName;

        logger.info('PDF Extraction Result', {
          fileName: originalName,
          titleHint: pdfTitle,
          pageCount: data.numpages,
          textLength: text?.length || 0,
          info: data.info
        });
        
        if (!text) {
          logger.warn('WARNING: Extracted text is empty or undefined!');
        }
      } catch (pdfErr: any) {
        logger.error('PDF Parse detailed error:', pdfErr);
        throw new AppError('PDF parsing failed: ' + pdfErr.message, 500, ErrorCodes.INTERNAL_ERROR);
      }
    } else {
      text = file.buffer.toString('utf-8');
      logger.info('Text/MD Extraction Result', {
        fileName: file.originalname,
        textLength: text.length
      });
    }

    if (!text || text.trim().length < 20) {
      logger.warn('Document extraction produced no or very little text.');
      throw new AppError('Document extraction failed: No readable text found', 400, ErrorCodes.VALIDATION_ERROR);
    }

    // Reuse text-to-graph logic but with extracted text
    logger.info(`Sending ${text.length} characters to AI for graph generation...`);
    const completion = await provider.client.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: `你是一个顶级的知识架构师，擅长从非结构化文档中还原原始的知识大纲和逻辑层级。
          
你的任务：
1. **识别层级线索**：深入分析文本中的标题编号（如：第一章、1.1、一、（一）、1.）、字体特征模拟（如全大写或独立行）以及逻辑递进关系。
2. **还原大纲结构**：将文档的目录结构映射到知识图谱的 5 层模型中：
   - 'root': 文档总标题或核心研究对象（仅 1 个）。
   - 'core': 一级标题/章（Chapter）。
   - 'sub': 二级标题/节（Section）。
   - 'normal': 三级标题/小节或核心概念点。
   - 'leaf': 具体细节、定义、例子或支撑数据。
3. **维护逻辑链条**：确保 edges 数组准确反映文档的父子包含关系。每个子节点必须指向其所属的直接上位标题 ID。
4. **清理噪音**：忽略页码、重复的页眉、无意义的符号和排版残留。

输出规范：
- 必须返回 JSON 对象，包含 'nodes' 和 'edges'。
- 节点格式：{ "id": "唯一临时ID", "title": "简洁的标题", "content": "详细的描述(必须包含该知识点的定义或核心内容，100-200字左右)", "level": "root|core|sub|normal|leaf" }
- 节点标题要保留其在文档中的核心术语。
- **内容丰满度**：每个节点必须有实质性的 'content' 描述，不能只有标题。
- 所有的标题和描述必须使用中文。
- 节点数量控制在 40-60 个左右，以保证图谱的完整性和可读性。` 
        },
        { role: "user", content: `文件名: ${file.originalname}\n文本内容:\n\n${text.substring(0, 15000)}` }
      ],
      model: provider.model,
      response_format: { type: "json_object" },
      max_tokens: 4000,
    });

    const content = completion.choices[0].message.content;
    logger.info('AI Response Content received');

    const parsed = JSON.parse(content || '{"nodes": [], "edges": []}');
    
    // Ensure nodes have titles before returning
    if (parsed.nodes) {
      parsed.nodes = parsed.nodes.filter((n: any) => n.title && n.title.trim() !== "");
    }

    logger.info(`Parsed ${parsed.nodes?.length || 0} nodes and ${parsed.edges?.length || 0} edges.`);
    
    res.json(parsed);

  } catch (error: any) {
    logger.error('Document-to-Graph Error:', error);
    res.status(500).json({ error: error.message || 'Document processing failed' });
  }
});

router.post('/image-to-graph', requireAuth, upload.single('file'), async (req: AuthRequest, res: Response) => {
  const { provider: providerOverride, model: modelOverride } = req.body;
  const file = req.file;

  if (!file) {
    throw new AppError('No image uploaded', 400, ErrorCodes.VALIDATION_ERROR);
  }

  try {
    // Convert to base64
    const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    
    // Call AI Service
    const result = await aiService.generateGraphFromImage(base64Image, { 
      provider: providerOverride, 
      model: modelOverride 
    });
    
    // Ensure nodes have titles before returning
    if (result.nodes) {
      result.nodes = result.nodes.filter((n: any) => n.title && n.title.trim() !== "");
    }

    res.json(result);

  } catch (error: any) {
    logger.error('Image-to-Graph Error:', error);
    res.status(500).json({ error: error.message || 'Image processing failed' });
  }
});

router.post('/url-to-text', requireAuth, async (req: AuthRequest, res: Response) => {
  const { url } = req.body;
  if (!url) {
    throw new AppError('URL is required', 400, ErrorCodes.VALIDATION_ERROR);
  }

  try {
    const result = await scrapeUrl(url);
    res.json(result);
  } catch (error: any) {
    logger.error('URL Scraping Error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch URL content' });
  }
});

export default router;
