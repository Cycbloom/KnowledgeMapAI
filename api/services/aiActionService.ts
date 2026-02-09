
import { SupabaseClient } from '@supabase/supabase-js';
import { TemplateEngine } from '../utils/templateEngine.js';
import { getAIProviderForTask } from './ai/factory.js';
import { logger } from '../utils/logger.js';
import { supabaseAdmin } from '../supabase.js';

export interface AIActionVariables {
  includeParent?: boolean;
  includeSiblings?: boolean;
  includeChildren?: boolean;
}

export interface AIAction {
  id: string;
  name: string;
  description: string;
  icon: string;
  target_mode: 'show_result' | 'update_node' | 'spawn_children';
  scope: 'system' | 'user' | 'graph';
  user_id?: string;
  graph_id?: string;
  prompt_template: string;
  variables?: AIActionVariables;
}

export interface AIActionExecutionResult {
  success: boolean;
  message?: string;
  data?: any; // The result (text, updated node, or created children)
}

const ACTION_SCHEMAS: Record<string, string> = {
  update_node: `
Return a JSON object with the fields you want to update. 
Available fields: "content" (string), "title" (string), "tags" (array of strings).
Example: { "content": "Refined content...", "tags": ["Term1", "Term2"] }
Do not include fields you don't want to change.
Please respond in Chinese.`,

  spawn_children: `
Return a JSON object with a 'children' array.
Each child must have "title" (string) and "content" (string).
Example: { "children": [{ "title": "Subtopic 1", "content": "Description..." }] }
Please respond in Chinese.`,

  show_result: `
Please respond in Markdown format.
`
};

export class AIActionService {

  async listActions(supabase: SupabaseClient, userId: string, graphId?: string): Promise<AIAction[]> {
    // Fetch System + User + Graph actions
    // Note: Supabase OR logic can be complex with RLS. 
    // Since we want to prioritize or merge, we can just fetch all accessible and filter/sort in app or let UI handle it.
    // Here we return all accessible actions.
    
    let query = supabase.from('ai_actions').select('*');
    
    // If we rely on RLS, simple select is enough.
    // However, for explicit filtering:
    // query = query.or(`scope.eq.system,and(scope.eq.user,user_id.eq.${userId}),and(scope.eq.graph,graph_id.eq.${graphId})`);
    
    const { data, error } = await query;
    if (error) throw error;
    return data as AIAction[];
  }

  async getAction(supabase: SupabaseClient, id: string): Promise<AIAction | null> {
    const { data, error } = await supabase.from('ai_actions').select('*').eq('id', id).single();
    if (error) return null;
    return data as AIAction;
  }

  async createAction(supabase: SupabaseClient, action: Partial<AIAction>) {
    const { data, error } = await supabase.from('ai_actions').insert(action).select().single();
    if (error) throw error;
    return data;
  }

  async updateAction(supabase: SupabaseClient, id: string, updates: Partial<AIAction>) {
    const { data, error } = await supabase.from('ai_actions').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async deleteAction(supabase: SupabaseClient, id: string) {
    const { error } = await supabase.from('ai_actions').delete().eq('id', id);
    if (error) throw error;
  }

  async executeAction(
    actionId: string, 
    nodeId: string, 
    userId: string, 
    graphId: string
  ): Promise<AIActionExecutionResult> {
    logger.info(`Executing Action ${actionId} on Node ${nodeId}`);

    // 1. Fetch Action
    const action = await this.getAction(supabaseAdmin, actionId); // Use admin to ensure we can read system actions
    if (!action) throw new Error('Action not found');

    // 2. Fetch Node Context
    const { data: node, error: nodeError } = await supabaseAdmin
      .from('nodes')
      .select('*')
      .eq('id', nodeId)
      .single();
    
    if (nodeError || !node) throw new Error('Node not found');

    // 3. Prepare Context
    const context: any = {
        nodeTitle: node.title,
        nodeContent: node.content || '',
    };

    // Handle variables to inject extra context
    if (action.variables) {
        // Parent Context
        if (action.variables.includeParent) {
            const { data: edges } = await supabaseAdmin
                .from('edges')
                .select('source_node_id')
                .eq('target_node_id', nodeId);
            
            if (edges && edges.length > 0) {
                const parentIds = edges.map(e => e.source_node_id);
                const { data: parents } = await supabaseAdmin
                    .from('nodes')
                    .select('title, content')
                    .in('id', parentIds);
                
                if (parents && parents.length > 0) {
                    context.parents = parents.map(p => `Title: ${p.title}\nContent: ${p.content}`).join('\n---\n');
                }
            }
        }

        // Children Context
        if (action.variables.includeChildren) {
             const { data: edges } = await supabaseAdmin
                .from('edges')
                .select('target_node_id')
                .eq('source_node_id', nodeId);
            
            if (edges && edges.length > 0) {
                const childIds = edges.map(e => e.target_node_id);
                const { data: children } = await supabaseAdmin
                    .from('nodes')
                    .select('title, content')
                    .in('id', childIds);
                
                if (children && children.length > 0) {
                    context.children = children.map(c => `Title: ${c.title}\nContent: ${c.content}`).join('\n---\n');
                }
            }
        }

        // Siblings Context
        if (action.variables.includeSiblings) {
            // 1. Find parents
            const { data: parentEdges } = await supabaseAdmin
                .from('edges')
                .select('source_node_id')
                .eq('target_node_id', nodeId);
            
            if (parentEdges && parentEdges.length > 0) {
                const parentIds = parentEdges.map(e => e.source_node_id);
                
                // 2. Find children of parents (siblings)
                const { data: siblingEdges } = await supabaseAdmin
                    .from('edges')
                    .select('target_node_id')
                    .in('source_node_id', parentIds);
                
                if (siblingEdges && siblingEdges.length > 0) {
                    // Filter out current node and duplicates
                    const siblingIds = [...new Set(
                        siblingEdges
                            .map(e => e.target_node_id)
                            .filter(id => id !== nodeId)
                    )];

                    if (siblingIds.length > 0) {
                        const { data: siblings } = await supabaseAdmin
                            .from('nodes')
                            .select('title, content')
                            .in('id', siblingIds)
                            .limit(10); // Limit to 10 siblings to avoid context explosion
                        
                        if (siblings && siblings.length > 0) {
                            context.siblings = siblings.map(s => `Title: ${s.title}\nContent: ${s.content}`).join('\n---\n');
                        }
                    }
                }
            }
        }
    }

    // 4. Render Prompt
    let prompt = TemplateEngine.render(action.prompt_template, context);
    
    // 5. Append Schema/Instructions
    const schema = ACTION_SCHEMAS[action.target_mode];
    if (schema) {
        prompt += '\n\n' + schema;
    }

    // 6. Call AI
    const provider = await getAIProviderForTask('text'); // Use default text provider
    // Note: We might want to allow 'reasoning' model for complex actions, but 'text' is safe default.
    
    if (!provider.hasKey) {
        return { success: false, message: 'AI Provider not configured' };
    }

    try {
        const completion = await provider.client.chat.completions.create({
            messages: [
                { role: 'system', content: 'You are a helpful knowledge graph assistant.' },
                { role: 'user', content: prompt }
            ],
            model: provider.model,
            response_format: action.target_mode !== 'show_result' ? { type: "json_object" } : undefined
        });

        const responseContent = completion.choices[0].message.content || '';
        
        // 7. Handle Result
        return await this.handleActionResponse(action, responseContent, nodeId, userId, graphId);

    } catch (e: any) {
        logger.error('AI Action Execution Failed', e);
        return { success: false, message: e.message };
    }
  }

  private async handleActionResponse(
    action: AIAction, 
    responseContent: string, 
    nodeId: string,
    userId: string,
    graphId: string
  ): Promise<AIActionExecutionResult> {
    
    if (action.target_mode === 'show_result') {
        return { success: true, data: responseContent };
    }

    // For other modes, parse JSON
    let parsed: any;
    try {
        // Simple cleanup for markdown code blocks
        const cleanJson = responseContent.replace(/```json\s*|\s*```/g, '').trim();
        parsed = JSON.parse(cleanJson);
    } catch (e) {
        return { success: false, message: 'Failed to parse AI response as JSON' };
    }

    if (action.target_mode === 'update_node') {
        const updates: any = {};
        if (parsed.content) updates.content = parsed.content;
        if (parsed.title) updates.title = parsed.title;
        
        // Handle tags (merge into properties)
        if (parsed.tags && Array.isArray(parsed.tags)) {
             // We need to fetch current properties again or assume we have them?
             // Best to do a localized update or fetch-modify-save.
             const { data: node } = await supabaseAdmin.from('nodes').select('properties').eq('id', nodeId).single();
             const currentProps = node?.properties || {};
             updates.properties = { ...currentProps, tags: parsed.tags };
        }

        if (Object.keys(updates).length > 0) {
            await supabaseAdmin.from('nodes').update(updates).eq('id', nodeId);
            return { success: true, data: { updatedFields: Object.keys(updates) } };
        }
        return { success: true, message: 'No changes needed' };
    }

    if (action.target_mode === 'spawn_children') {
        if (parsed.children && Array.isArray(parsed.children)) {
            const newNodes = parsed.children.map((child: any) => ({
                graph_id: graphId,
                title: child.title,
                content: child.content,
                properties: {},
                x_position: 0, // Should calculate position, but let's default to 0 for now
                y_position: 0
            }));

            // Create nodes
            const { data: createdNodes, error } = await supabaseAdmin.from('nodes').insert(newNodes).select();
            if (error) throw error;

            // Create edges
            const edges = createdNodes.map((child: any) => ({
                source_node_id: nodeId,
                target_node_id: child.id,
                relationship_type: 'generated'
            }));

            await supabaseAdmin.from('edges').insert(edges);
            
            return { success: true, data: { createdCount: createdNodes.length } };
        }
    }

    return { success: false, message: 'Unknown target mode or invalid response format' };
  }
}

export const aiActionService = new AIActionService();
