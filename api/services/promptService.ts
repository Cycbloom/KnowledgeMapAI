import { SupabaseClient } from '@supabase/supabase-js';
import { TemplateEngine } from '../utils/templateEngine.js';
import { cacheService, CacheKeys } from './cache.js';
import { logger } from '../utils/logger.js';

export type PromptScope = 'system' | 'user' | 'graph';

export interface PromptTemplate {
  id: string;
  code: string;
  scope: PromptScope;
  user_id?: string;
  graph_id?: string;
  template_content: string;
  created_at: string;
  updated_at: string;
}

const GENERATE_CARDS_SCHEMA = `
Return a JSON object with a 'cards' array. Each card object must have: 
- 'type' (qa|choice|true_false|multi_choice|fill_in_the_blank|essay)
- 'question'
- 'answer'
- 'explanation' (Detailed analysis/reasoning)
- 'options' (Array of 4 strings, ONLY for 'choice' and 'multi_choice' types)

Please respond in Chinese.`;

// Fixed output schemas (Hidden from user editing)
const OUTPUT_SCHEMAS: Record<string, string> = {
  expand_knowledge: `
Return a JSON object with a 'suggestions' array. Each object in the array must have 'title' and 'content' fields.
Example format: { "suggestions": [{ "title": "Example Title", "content": "Example content" }] }
Please respond in Chinese.`,

  auto_graph_init: `
Return a JSON object with the following structure:
{
  "root": {
    "title": "Root Node Title",
    "content": "Comprehensive overview of the topic (100-150 words)"
  },
  "coreNodes": [
    { "title": "Core Node 1", "content": "Description of core concept (80-120 words)", "level": "core" },
    { "title": "Core Node 2", "content": "Description of core concept (80-120 words)", "level": "core" }
  ]
}

Important:
- Generate exactly 1 root node and 3-5 core nodes
- Each node must have title and content
- Respond in Chinese`,

  auto_graph_expand: `
Return a JSON object with the following structure:
{
  "children": [
    { "title": "Child Node 1", "content": "Description (60-100 words)", "level": "sub|normal|leaf" },
    { "title": "Child Node 2", "content": "Description (60-100 words)", "level": "sub|normal|leaf" }
  ]
}

Important:
- Generate 3-5 child nodes
- level should be appropriate: sub (if parent is core), normal (if parent is sub), leaf (if parent is normal)
- Each node must have title and content
- Respond in Chinese`,

  learning_path_generate: `
Return a JSON object with the following structure:
{
  "path": [
    {
      "nodeId": "node-uuid-or-title",
      "nodeTitle": "Node Title",
      "priority": "high|medium|low",
      "reason": "Why this node should be learned at this position",
      "estimatedTime": 15,
      "prerequisites": ["prerequisite-node-id-1", "prerequisite-node-id-2"]
    }
  ],
  "suggestions": [
    "Suggestion 1 for the learner",
    "Suggestion 2 for the learner"
  ]
}

Important:
- Order nodes in optimal learning sequence
- nodeId can be the actual UUID or the exact title (will be matched)
- estimatedTime should be in minutes (5-60)
- priority determines learning importance
- prerequisites should reference nodeIds from earlier in the path
- Provide 2-4 helpful suggestions
- Respond in Chinese`,

  learning_path_questions: `
Return a JSON object with the following structure:
{
  "suggestedGoals": [
    "Goal 1: Clear, specific learning objective",
    "Goal 2: Another achievable goal",
    "Goal 3: Advanced mastery goal"
  ],
  "prerequisiteQuestions": [
    {
      "topic": "Knowledge area name",
      "description": "Brief description of what this includes",
      "options": ["不了解", "了解一点", "比较熟悉", "非常熟悉"]
    }
  ]
}

Important:
- Generate 3-4 suggested goals with different difficulty levels
- Generate 3-5 prerequisite questions relevant to the topic
- Goals should be specific and motivating
- Questions should identify knowledge that helps learn this topic
- Always use the exact 4 options: 不了解, 了解一点, 比较熟悉, 非常熟悉
- Respond in Chinese`,

  generate_cards: GENERATE_CARDS_SCHEMA,
  generate_cards_qa: GENERATE_CARDS_SCHEMA,
  generate_cards_choice: GENERATE_CARDS_SCHEMA,
  generate_cards_true_false: GENERATE_CARDS_SCHEMA,
  generate_cards_multi_choice: GENERATE_CARDS_SCHEMA,
  generate_cards_fill_blank: GENERATE_CARDS_SCHEMA,
  generate_cards_essay: GENERATE_CARDS_SCHEMA,


  branch_suggestions: `
Return a JSON object with a 'suggestions' array. Each object must have:
- 'id': Unique identifier for this suggestion
- 'title': Brief, catchy title for the branch (max 20 chars)
- 'description': Short description explaining what this branch explores (max 100 chars)
- 'priority': 'high', 'medium', or 'low' based on importance
- 'estimatedDifficulty': Number from 1-5 indicating difficulty
- 'relatedTopics': Array of 2-3 related topic keywords
Example format: { "suggestions": [{ "id": "branch_1", "title": "深入原理", "description": "探索核心原理", "priority": "high", "estimatedDifficulty": 4, "relatedTopics": ["theory", "fundamentals"] }] }
Please respond in Chinese.`,

  text_to_graph: `
Return a JSON object with 'nodes' and 'edges' arrays.
- Nodes: { "id": "temp_id", "title": "Title", "content": "Description (must contain definition or core content, 100-200 words)", "level": "root|core|sub|normal|leaf" }
- Edges: { "source": "parent_temp_id", "target": "child_temp_id", "relationship": "contains|related" }
Please respond in Chinese.`,

  document_to_graph: `
Return a JSON object with 'nodes' and 'edges' arrays.
- Nodes: { "id": "temp_id", "title": "Title", "content": "Description (must contain definition or core content, 100-200 words)", "level": "root|core|sub|normal|leaf" }
- Edges: { "source": "parent_temp_id", "target": "child_temp_id", "relationship": "contains|related" }
Please respond in Chinese.`,

  recommend_connections: `
Return a JSON object with a 'recommendations' array. Each item should have 'node_id', 'node_title', and 'reason'.
Respond in Chinese.`,

  term_annotation: `
Return a JSON array where each object has "term" (the exact text found in the source) and "explanation" (a concise definition under 20 words).
Example format: [{"term": "RAG", "explanation": "检索增强生成，一种结合检索系统和生成模型的技术。"}]
Please respond in Chinese.`,

  infinite_graph_expansion: `
Return a JSON object with the following structure:
{
  "prerequisite": [
    { "title": "领域名称", "description": "该领域的简要描述（说明包含什么内容）", "reason": "为什么是前置知识" }
  ],
  "extension": [
    { "title": "领域名称", "description": "该领域的简要描述（说明包含什么内容）", "reason": "为什么是扩展知识" }
  ],
  "related": [
    { "title": "领域名称", "description": "该领域的简要描述（说明包含什么内容）", "reason": "为什么是相关知识" }
  ]
}

Important:
- Each array can be empty if no suitable domains exist
- title should be a concise domain name (2-10 characters preferred)
- description should explain what the domain contains, NOT its relationship to the current domain
- reason should explain why this domain has this relationship type
- Respond in Chinese`
};

export class PromptService {
  
  /**
   * Get the final rendered prompt string
   * Includes priority logic (Graph > User > System) and Schema appending
   */
  async getRenderedPrompt(
    supabase: SupabaseClient, 
    code: string, 
    context: Record<string, any>, 
    userId?: string, 
    graphId?: string
  ): Promise<string> {
    const template = await this.getTemplate(supabase, code, userId, graphId);
    
    let content = '';
    
    if (!template) {
        logger.warn(`No template found for code: ${code}. Using empty fallback.`);
        content = '';
    } else {
        try {
            content = TemplateEngine.render(template.template_content, context);
        } catch (e) {
            logger.error(`Failed to render prompt ${code}`, e);
            content = template.template_content;
        }
    }

    // Append fixed schema if exists
    if (OUTPUT_SCHEMAS[code]) {
        content += `\n\n${  OUTPUT_SCHEMAS[code]}`;
    }
    
    return content;
  }

  /**
   * Get the raw template object based on priority
   */
  async getTemplate(
    supabase: SupabaseClient, 
    code: string, 
    userId?: string, 
    graphId?: string
  ): Promise<PromptTemplate | null> {
    const cacheKey = CacheKeys.PROMPT_TEMPLATE(code, userId || 'system', graphId || 'none');
    
    // Try cache first
    const cached = await cacheService.get<PromptTemplate>(cacheKey);
    if (cached) return cached;

    // Fetch all relevant templates for this code
    // We fetch system templates, user templates (if userId), and graph templates (if graphId)
    const query = supabase
      .from('prompt_templates')
      .select('*')
      .eq('code', code);
      
    // Construct OR filter manually or just fetch more and filter in memory (usually few templates per code)
    // Supabase OR with complex conditions can be tricky.
    // Let's use a simple approach: fetch all with this code.
    // CAUTION: This might return other users' templates if RLS is bypassed or not working.
    // But since we pass `supabase` client which (usually) has user context, RLS should apply.
    // If RLS applies, we only see: System + My User + My Graph.
    // If we use service role (admin), we see ALL.
    // So we MUST filter in memory to be safe if client is admin.
    
    const { data: templates, error } = await query;
    if (error) throw error;
    
    if (!templates || templates.length === 0) return null;
    
    // Filter relevant templates
    const relevant = templates.filter(t => {
        if (t.scope === 'system') return true;
        if (t.scope === 'user' && t.user_id === userId) return true;
        if (t.scope === 'graph' && t.graph_id === graphId) return true;
        return false;
    });

    // Sort by priority: Graph > User > System
    const getWeight = (t: PromptTemplate) => {
        if (t.scope === 'graph' && t.graph_id === graphId) return 3;
        if (t.scope === 'user' && t.user_id === userId) return 2;
        if (t.scope === 'system') return 1;
        return 0;
    };
    
    const sorted = relevant.sort((a, b) => getWeight(b) - getWeight(a));
    const bestMatch = sorted[0];

    // Cache the result (short TTL to allow quick updates, e.g. 60s)
    if (bestMatch) {
        await cacheService.set(cacheKey, bestMatch, 60);
    }
    
    return bestMatch || null;
  }

  // Management Methods
  
  async saveTemplate(supabase: SupabaseClient, template: Partial<PromptTemplate>) {
      const { data, error } = await supabase
        .from('prompt_templates')
        .upsert({
            ...template,
            updated_at: new Date().toISOString()
        }, { onConflict: 'code,scope,user_id,graph_id' })
        .select()
        .single();
        
      if (error) throw error;
      
      // Invalidate cache
      const userId = template.user_id || 'system';
      const graphId = template.graph_id || 'none';
      await cacheService.del(CacheKeys.PROMPT_TEMPLATE(template.code!, userId, graphId));
      
      return data;
  }
  
  async deleteTemplate(supabase: SupabaseClient, id: string) {
      // Get template first to know keys for cache invalidation
      const { data: temp } = await supabase.from('prompt_templates').select('*').eq('id', id).single();
      
      const { error } = await supabase.from('prompt_templates').delete().eq('id', id);
      if (error) throw error;
      
      if (temp) {
          const userId = temp.user_id || 'system';
          const graphId = temp.graph_id || 'none';
          await cacheService.del(CacheKeys.PROMPT_TEMPLATE(temp.code, userId, graphId));
      }
  }
  
  async resetToDefault(supabase: SupabaseClient, code: string, scope: PromptScope, userId?: string, graphId?: string) {
      // Delete the specific override
      let query = supabase.from('prompt_templates').delete().eq('code', code).eq('scope', scope);
      
      if (scope === 'user' && userId) query = query.eq('user_id', userId);
      if (scope === 'graph' && graphId) query = query.eq('graph_id', graphId);
      
      const { error } = await query;
      if (error) throw error;
      
      // Invalidate cache
      await cacheService.del(CacheKeys.PROMPT_TEMPLATE(code, userId || 'system', graphId || 'none'));
  }
}

export const promptService = new PromptService();
