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
  branchSuggestionsSchema,
  tutorChatSchema,
  extractConceptsSchema,
  suggestNextTopicSchema,
  ttsSchema,
  ttsVoicesSchema
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

import { promptService } from '../services/promptService.js';
import { supabaseAdmin } from '../supabase.js';

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
  const { topic, context, provider: providerType, model, graph_id, level } = req.body;
  const provider = providerType ? await getAIProvider(providerType) : await getAIProviderForTask('text');

  if (!provider.hasKey) {
    // @ts-ignore
    return res.json({ content: getMockResponse('content', topic) });
  }

  try {
    // Prepare context for template
    const templateContext = {
      topic,
      context: context || 'General knowledge',
      isRoot: level === 'root' || level === 'core',
      isNormal: level === 'sub' || level === 'normal',
      isLeaf: level === 'leaf'
    };

    const systemPrompt = await promptService.getRenderedPrompt(
      supabaseAdmin,
      'generate_content',
      templateContext,
      req.user.id,
      graph_id
    );

    const completion = await provider.client.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: systemPrompt
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
  const { node_title, node_content, node_level, existing_titles, current_children, expand_prompt, provider, model, graph_id } = req.body;

  try {
    const result = await aiService.expandKnowledge(node_title, node_content, existing_titles || [], current_children || [], { 
      provider, 
      model, 
      contextLevel: node_level, 
      expandPrompt: expand_prompt,
      userId: req.user.id,
      graphId: graph_id // Ensure graph_id is passed from frontend
    });
    res.json(result);
  } catch (error: any) {
    logger.error('AI Expand Error:', error);
    res.status(500).json({ error: error.message || 'AI 扩展失败' });
  }
});

router.post('/branch-suggestions', requireAuth, validate(branchSuggestionsSchema), async (req: AuthRequest, res: Response) => {
  const { node_title, node_content, existing_nodes, child_nodes, context_level, provider, model, graph_id } = req.body;

  try {
    const result = await aiService.getBranchSuggestions(node_title, node_content, existing_nodes || [], child_nodes || [], { 
      provider, 
      model, 
      contextLevel: context_level,
      userId: req.user.id,
      graphId: graph_id
    });
    res.json(result);
  } catch (error: any) {
    logger.error('AI Branch Suggestions Error:', error);
    res.status(500).json({ error: error.message || 'AI 分支建议生成失败' });
  }
});

router.post('/generate-content-stream', requireAuth, validate(generateContentSchema), async (req: AuthRequest, res: Response) => {
  const { topic, context, level, provider: providerType, model, graph_id } = req.body;
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
    const templateContext = {
      topic,
      context: context || 'General knowledge',
      isRoot: level === 'root' || level === 'core',
      isNormal: level === 'sub' || level === 'normal',
      isLeaf: level === 'leaf'
    };

    const systemPrompt = await promptService.getRenderedPrompt(
      supabaseAdmin,
      'generate_content',
      templateContext,
      req.user.id,
      graph_id
    );

    const stream = await provider.client.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: systemPrompt
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
  const { node_title, node_content, count, types, provider, model, graph_id } = req.body;

  try {
    const aiResult = await aiService.generateCards(node_title, node_content, { 
      count, 
      types, 
      provider, 
      model,
      userId: req.user.id,
      graphId: graph_id
    });
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
    const systemPrompt = await promptService.getRenderedPrompt(
      supabaseAdmin,
      'text_to_graph',
      {},
      req.user.id,
      graph_id
    );

    const completion = await provider.client.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: systemPrompt
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

    const systemPrompt = await promptService.getRenderedPrompt(
      supabaseAdmin,
      'chat',
      { contextText },
      req.user.id,
      graph_id
    );

    // 3. Prepare Messages with History
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { 
        role: "system", 
        content: systemPrompt
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
    const systemPrompt = await promptService.getRenderedPrompt(
      supabaseAdmin,
      'recommend_connections',
      {},
      req.user.id,
      graph_id
    );

    const completion = await provider.client.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: systemPrompt 
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
    
    const systemPrompt = await promptService.getRenderedPrompt(
      supabaseAdmin,
      'document_to_graph',
      {},
      req.user.id,
      graph_id
    );

    const completion = await provider.client.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: systemPrompt
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

// Tutor Chat - AI assistant for guided learning
router.post('/tutor-chat', requireAuth, validate(tutorChatSchema), async (req: AuthRequest, res: Response) => {
  const { message, graph_id, history = [], context_node_ids, mode = 'free', provider: providerType, model } = req.body;
  const provider = providerType ? await getAIProvider(providerType) : await getAIProviderForTask('text');

  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (!provider.hasKey) {
    const mockContent = await aiService.tutorChat(
      [{ role: 'user', content: message }],
      { mode },
      { provider: providerType, model }
    );
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
    // Fetch context
    let context: any = { mode };
    
    if (graph_id) {
      const { nodes } = await graphService.getGraphNodes(req.supabase!, req.user.id, graph_id);
      context.graphId = graph_id;
      context.existingNodes = nodes.map((n: any) => n.title);
      
      // Get current node info if context_node_ids provided
      if (context_node_ids && context_node_ids.length > 0) {
        const currentNode = nodes.find((n: any) => n.id === context_node_ids[0]);
        if (currentNode) {
          context.currentNodeId = currentNode.id;
          context.currentNodeTitle = currentNode.title;
          context.currentNodeContent = currentNode.content;
        }
      }
    }

    // Prepare messages with history
    const messages: any[] = [
      ...history.map((msg: any) => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: message }
    ];

    const stream = await provider.client.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: `You are an intelligent knowledge tutor for a Knowledge Graph application.

${mode === 'guided' 
  ? "Guided Mode: Follow a structured learning path. Guide the user step-by-step through the knowledge graph. Ask questions to assess understanding before moving to the next topic."
  : "Free Mode: Allow open-ended discussion. Answer questions freely and explore topics based on user interest. Extract key concepts from the conversation that could be added to the knowledge graph."
}

Current Context:
${context.currentNodeId ? `\nCurrent Node:\n- Title: ${context.currentNodeTitle}\n- Content: ${context.currentNodeContent || '(No content)'}` : ''}
${context.existingNodes ? `\nExisting Nodes in Graph:\n${context.existingNodes.slice(0, 20).join(', ')}` : ''}

Instructions:
1. Be conversational and engaging
2. Use markdown formatting for better readability
3. When explaining concepts, provide examples
4. In free mode, identify key concepts that could be new nodes in the knowledge graph
5. In guided mode, follow the learning path and check understanding
6. Respond in the same language as the user (default to Chinese)
7. All mathematical formulas must be wrapped in LaTeX: $inline$ or $$block$$`
        },
        ...messages
      ],
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
    logger.error('AI Tutor Chat Error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'AI 助教对话失败', code: ErrorCodes.INTERNAL_ERROR })}\n\n`);
    res.end();
  }
});

// Extract Concepts from conversation
router.post('/extract-concepts', requireAuth, validate(extractConceptsSchema), async (req: AuthRequest, res: Response) => {
  const { text, existing_nodes, max_concepts, provider: providerType, model } = req.body;
  const provider = providerType ? await getAIProvider(providerType) : await getAIProviderForTask('text');

  if (!provider.hasKey) {
    const mockResult = await aiService.extractConcepts(text, existing_nodes, { provider: providerType, model, maxConcepts: max_concepts });
    return res.json(mockResult);
  }

  try {
    const result = await aiService.extractConcepts(text, existing_nodes, { provider: providerType, model, maxConcepts: max_concepts });
    res.json(result);
  } catch (error: any) {
    logger.error('AI Extract Concepts Error:', error);
    res.status(500).json({ error: error.message || 'AI 概念提取失败' });
  }
});

// Suggest Next Topic based on current node and user progress
router.post('/suggest-next-topic', requireAuth, validate(suggestNextTopicSchema), async (req: AuthRequest, res: Response) => {
  const { node_title, node_content, existing_nodes, user_progress, provider: providerType, model } = req.body;
  const provider = providerType ? await getAIProvider(providerType) : await getAIProviderForTask('text');

  if (!provider.hasKey) {
    const mockResult = await aiService.suggestNextTopic(node_title, node_content, existing_nodes, { provider: providerType, model, userProgress: user_progress });
    return res.json(mockResult);
  }

  try {
    const result = await aiService.suggestNextTopic(node_title, node_content, existing_nodes, { provider: providerType, model, userProgress: user_progress });
    res.json(result);
  } catch (error: any) {
    logger.error('AI Suggest Next Topic Error:', error);
    res.status(500).json({ error: error.message || 'AI 主题建议失败' });
  }
});

// TTS - Text to Speech using local Qwen3-TTS model
router.get('/tts/voices', requireAuth, validate(ttsVoicesSchema), async (req: AuthRequest, res: Response) => {
  try {
    const ttsServiceUrl = process.env.TTS_SERVICE_URL || 'http://localhost:8001';
    
    const response = await fetch(`${ttsServiceUrl}/voices`);
    
    if (!response.ok) {
      throw new AppError('Failed to fetch TTS voices', 503, ErrorCodes.INTERNAL_ERROR);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    logger.error('TTS Voices Error:', error);
    res.status(500).json({ error: error.message || '获取语音列表失败' });
  }
});

router.post('/tts', requireAuth, validate(ttsSchema), async (req: AuthRequest, res: Response) => {
  const { text, voice, speed, output_format } = req.body;
  
  try {
    const ttsServiceUrl = process.env.TTS_SERVICE_URL || 'http://localhost:8001';
    
    const response = await fetch(`${ttsServiceUrl}/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        voice: voice || 'default',
        speed: speed || 1.0,
        output_format: output_format || 'mp3'
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new AppError(`TTS synthesis failed: ${errorText}`, 500, ErrorCodes.INTERNAL_ERROR);
    }
    
    const audioBuffer = await response.arrayBuffer();
    
    const contentType = output_format === 'wav' ? 'audio/wav' : 'audio/mpeg';
    const filename = output_format === 'wav' ? 'speech.wav' : 'speech.mp3';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.setHeader('Content-Length', audioBuffer.byteLength);
    
    res.send(Buffer.from(audioBuffer));
  } catch (error: any) {
    logger.error('TTS Synthesis Error:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(error.message || '语音合成失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

router.get('/tts/health', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const ttsServiceUrl = process.env.TTS_SERVICE_URL || 'http://localhost:8001';
    
    const response = await fetch(`${ttsServiceUrl}/health`);
    
    if (!response.ok) {
      return res.json({ 
        status: 'unhealthy',
        model_loaded: false,
        model_name: 'unknown'
      });
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    logger.error('TTS Health Check Error:', error);
    res.json({ 
      status: 'unhealthy',
      model_loaded: false,
      model_name: 'unknown'
    });
  }
});

router.post('/annotate-terms', requireAuth, async (req: AuthRequest, res: Response) => {
  const { node_id, node_content, graph_id, provider: providerType, model } = req.body;

  if (!node_id || !node_content) {
     return res.status(400).json({ error: 'Node ID and Content are required' });
  }

  try {
    const newContent = await aiService.annotateTerms(node_content, {
      provider: providerType,
      model,
      userId: req.user.id,
      graphId: graph_id
    });

    if (newContent !== node_content) {
        const { error } = await req.supabase!
            .from('nodes')
            .update({ content: newContent })
            .eq('id', node_id);
        
        if (error) throw error;
    }

    res.json({ content: newContent });
  } catch (error: any) {
    logger.error('Annotate Terms Route Error:', error);
    res.status(500).json({ error: error.message || 'Failed to annotate terms' });
  }
});

export default router;
