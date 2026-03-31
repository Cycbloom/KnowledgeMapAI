import type { SupabaseClient } from '@supabase/supabase-js';
import type OpenAI from 'openai';
import { ToolRegistry } from './ToolRegistry';
import { SessionManager } from './SessionManager';
import type { AgentSession, CreateSessionOptions, ExecuteResult, ToolContext, SkillDefinition, AgentTool, StructuredAnalysisResult, GraphRecommendation } from './types';
import { getAIProviderForTask } from '../ai/factory';
import { logger } from '../../utils/logger';
import { graphTools } from './tools';

export class AgentService {
  private toolRegistry: ToolRegistry;
  private sessionManager: SessionManager;
  private supabase: SupabaseClient;
  
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
    this.toolRegistry = new ToolRegistry();
    this.sessionManager = SessionManager.getInstance();
    
    graphTools.forEach(tool => this.toolRegistry.register(tool));
  }
  
  registerTool(tool: AgentTool): void {
    this.toolRegistry.register(tool);
  }
  
  createSession(userId: string, options: CreateSessionOptions): AgentSession {
    return this.sessionManager.create(userId, {
      skillId: options.skillId,
      graphIds: options.graphIds,
    });
  }
  
  getSession(sessionId: string): AgentSession | undefined {
    return this.sessionManager.get(sessionId);
  }
  
  async executeSession(sessionId: string, userId: string, customPrompt?: string): Promise<ExecuteResult> {
    const session = this.sessionManager.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    this.sessionManager.update(sessionId, { status: 'running' });
    
    const context: ToolContext = {
      supabase: this.supabase,
      userId,
      graphIds: session.graphIds,
    };
    
    const skill = session.skillId ? SKILLS.find(s => s.id === session.skillId) : null;
    
    const systemPrompt = this.getSystemPrompt(skill);
    const userPrompt = customPrompt || this.getUserPrompt(skill, session.graphIds);
    
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
    
    this.sessionManager.addMessage(sessionId, { role: 'system', content: systemPrompt });
    this.sessionManager.addMessage(sessionId, { role: 'user', content: userPrompt });
    
    const aiProvider = await getAIProviderForTask('text');
    const tools = this.toolRegistry.getToolDefinitions();
    
    let maxIterations = 20;
    let finalResult = '';
    
    while (maxIterations-- > 0 && session.status === 'running') {
      try {
        const completion = await aiProvider.client.chat.completions.create({
          messages,
          model: aiProvider.model,
          tools: tools.length > 0 ? tools.map(t => ({
            type: 'function' as const,
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            },
          })) : undefined,
          tool_choice: tools.length > 0 ? 'auto' : undefined,
        });
        
        const response = completion.choices[0];
        
        if (response.message.tool_calls && response.message.tool_calls.length > 0) {
          messages.push({
            role: 'assistant',
            content: response.message.content || null,
            tool_calls: response.message.tool_calls,
          });
          
          for (const toolCall of response.message.tool_calls) {
            const toolName = toolCall.function.name;
            const args = JSON.parse(toolCall.function.arguments);
            
            this.sessionManager.addToolCall(sessionId, {
              toolName,
              args,
              status: 'running',
            });
            
            const result = await this.toolRegistry.execute(toolName, args, context);
            
            this.sessionManager.addMessage(sessionId, {
              role: 'tool',
              content: JSON.stringify(result),
              toolName,
              toolArgs: args,
              toolResult: result,
            });
            
            messages.push({
              role: 'tool',
              content: JSON.stringify(result),
              tool_call_id: toolCall.id,
            });
          }
        } else if (response.message.content) {
          finalResult = response.message.content;
          this.sessionManager.addMessage(sessionId, {
            role: 'assistant',
            content: response.message.content,
          });
          break;
        }
      } catch (error) {
        const err = error as Error;
        logger.error('Agent execution error:', error);
        this.sessionManager.update(sessionId, { status: 'failed' });
        throw new Error(`Agent execution failed: ${err.message}`);
      }
    }
    
    const structuredResult = this.parseStructuredResult(finalResult);
    
    this.sessionManager.update(sessionId, {
      status: 'completed',
      result: finalResult,
      structuredResult,
    });
    
    return { session: this.sessionManager.get(sessionId)! };
  }
  
  private parseStructuredResult(content: string): StructuredAnalysisResult | undefined {
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
          return {
            summary: parsed.summary || content,
            recommendations: parsed.recommendations.map((r: GraphRecommendation, index: number) => ({
              ...r,
              id: r.id || `rec-${index}`,
              confidence: r.confidence ?? 0.8,
            })),
          };
        }
      }
      
      const objectMatch = content.match(/\{[\s\S]*"recommendations"[\s\S]*\}/);
      if (objectMatch) {
        const parsed = JSON.parse(objectMatch[0]);
        if (parsed.recommendations && Array.isArray(parsed.recommendations)) {
          return {
            summary: parsed.summary || content,
            recommendations: parsed.recommendations.map((r: GraphRecommendation, index: number) => ({
              ...r,
              id: r.id || `rec-${index}`,
              confidence: r.confidence ?? 0.8,
            })),
          };
        }
      }
    } catch (e) {
      logger.warn('Failed to parse structured result:', e);
    }
    return undefined;
  }
  
  private getSystemPrompt(skill?: SkillDefinition | null): string {
    if (skill) {
      return skill.systemPrompt;
    }
    return `你是一个知识图谱分析助手。你可以使用提供的工具来分析用户的知识图谱。

请根据用户的请求，选择合适的工具获取信息，然后进行分析和回答。

重要规则：
1. 先使用工具获取必要的信息，不要假设或编造数据
2. 分析结果要基于实际获取的数据
3. 如果需要更多信息，可以多次调用工具
4. 最终给出清晰、有价值的分析报告

输出格式要求：
- 先用 Markdown 格式输出分析报告
- 如果有推荐的图谱关系，在报告末尾用 JSON 格式输出推荐列表
- JSON 格式如下：
\`\`\`json
{
  "summary": "分析摘要",
  "recommendations": [
    {
      "source_graph_id": "图谱ID",
      "source_graph_title": "图谱标题",
      "target_graph_id": "目标图谱ID",
      "target_graph_title": "目标图谱标题",
      "relation_type": "prerequisite|extension|related|cross_domain",
      "reason": "推荐理由",
      "confidence": 0.8
    }
  ]
}
\`\`\``;
  }
  
  private getUserPrompt(skill?: SkillDefinition | null, graphIds?: string[]): string {
    if (skill) {
      let prompt = skill.userPromptTemplate;
      if (graphIds && graphIds.length > 0) {
        prompt += `\n\n请重点关注以下图谱：${graphIds.join(', ')}`;
      }
      return prompt;
    }
    return '请分析我的知识图谱';
  }
}

export const SKILLS: SkillDefinition[] = [
  {
    id: 'island_detection',
    name: '知识孤岛检测',
    description: '发现没有关联的图谱',
    systemPrompt: `你是知识图谱分析专家，专门负责检测知识孤岛。

请分析用户的知识图谱，找出所有没有与其他图谱建立关联的孤立图谱。

输出格式要求：
1. 先用 Markdown 格式输出分析报告，包括：
   - 总体概述
   - 孤立图谱列表及建议
2. 如果有推荐的图谱关系，在报告末尾用 JSON 格式输出推荐列表：
\`\`\`json
{
  "summary": "分析摘要",
  "recommendations": [
    {
      "source_graph_id": "图谱ID",
      "source_graph_title": "图谱标题",
      "target_graph_id": "目标图谱ID",
      "target_graph_title": "目标图谱标题",
      "relation_type": "prerequisite|extension|related|cross_domain",
      "reason": "推荐理由",
      "confidence": 0.8
    }
  ]
}
\`\`\``,
    userPromptTemplate: '请分析我的知识图谱，找出所有的知识孤岛（没有关联的图谱），并推荐可能的关联',
    tools: ['get_graph_overview', 'get_graph_relations', 'get_isolated_graphs'],
  },
  {
    id: 'relation_recommendation',
    name: '关系推荐',
    description: '推荐潜在的图谱关系',
    systemPrompt: `你是知识关系发现专家。

请分析用户的知识图谱，发现潜在的图谱关系并给出推荐。

输出格式要求：
1. 先用 Markdown 格式输出分析报告，包括：
   - 现有关系概述
   - 推荐的新关系及理由
2. 在报告末尾用 JSON 格式输出推荐列表：
\`\`\`json
{
  "summary": "分析摘要",
  "recommendations": [
    {
      "source_graph_id": "图谱ID",
      "source_graph_title": "图谱标题",
      "target_graph_id": "目标图谱ID",
      "target_graph_title": "目标图谱标题",
      "relation_type": "prerequisite|extension|related|cross_domain",
      "reason": "推荐理由",
      "confidence": 0.8
    }
  ]
}
\`\`\``,
    userPromptTemplate: '请分析我的知识图谱，推荐潜在的图谱关系',
    tools: ['get_graph_details', 'get_graph_nodes', 'search_graphs', 'get_graph_overview', 'get_graph_relations'],
  },
  {
    id: 'learning_path',
    name: '学习路径规划',
    description: '规划最优学习顺序',
    systemPrompt: `你是学习路径规划专家。

请分析用户的知识图谱，规划最优的学习路径。

输出格式要求：
1. 用 Markdown 格式输出学习路径建议
2. 如果有推荐的图谱关系（如前置依赖），在报告末尾用 JSON 格式输出`,
    userPromptTemplate: '请分析我的知识图谱，规划最优的学习路径',
    tools: ['get_graph_overview', 'get_graph_relations'],
  },
  {
    id: 'cross_domain',
    name: '跨领域发现',
    description: '发现跨学科知识交叉',
    systemPrompt: `你是跨学科知识发现专家。

请分析用户的知识图谱，发现跨领域的知识交叉点。

输出格式要求：
1. 用 Markdown 格式输出跨领域分析
2. 如果有推荐的图谱关系，在报告末尾用 JSON 格式输出`,
    userPromptTemplate: '请分析我的知识图谱，发现跨领域的知识交叉点',
    tools: ['get_graph_details', 'search_graphs', 'get_graph_overview'],
  },
  {
    id: 'knowledge_gaps',
    name: '知识缺口分析',
    description: '识别知识体系空白',
    systemPrompt: `你是知识体系分析专家。

请分析用户的知识图谱，识别知识体系中的缺口。

输出格式要求：
1. 用 Markdown 格式输出知识缺口分析
2. 如果有推荐的图谱关系，在报告末尾用 JSON 格式输出`,
    userPromptTemplate: '请分析我的知识图谱，识别知识体系中的缺口',
    tools: ['get_graph_overview', 'get_graph_nodes'],
  },
];
