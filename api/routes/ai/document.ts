import { Router, type Response } from 'express';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

import { requireAuth, type AuthRequest } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { textToGraphSchema, documentToGraphSchema, urlToTextSchema } from '../../schemas/index.js';
import { ErrorCodes } from '../../constants/errorCodes.js';
import { AppError } from '../../middleware/errorHandler.js';
import { CacheKeys, cacheService } from '../../services/cache.js';
import { aiService } from '../../services/aiService.js';
import { getAIProviderForTask, getAIProvider } from '../../services/ai/factory.js';
import { logger } from '../../utils/logger.js';
import { promptService } from '../../services/promptService.js';
import { supabaseAdmin } from '../../supabase.js';
import { scrapeUrl } from '../../utils/scraper.js';
import { upload } from './utils.js';

const router = Router();

router.post('/text-to-graph', requireAuth, validate(textToGraphSchema), async (req: AuthRequest, res: Response) => {
  const { text, graph_id, action = 'analyze', nodes, edges, provider: providerType, model } = req.body;

  if (action === 'save') {
    if (!graph_id) {
      throw new AppError('Graph ID is required for saving', 400, ErrorCodes.VALIDATION_ERROR);
    }

    if (!nodes || !Array.isArray(nodes)) {
      throw new AppError('No nodes provided for saving', 400, ErrorCodes.VALIDATION_ERROR);
    }

    try {
      const nodeMap = new Map<string, string>();
      
      const nodesToInsert = nodes
        .filter((node: { title?: string }) => node.title && node.title.trim() !== "")
        .map((node: { id?: string; title: string; content?: string; level?: string; properties?: Record<string, unknown> }) => {
          const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
          });
          
          if (node.id) nodeMap.set(node.id, uuid);
          
          return {
            id: uuid,
            graph_id,
            title: node.title,
            content: node.content || '',
            x_position: Math.round((Math.random() - 0.5) * 50),
            y_position: Math.round((Math.random() - 0.5) * 50),
            level: node.level || 'leaf',
            properties: { ...node.properties, source: 'ai-text-to-graph' }
          };
        });

      if (nodesToInsert.length === 0) {
        return res.json({ success: true, nodeCount: 0, edgeCount: 0, message: 'No valid nodes found to save' });
      }

      try {
        await Promise.all(nodesToInsert.map(async (node: { content?: string; title: string; embedding?: number[] }) => {
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

      const { error: nodeError } = await req.supabase!.from('nodes').insert(nodesToInsert);
      if (nodeError) throw new AppError(nodeError.message, 500, ErrorCodes.INTERNAL_ERROR);

      const edgesToInsert: { source_node_id: string; target_node_id: string; relationship_type: string; graph_id: string }[] = [];
      if (edges && Array.isArray(edges)) {
        edges.forEach((edge: { source: string; target: string; relationship?: string }) => {
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

      if (edgesToInsert.length > 0) {
        const { error: edgeError } = await req.supabase!.from('edges').insert(edgesToInsert);
        if (edgeError) logger.error('Edge insertion error:', edgeError);
      }

      cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graph_id));
      cacheService.del(CacheKeys.USER_GRAPHS(req.user.id));

      return res.json({ success: true, nodeCount: nodesToInsert.length, edgeCount: edgesToInsert.length });

    } catch (error: unknown) {
      const err = error as Error;
      logger.error('Save Graph Error:', error);
      throw new AppError(err.message || 'Failed to save graph', 500, ErrorCodes.INTERNAL_ERROR);
    }
  }

  if (!text || text.length < 10) {
    throw new AppError('Text content must be at least 10 characters long', 400, ErrorCodes.VALIDATION_ERROR);
  }

  const provider = providerType ? await getAIProvider(providerType) : await getAIProviderForTask('text');

  if (!provider.hasKey) {
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
    const systemPrompt = await promptService.getRenderedPrompt(supabaseAdmin, 'text_to_graph', {}, req.user.id, graph_id);

    const completion = await provider.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Text: ${text.substring(0, 15000)}` }
      ],
      model: model || provider.model,
      response_format: { type: "json_object" },
      max_tokens: 8000,
    });

    const content = completion.choices[0].message.content;
    let parsed;
    try {
      parsed = JSON.parse(content || '{"nodes": [], "edges": []}');
    } catch {
      throw new AppError('AI 生成内容过长被截断，请尝试减少文本量或分段生成。', 422, ErrorCodes.INTERNAL_ERROR);
    }
    
    if (parsed.nodes) {
      parsed.nodes = parsed.nodes.filter((n: { title?: string }) => n.title && n.title.trim() !== "");
    }
    res.json(parsed);

  } catch (error: unknown) {
    const err = error as Error;
    logger.error('AI Text-to-Graph Error:', error);
    throw new AppError(err.message || 'AI processing failed', 500, ErrorCodes.INTERNAL_ERROR);
  }
});

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
        
        logger.info('PDF Extraction Result', {
          fileName: originalName,
          pageCount: data.numpages,
          textLength: text?.length || 0,
        });
      } catch (pdfErr: unknown) {
        const err = pdfErr as Error;
        logger.error('PDF Parse detailed error:', pdfErr);
        throw new AppError(`PDF parsing failed: ${err.message}`, 500, ErrorCodes.INTERNAL_ERROR);
      }
    } else {
      text = file.buffer.toString('utf-8');
      logger.info('Text/MD Extraction Result', { fileName: file.originalname, textLength: text.length });
    }

    if (!text || text.trim().length < 20) {
      throw new AppError('Document extraction failed: No readable text found', 400, ErrorCodes.VALIDATION_ERROR);
    }

    logger.info(`Sending ${text.length} characters to AI for graph generation...`);
    
    const systemPrompt = await promptService.getRenderedPrompt(supabaseAdmin, 'document_to_graph', {}, req.user.id, graph_id);

    const completion = await provider.client.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `文件名: ${file.originalname}\n文本内容:\n\n${text.substring(0, 15000)}` }
      ],
      model: provider.model,
      response_format: { type: "json_object" },
      max_tokens: 4000,
    });

    const content = completion.choices[0].message.content;
    const parsed = JSON.parse(content || '{"nodes": [], "edges": []}');
    
    if (parsed.nodes) {
      parsed.nodes = parsed.nodes.filter((n: { title?: string }) => n.title && n.title.trim() !== "");
    }

    res.json(parsed);

  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Document-to-Graph Error:', error);
    res.status(500).json({ error: err.message || 'Document processing failed' });
  }
});

router.post('/image-to-graph', requireAuth, upload.single('file'), async (req: AuthRequest, res: Response) => {
  const { provider: providerOverride, model: modelOverride } = req.body;
  const file = req.file;

  if (!file) {
    throw new AppError('No image uploaded', 400, ErrorCodes.VALIDATION_ERROR);
  }

  try {
    const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    
    const result = await aiService.generateGraphFromImage(base64Image, { 
      provider: providerOverride, 
      model: modelOverride 
    });
    
    if (result.nodes) {
      result.nodes = result.nodes.filter((n: unknown) => {
        const node = n as { title?: string };
        return node.title && node.title.trim() !== "";
      });
    }

    res.json(result);

  } catch (error: unknown) {
    const err = error as Error;
    logger.error('Image-to-Graph Error:', error);
    res.status(500).json({ error: err.message || 'Image processing failed' });
  }
});

router.post('/url-to-text', requireAuth, validate(urlToTextSchema), async (req: AuthRequest, res: Response) => {
  const { url } = req.body;

  try {
    const result = await scrapeUrl(url);
    res.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('URL Scraping Error:', error);
    res.status(500).json({ error: err.message || 'Failed to fetch URL content' });
  }
});

export default router;
