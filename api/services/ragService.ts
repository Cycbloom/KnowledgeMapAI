import { supabaseAdmin } from '../supabase.js';
import { AIService } from './aiService.js';
import { getAIProviderForTask } from './ai/factory.js';
import { logger } from '../utils/logger.js';

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
        .from('nodes')
        .select('id, title, content, graph_id, embedding')
        .not('embedding', 'is', null)
        .is('deleted_at', null);

      if (graphId) {
        query_builder = query_builder.eq('graph_id', graphId);
      } else {
        const { data: userGraphs } = await supabaseAdmin
          .from('knowledge_graphs')
          .select('id')
          .eq('user_id', userId)
          .is('deleted_at', null);
        
        if (userGraphs && userGraphs.length > 0) {
          const graphIds = userGraphs.map(g => g.id);
          query_builder = query_builder.in('graph_id', graphIds);
        } else {
          return [];
        }
      }

      const { data: nodes, error } = await query_builder.limit(100);

      if (error || !nodes) {
        logger.error('Failed to fetch nodes for RAG search', { error });
        return [];
      }

      const results: RAGSearchResult[] = nodes
        .map(node => {
          const similarity = this.cosineSimilarity(queryEmbedding, node.embedding);
          return {
            id: node.id,
            title: node.title,
            content: node.content || '',
            similarity,
            graphId: node.graph_id
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
      const { data: currentNode } = await supabaseAdmin
        .from('nodes')
        .select('id, title, content')
        .eq('id', currentNodeId)
        .single();
      
      if (currentNode) {
        currentNodeContext = `\n[当前节点]\n标题: ${currentNode.title}\n内容: ${currentNode.content || '(无内容)'}\n`;
      }
    }

    const sourcesContext = searchResults
      .map((r, i) => `[${i + 1}] ${r.title}\n${r.content || '(无详细内容)'}`)
      .join('\n\n');

    let context = '';
    if (currentNodeContext) {
      context += `${currentNodeContext  }\n`;
    }
    if (sourcesContext) {
      context += `[相关知识节点]\n${  sourcesContext}`;
    }

    if (context.length > maxContextLength) {
      context = `${context.substring(0, maxContextLength)  }...(内容已截断)`;
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
    const { graphId, currentNodeId, history = [], provider, model } = options;

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
    const { graphId, currentNodeId, history = [], provider, model } = options;

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
    userId: string
  ): Promise<{
    gaps: Array<{ topic: string; reason: string; priority: 'high' | 'medium' | 'low' }>;
    suggestions: string[];
  }> {
    const { data: nodes } = await supabaseAdmin
      .from('nodes')
      .select('id, title, content, level')
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    if (!nodes || nodes.length === 0) {
      return { gaps: [], suggestions: [] };
    }

    const { data: edges } = await supabaseAdmin
      .from('edges')
      .select('source_node_id, target_node_id')
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const connectedNodes = new Set<string>();
    
    if (edges) {
      edges.forEach(e => {
        connectedNodes.add(e.source_node_id);
        connectedNodes.add(e.target_node_id);
      });
    }

    const isolatedNodes = nodes.filter(n => !connectedNodes.has(n.id));
    const nodesWithoutContent = nodes.filter(n => !n.content || n.content.length < 50);
    const leafNodes = nodes.filter(n => n.level === 'leaf');

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
