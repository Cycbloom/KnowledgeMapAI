import { supabaseAdmin } from '../supabase.js';
import { AIService } from './aiService.js';
import { getAIProviderForTask } from './ai/factory.js';
import { logger } from '../utils/logger.js';
import { buildNodeContext, buildNodesContext, NodeData } from './ai/utils.js';

export interface RAGContext {
  graphId: string;
  userId: string;
  nodeId?: string;
  nodeTitle?: string;
  nodeContent?: string;
}

export interface RAGSearchResult {
  id: string;
  title: string;
  content: string;
  similarity: number;
  graphId: string;
}

export interface RAGResponse {
  answer: string;
  sources: RAGSearchResult[];
  suggestedQuestions?: string[];
}

export class RAGService {
  private aiService: AIService;

  constructor() {
    this.aiService = new AIService();
  }

  async semanticSearch(
    query: string,
    userId: string,
    options: {
      graphId?: string;
      matchThreshold?: number;
      matchCount?: number;
    } = {}
  ): Promise<RAGSearchResult[]> {
    const { graphId, matchThreshold = 0.5, matchCount = 5 } = options;

    const queryEmbedding = await this.aiService.generateEmbedding(query);
    if (!queryEmbedding) {
      logger.warn('Failed to generate query embedding for RAG search');
      return [];
    }

    try {
      let query_builder = supabaseAdmin
        .from('knowledge_points')
        .select('id, title, content, embedding')
        .not('embedding', 'is', null);

      if (graphId) {
        const { data: graphNodes } = await supabaseAdmin
          .from('graph_nodes')
          .select('knowledge_point_id')
          .eq('graph_id', graphId)
          .is('deleted_at', null);
        
        if (graphNodes && graphNodes.length > 0) {
          const kpIds = graphNodes.map(gn => gn.knowledge_point_id);
          query_builder = query_builder.in('id', kpIds);
        } else {
          return [];
        }
      } else {
        const { data: userGraphs } = await supabaseAdmin
          .from('knowledge_graphs')
          .select('id')
          .eq('user_id', userId)
          .is('deleted_at', null);
        
        if (userGraphs && userGraphs.length > 0) {
          const graphIds = userGraphs.map(g => g.id);
          const { data: graphNodes } = await supabaseAdmin
            .from('graph_nodes')
            .select('knowledge_point_id')
            .in('graph_id', graphIds)
            .is('deleted_at', null);
          
          if (graphNodes && graphNodes.length > 0) {
            const kpIds = graphNodes.map(gn => gn.knowledge_point_id);
            query_builder = query_builder.in('id', kpIds);
          } else {
            return [];
          }
        } else {
          return [];
        }
      }

      const { data: knowledgePoints, error } = await query_builder.limit(100);

      if (error || !knowledgePoints) {
        logger.error('Failed to fetch knowledge points for RAG search', { error });
        return [];
      }

      const results: RAGSearchResult[] = knowledgePoints
        .map(kp => {
          const similarity = this.cosineSimilarity(queryEmbedding, kp.embedding);
          return {
            id: kp.id,
            title: kp.title,
            content: kp.content || '',
            similarity,
            graphId: graphId || ''
          };
        })
        .filter(r => r.similarity >= matchThreshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, matchCount);

      return results;
    } catch (err) {
      logger.error('RAG semantic search error', { err });
      return [];
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async buildContext(
    query: string,
    userId: string,
    options: {
      graphId?: string;
      currentNodeId?: string;
      maxContextLength?: number;
    } = {}
  ): Promise<{ context: string; sources: RAGSearchResult[] }> {
    const { graphId, currentNodeId, maxContextLength = 8000 } = options;

    const searchResults = await this.semanticSearch(query, userId, {
      graphId,
      matchThreshold: 0.3,
      matchCount: 10
    });

    let currentNodeContext = '';
    if (currentNodeId) {
      const { data: currentGraphNode } = await supabaseAdmin
        .from('graph_nodes')
        .select(`
          knowledge_point_id,
          knowledge_points (
            id,
            title,
            content
          )
        `)
        .eq('knowledge_point_id', currentNodeId)
        .is('deleted_at', null)
        .single();
      
      if (currentGraphNode) {
        const kp = Array.isArray(currentGraphNode.knowledge_points) 
          ? currentGraphNode.knowledge_points[0] 
          : currentGraphNode.knowledge_points;
        const nodeData: NodeData = {
          title: kp?.title || '',
          content: kp?.content || ''
        };
        const nodeContext = buildNodeContext(nodeData, { maxContentLength: 1000 });
        currentNodeContext = `\n[当前节点]\n${nodeContext}\n`;
      }
    }

    const nodesData: NodeData[] = searchResults.map(r => ({
      title: r.title,
      content: r.content || ''
    }));
    const sourcesContext = buildNodesContext(nodesData, { maxContentLength: 500 });

    let context = '';
    if (currentNodeContext) {
      context += `${currentNodeContext}\n`;
    }
    if (sourcesContext) {
      context += `[相关知识节点]\n${sourcesContext}`;
    }

    if (context.length > maxContextLength) {
      context = `${context.substring(0, maxContextLength)}...(内容已截断)`;
    }

    return { context, sources: searchResults };
  }

  async chat(
    message: string,
    userId: string,
    options: {
      graphId?: string;
      currentNodeId?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      provider?: string;
      model?: string;
    } = {}
  ): Promise<RAGResponse> {
    const { graphId, currentNodeId, history = [], model } = options;

    const { context, sources } = await this.buildContext(message, userId, {
      graphId,
      currentNodeId
    });

    const aiProvider = await getAIProviderForTask('text');

    if (!aiProvider.hasKey) {
      return {
        answer: `[模拟回复] 我收到了你的问题: "${message}"。这是一个模拟回复，因为后端没有配置 API Key。`,
        sources: sources.slice(0, 3),
        suggestedQuestions: [
          '这个知识点的核心概念是什么？',
          '有哪些相关的知识点？',
          '如何应用这个知识？'
        ]
      };
    }

    const systemPrompt = `你是一个智能知识图谱助手，专门帮助用户理解和探索知识图谱中的内容。

你的能力：
1. 基于提供的知识上下文回答用户问题
2. 如果上下文中没有相关信息，可以基于你的知识回答，但要明确说明
3. 帮助用户发现知识之间的关联
4. 建议用户可能感兴趣的相关问题

回答规则：
1. 优先使用提供的知识上下文回答问题
2. 如果上下文不足以回答，可以补充你的知识，但要说明"根据我的知识..."
3. 使用清晰的 Markdown 格式组织回答
4. 如果涉及数学公式，使用 LaTeX 格式: $inline$ 或 $$block$$
5. 在回答末尾，可以建议 1-3 个相关的后续问题
6. 用中文回答

知识上下文：
${context || '(暂无相关上下文)'}`;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    try {
      const completion = await aiProvider.client.chat.completions.create({
        messages,
        model: model || aiProvider.model,
        temperature: 0.7,
        max_tokens: 2000
      });

      const answer = completion.choices[0].message.content || '';

      const suggestedQuestions = await this.generateSuggestedQuestions(
        message,
        answer,
        sources,
        aiProvider,
        model
      );

      return {
        answer,
        sources: sources.slice(0, 5),
        suggestedQuestions
      };
    } catch (error: any) {
      logger.error('RAG Chat Error:', error);
      throw new Error(error.message || 'RAG chat failed');
    }
  }

  private async generateSuggestedQuestions(
    originalQuestion: string,
    answer: string,
    sources: RAGSearchResult[],
    provider: any,
    model?: string
  ): Promise<string[]> {
    if (sources.length === 0) {
      return [
        '这个知识点的核心概念是什么？',
        '有哪些相关的知识点？',
        '如何应用这个知识？'
      ];
    }

    try {
      const sourceTitles = sources.slice(0, 3).map(s => s.title).join(', ');
      
      const completion = await provider.client.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `基于用户的原始问题和回答，生成 2-3 个相关的后续问题。
这些问题应该：
1. 帮助用户深入理解当前话题
2. 探索相关的知识节点
3. 具有启发性和探索性

返回 JSON 格式: { "questions": ["问题1", "问题2", "问题3"] }`
          },
          {
            role: 'user',
            content: `原始问题: ${originalQuestion}\n\n回答摘要: ${answer.substring(0, 500)}\n\n相关节点: ${sourceTitles}`
          }
        ],
        model: model || provider.model,
        response_format: { type: 'json_object' },
        max_tokens: 200
      });

      const content = completion.choices[0].message.content || '{"questions": []}';
      const parsed = JSON.parse(content);
      return parsed.questions || [];
    } catch {
      return [
        '这个知识点的核心概念是什么？',
        '有哪些相关的知识点？'
      ];
    }
  }

  async streamChat(
    message: string,
    userId: string,
    onChunk: (content: string) => void,
    options: {
      graphId?: string;
      currentNodeId?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      provider?: string;
      model?: string;
    } = {}
  ): Promise<RAGSearchResult[]> {
    const { graphId, currentNodeId, history = [], model } = options;

    const { context, sources } = await this.buildContext(message, userId, {
      graphId,
      currentNodeId
    });

    const aiProvider = await getAIProviderForTask('text');

    if (!aiProvider.hasKey) {
      const mockResponse = `[模拟回复] 我收到了你的问题: "${message}"。这是一个模拟回复，因为后端没有配置 API Key。`;
      for (const char of mockResponse) {
        onChunk(char);
        await new Promise(r => setTimeout(r, 20));
      }
      return sources.slice(0, 3);
    }

    const systemPrompt = `你是一个智能知识图谱助手，专门帮助用户理解和探索知识图谱中的内容。

你的能力：
1. 基于提供的知识上下文回答用户问题
2. 如果上下文中没有相关信息，可以基于你的知识回答，但要明确说明
3. 帮助用户发现知识之间的关联
4. 建议用户可能感兴趣的相关问题

回答规则：
1. 优先使用提供的知识上下文回答问题
2. 如果上下文不足以回答，可以补充你的知识，但要说明"根据我的知识..."
3. 使用清晰的 Markdown 格式组织回答
4. 如果涉及数学公式，使用 LaTeX 格式: $inline$ 或 $$block$$
5. 用中文回答

知识上下文：
${context || '(暂无相关上下文)'}`;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    try {
      const stream = await aiProvider.client.chat.completions.create({
        messages,
        model: model || aiProvider.model,
        temperature: 0.7,
        max_tokens: 2000,
        stream: true
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          onChunk(content);
        }
      }

      return sources.slice(0, 5);
    } catch (error: any) {
      logger.error('RAG Stream Chat Error:', error);
      throw new Error(error.message || 'RAG stream chat failed');
    }
  }

  async analyzeKnowledgeGaps(
    graphId: string,
    _userId: string
  ): Promise<{
    gaps: Array<{ topic: string; reason: string; priority: 'high' | 'medium' | 'low' }>;
    suggestions: string[];
  }> {
    const { data: graphNodes } = await supabaseAdmin
      .from('graph_nodes')
      .select(`
        knowledge_point_id,
        level,
        knowledge_points (
          id,
          title,
          content
        )
      `)
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    if (!graphNodes || graphNodes.length === 0) {
      return { gaps: [], suggestions: [] };
    }

    const nodes = graphNodes.map((gn: any) => {
      const kp = Array.isArray(gn.knowledge_points) ? gn.knowledge_points[0] : gn.knowledge_points;
      return {
        id: kp?.id || gn.knowledge_point_id,
        title: kp?.title || '',
        content: kp?.content || '',
        level: gn.level
      };
    });

    const { data: edges } = await supabaseAdmin
      .from('edges')
      .select('source_knowledge_point_id, target_knowledge_point_id')
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    const _nodeMap = new Map(nodes.map(n => [n.id, n]));
    const connectedNodes = new Set<string>();
    
    if (edges) {
      edges.forEach(e => {
        connectedNodes.add(e.source_knowledge_point_id);
        connectedNodes.add(e.target_knowledge_point_id);
      });
    }

    const isolatedNodes = nodes.filter(n => !connectedNodes.has(n.id));
    const nodesWithoutContent = nodes.filter(n => !n.content || n.content.length < 50);
    const _leafNodes = nodes.filter(n => n.level === 'leaf');

    const gaps: Array<{ topic: string; reason: string; priority: 'high' | 'medium' | 'low' }> = [];

    isolatedNodes.forEach(n => {
      gaps.push({
        topic: n.title,
        reason: '该节点没有与其他节点建立连接',
        priority: 'medium'
      });
    });

    nodesWithoutContent.forEach(n => {
      gaps.push({
        topic: n.title,
        reason: '该节点缺少详细内容描述',
        priority: 'high'
      });
    });

    const aiProvider = await getAIProviderForTask('text');
    let suggestions: string[] = [];

    if (aiProvider.hasKey && nodes.length > 3) {
      try {
        const nodeTitles = nodes.map(n => n.title).join(', ');
        
        const completion = await aiProvider.client.chat.completions.create({
          messages: [
            {
              role: 'system',
              content: `你是一个知识图谱分析专家。分析给定的知识节点列表，找出可能缺失的知识领域或概念。

返回 JSON 格式: { "suggestions": ["建议1", "建议2", "建议3"] }

每个建议应该是一个简短的知识领域或概念名称。`
            },
            {
              role: 'user',
              content: `当前知识图谱包含以下节点：\n${nodeTitles}\n\n请分析可能缺失的知识领域。`
            }
          ],
          model: aiProvider.model,
          response_format: { type: 'json_object' },
          max_tokens: 300
        });

        const content = completion.choices[0].message.content || '{"suggestions": []}';
        const parsed = JSON.parse(content);
        suggestions = parsed.suggestions || [];
      } catch (err) {
        logger.error('Failed to generate knowledge gap suggestions', { err });
      }
    }

    return { gaps, suggestions };
  }
}

export const ragService = new RAGService();
