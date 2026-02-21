import { Router, type Response } from 'express';
import OpenAI from 'openai';
import { requireAuth, type AuthRequest } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { 
  chatSchema,
  tutorChatSchema,
  extractConceptsSchema,
  suggestNextTopicSchema
} from '../../schemas/index.js';
import { ErrorCodes } from '../../constants/errorCodes.js';
import { AppError } from '../../middleware/errorHandler.js';
import { getMockResponse, aiService } from '../../services/aiService.js';
import { getAIProviderForTask, getAIProvider } from '../../services/ai/factory.js';
import { logger } from '../../utils/logger.js';
import { graphService } from '../../services/graphService.js';
import { promptService } from '../../services/promptService.js';
import { supabaseAdmin } from '../../supabase.js';
import { setSSEHeaders, sendStreamChunk, sendStreamDone, sendStreamError } from './utils.js';

const router = Router();

router.post('/chat', requireAuth, validate(chatSchema), async (req: AuthRequest, res: Response) => {
  const { message, graph_id, history = [], context_node_ids, provider: providerType, model } = req.body;
  const provider = providerType ? await getAIProvider(providerType) : await getAIProviderForTask('text');

  setSSEHeaders(res);

  if (!provider.hasKey) {
    const mockContent = getMockResponse('chat', message) as string;
    const chunks = mockContent.split('');
    const sendMockChunks = async () => {
      for (const chunk of chunks) {
        sendStreamChunk(res, chunk);
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      sendStreamDone(res);
    };
    sendMockChunks();
    return;
  }

  try {
    const { nodes, edges } = await graphService.getGraphNodes(req.supabase!, req.user.id, graph_id);
    
    let contextText = "";
    const MAX_CONTEXT_LENGTH = 15000;

    if (context_node_ids && context_node_ids.length > 0) {
      const selectedNodes = nodes.filter((n: { id: string }) => context_node_ids.includes(n.id));
      const nodesText = selectedNodes.map((n: { title: string; content?: string }) => `[Node] ${n.title}: ${n.content || '(No content)'}`).join('\n');
      
      const relatedEdges = edges.filter((e: { source_knowledge_point_id: string; target_knowledge_point_id: string }) => 
        context_node_ids.includes(e.source_knowledge_point_id) && context_node_ids.includes(e.target_knowledge_point_id)
      );
      
      const nodeTitleMap = new Map(nodes.map((n: { id: string; title: string }) => [n.id, n.title]));
      
      const edgesText = relatedEdges.map((e: { source_knowledge_point_id: string; target_knowledge_point_id: string; relationship?: string }) => {
        const source = nodeTitleMap.get(e.source_knowledge_point_id) || 'Unknown';
        const target = nodeTitleMap.get(e.target_knowledge_point_id) || 'Unknown';
        return `[Edge] ${source} -> ${target} (${e.relationship || 'related'})`;
      }).join('\n');

      contextText = `Selected Nodes:\n${nodesText}\n\nRelationships:\n${edgesText}`;
    } else {
      const nodeTitleMap = new Map(nodes.map((n: { id: string; title: string }) => [n.id, n.title]));
      
      if (nodes.length > 100) {
        const nodesText = nodes.map((n: { title: string }) => `- ${n.title}`).join('\n');
        contextText = `Graph Overview (Nodes Only):\n${nodesText}`;
      } else {
        const nodesText = nodes.map((n: { title: string; content?: string }) => `[Node] ${n.title}: ${n.content || '(No content)'}`).join('\n');
        const edgesText = edges.map((e: { source_knowledge_point_id: string; target_knowledge_point_id: string; relationship?: string }) => {
          const source = nodeTitleMap.get(e.source_knowledge_point_id) || 'Unknown';
          const target = nodeTitleMap.get(e.target_knowledge_point_id) || 'Unknown';
          return `[Edge] ${source} -> ${target} (${e.relationship || 'related'})`;
        }).join('\n');
        
        contextText = `All Nodes:\n${nodesText}\n\nAll Relationships:\n${edgesText}`;
      }
    }

    if (contextText.length > MAX_CONTEXT_LENGTH) {
      contextText = `${contextText.substring(0, MAX_CONTEXT_LENGTH)}...(truncated)`;
      logger.warn('Graph context truncated due to length', { graph_id, length: contextText.length });
    }

    const systemPrompt = await promptService.getRenderedPrompt(
      supabaseAdmin,
      'chat',
      { contextText },
      req.user.id,
      graph_id
    );

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...history.map((msg: { role: string; content: string }) => ({ role: msg.role, content: msg.content })),
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
        sendStreamChunk(res, content);
      }
    }
    sendStreamDone(res);

  } catch (error: unknown) {
    const err = error as Error;
    logger.error('AI Chat Error:', error);
    sendStreamError(res, err.message || 'AI 对话失败', ErrorCodes.INTERNAL_ERROR);
  }
});

router.post('/tutor-chat', requireAuth, validate(tutorChatSchema), async (req: AuthRequest, res: Response) => {
  const { message, graph_id, history = [], context_node_ids, mode = 'free', provider: providerType, model } = req.body;
  const provider = providerType ? await getAIProvider(providerType) : await getAIProviderForTask('text');

  setSSEHeaders(res);

  if (!provider.hasKey) {
    const mockContent = await aiService.tutorChat(
      [{ role: 'user', content: message }],
      { mode },
      { provider: providerType, model }
    );
    const chunks = mockContent.split('');
    const sendMockChunks = async () => {
      for (const chunk of chunks) {
        sendStreamChunk(res, chunk);
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      sendStreamDone(res);
    };
    sendMockChunks();
    return;
  }

  try {
    const context: { mode: string; graphId?: string; existingNodes?: string[]; currentNodeId?: string; currentNodeTitle?: string; currentNodeContent?: string } = { mode };
    
    if (graph_id) {
      const { nodes } = await graphService.getGraphNodes(req.supabase!, req.user.id, graph_id);
      context.graphId = graph_id;
      context.existingNodes = nodes.map((n: { title: string }) => n.title);
      
      if (context_node_ids && context_node_ids.length > 0) {
        const currentNode = nodes.find((n: { id: string }) => n.id === context_node_ids[0]);
        if (currentNode) {
          context.currentNodeId = currentNode.id;
          context.currentNodeTitle = currentNode.title;
          context.currentNodeContent = currentNode.content;
        }
      }
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      ...history.map((msg: { role: 'user' | 'assistant' | 'system'; content: string }) => ({ role: msg.role, content: msg.content })),
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
        sendStreamChunk(res, content);
      }
    }
    sendStreamDone(res);

  } catch (error: unknown) {
    const err = error as Error;
    logger.error('AI Tutor Chat Error:', error);
    sendStreamError(res, err.message || 'AI 助教对话失败', ErrorCodes.INTERNAL_ERROR);
  }
});

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
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('AI Extract Concepts Error:', error);
    res.status(500).json({ error: err.message || 'AI 概念提取失败' });
  }
});

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
  } catch (error: unknown) {
    const err = error as Error;
    logger.error('AI Suggest Next Topic Error:', error);
    res.status(500).json({ error: err.message || 'AI 主题建议失败' });
  }
});

export default router;
