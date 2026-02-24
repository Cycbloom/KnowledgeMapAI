
import { SupabaseClient } from '@supabase/supabase-js';
import { TemplateEngine } from '../utils/templateEngine.js';
import { getAIProviderForTask } from './ai/factory.js';
import { logger } from '../utils/logger.js';
import { supabaseAdmin } from '../supabase.js';
import { createKnowledgePointWithGraphNode, GRAPH_NODES_SELECT } from '../utils/nodeHelpers.js';

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

  async listActions(supabase: SupabaseClient, _userId: string, _graphId?: string): Promise<AIAction[]> {
    // Fetch System + User + Graph actions
    // Note: Supabase OR logic can be complex with RLS. 
    // Since we want to prioritize or merge, we can just fetch all accessible and filter/sort in app or let UI handle it.
    // Here we return all accessible actions.
    
    const query = supabase.from('ai_actions').select('*');
    
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
    const { data: graphNode, error: nodeError } = await supabaseAdmin
      .from('graph_nodes')
      .select(GRAPH_NODES_SELECT)
      .eq('knowledge_point_id', nodeId)
      .is('deleted_at', null)
      .maybeSingle();
    
    if (nodeError || !graphNode) throw new Error('Node not found');

    const kp = Array.isArray(graphNode.knowledge_points) 
      ? graphNode.knowledge_points[0] 
      : graphNode.knowledge_points;
    
    const node: any = {
      id: kp?.id || graphNode.knowledge_point_id,
      graph_id: graphNode.graph_id,
      title: kp?.title || '',
      content: kp?.content || '',
      properties: kp?.properties || {},
    };

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
                .select('source_knowledge_point_id')
                .eq('target_knowledge_point_id', nodeId)
                .is('deleted_at', null);
            
            if (edges && edges.length > 0) {
                const parentIds = edges.map(e => e.source_knowledge_point_id);
                const { data: parentGraphNodes } = await supabaseAdmin
                    .from('graph_nodes')
                    .select(GRAPH_NODES_SELECT)
                    .in('knowledge_point_id', parentIds)
                    .is('deleted_at', null);
                
                if (parentGraphNodes && parentGraphNodes.length > 0) {
                    context.parents = parentGraphNodes.map((pgn: any) => {
                      const k = Array.isArray(pgn.knowledge_points) ? pgn.knowledge_points[0] : pgn.knowledge_points;
                      return `Title: ${k?.title || ''}\nContent: ${k?.content || ''}`;
                    }).join('\n---\n');
                }
            }
        }

        // Children Context
        if (action.variables.includeChildren) {
             const { data: edges } = await supabaseAdmin
                .from('edges')
                .select('target_knowledge_point_id')
                .eq('source_knowledge_point_id', nodeId)
                .is('deleted_at', null);
            
            if (edges && edges.length > 0) {
                const childIds = edges.map(e => e.target_knowledge_point_id);
                const { data: childGraphNodes } = await supabaseAdmin
                    .from('graph_nodes')
                    .select(GRAPH_NODES_SELECT)
                    .in('knowledge_point_id', childIds)
                    .is('deleted_at', null);
                
                if (childGraphNodes && childGraphNodes.length > 0) {
                    context.children = childGraphNodes.map((cgn: any) => {
                      const k = Array.isArray(cgn.knowledge_points) ? cgn.knowledge_points[0] : cgn.knowledge_points;
                      return `Title: ${k?.title || ''}\nContent: ${k?.content || ''}`;
                    }).join('\n---\n');
                }
            }
        }

        // Siblings Context
        if (action.variables.includeSiblings) {
            const { data: parentEdges } = await supabaseAdmin
                .from('edges')
                .select('source_knowledge_point_id')
                .eq('target_knowledge_point_id', nodeId)
                .is('deleted_at', null);
            
            if (parentEdges && parentEdges.length > 0) {
                const parentIds = parentEdges.map(e => e.source_knowledge_point_id);
                
                const { data: siblingEdges } = await supabaseAdmin
                    .from('edges')
                    .select('target_knowledge_point_id')
                    .in('source_knowledge_point_id', parentIds)
                    .is('deleted_at', null);
                
                if (siblingEdges && siblingEdges.length > 0) {
                    const siblingIds = [...new Set(
                        siblingEdges
                            .map(e => e.target_knowledge_point_id)
                            .filter(id => id !== nodeId)
                    )];

                    if (siblingIds.length > 0) {
                        const { data: siblingGraphNodes } = await supabaseAdmin
                            .from('graph_nodes')
                            .select(GRAPH_NODES_SELECT)
                            .in('knowledge_point_id', siblingIds)
                            .is('deleted_at', null)
                            .limit(10);
                        
                        if (siblingGraphNodes && siblingGraphNodes.length > 0) {
                            context.siblings = siblingGraphNodes.map((sgn: any) => {
                              const k = Array.isArray(sgn.knowledge_points) ? sgn.knowledge_points[0] : sgn.knowledge_points;
                              return `Title: ${k?.title || ''}\nContent: ${k?.content || ''}`;
                            }).join('\n---\n');
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
        prompt += `\n\n${  schema}`;
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
        const kpUpdates: any = {};
        if (parsed.content) kpUpdates.content = parsed.content;
        if (parsed.title) kpUpdates.title = parsed.title;
        
        if (parsed.tags && Array.isArray(parsed.tags)) {
             const { data: kp } = await supabaseAdmin
               .from('knowledge_points')
               .select('properties')
               .eq('id', nodeId)
               .single();
             const currentProps = kp?.properties || {};
             kpUpdates.properties = { ...currentProps, tags: parsed.tags };
        }

        if (Object.keys(kpUpdates).length > 0) {
            await supabaseAdmin
              .from('knowledge_points')
              .update(kpUpdates)
              .eq('id', nodeId);
            return { success: true, data: { updatedFields: Object.keys(kpUpdates) } };
        }
        return { success: true, message: 'No changes needed' };
    }

    if (action.target_mode === 'spawn_children') {
        if (parsed.children && Array.isArray(parsed.children)) {
            const createdNodeIds: string[] = [];
            
            for (const child of parsed.children) {
              const result = await createKnowledgePointWithGraphNode(
                supabaseAdmin,
                userId,
                {
                  graph_id: graphId,
                  title: child.title,
                  content: child.content || '',
                  x_position: 0,
                  y_position: 0
                }
              );
              
              if (result) {
                createdNodeIds.push(result.id);
                
                await supabaseAdmin
                  .from('edges')
                  .insert({
                    graph_id: graphId,
                    source_knowledge_point_id: nodeId,
                    target_knowledge_point_id: result.id,
                    relationship_type: 'generated'
                  });
              }
            }

            return { success: true, data: { createdCount: createdNodeIds.length } };
        }
        return { success: false, message: 'No children to spawn' };
    }

    return { success: false, message: 'Unknown target mode or invalid response format' };
  }
}

export const aiActionService = new AIActionService();
