import { SupabaseClient } from '@supabase/supabase-js';
import { TemplateEngine } from '../../utils/templateEngine';
import { getAIProviderForTask } from './factory';
import { logger } from '../../utils/logger';
import { getSupabaseAdmin } from '../../supabase';
import { GRAPH_NODES_SELECT } from '../../utils/nodeHelpers';
import { performanceMonitor, enrichMetadata } from './performanceMonitor';
import { pricingService } from './pricingService';
import { transactionExecutor } from '../../database/transactionExecutor';
import { notDeleted } from '../common/softDeleteHelper';

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
  // The result (text, updated node, or created children)
  data?: unknown;
}

interface AiActionNodeContext {
  id: string;
  graph_id: string;
  title: string;
  content: string;
  properties: Record<string, unknown>;
}

interface AiActionContext {
  nodeTitle: string;
  nodeContent: string;
  parents?: string;
  children?: string;
  siblings?: string;
}

interface AiActionSpawnChild {
  title: string;
  content?: string;
}

interface AiActionParsedResponse {
  content?: string;
  title?: string;
  tags?: unknown;
  children?: unknown;
}

interface KpUpdateData {
  content?: string;
  title?: string;
  properties?: Record<string, unknown>;
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

  async getGraphOwner(
    supabase: SupabaseClient,
    graphId: string,
  ): Promise<{ user_id: string } | null> {
    const { data, error } = await supabase
      .from("graphs")
      .select("user_id")
      .eq("id", graphId)
      .single();

    if (error || !data) return null;
    return data as { user_id: string };
  }

  async executeAction(
    actionId: string, 
    nodeId: string, 
    userId: string, 
    graphId: string
  ): Promise<AIActionExecutionResult> {
    logger.info(`Executing Action ${actionId} on Node ${nodeId}`);

    // 1. Fetch Action
    const action = await this.getAction(getSupabaseAdmin(), actionId); // Use admin to ensure we can read system actions
    if (!action) throw new Error('Action not found');

    // 2. Fetch Node Context
    const { data: graphNode, error: nodeError } = await notDeleted(getSupabaseAdmin()
      .from('graph_nodes')
      .select(GRAPH_NODES_SELECT)
      .eq('knowledge_point_id', nodeId)
      )
      .maybeSingle();
    
    if (nodeError || !graphNode) throw new Error('Node not found');

    const kp = Array.isArray(graphNode.knowledge_points) 
      ? graphNode.knowledge_points[0] 
      : graphNode.knowledge_points;
    
    const node: AiActionNodeContext = {
      id: kp?.id || graphNode.knowledge_point_id,
      graph_id: graphNode.graph_id,
      title: kp?.title || '',
      content: kp?.content || '',
      properties: (kp?.properties ?? {}) as Record<string, unknown>,
    };

    // 3. Prepare Context
    const context: AiActionContext = {
        nodeTitle: node.title,
        nodeContent: node.content || '',
    };

    // Handle variables to inject extra context
    if (action.variables) {
        // Parent Context
        if (action.variables.includeParent) {
            const { data: edges } = await notDeleted(getSupabaseAdmin()
                .from('edges')
                .select('source_knowledge_point_id')
                .eq('target_knowledge_point_id', nodeId)
                );

            if (edges && edges.length > 0) {
                const parentIds = edges.map((e: { source_knowledge_point_id: string }) => e.source_knowledge_point_id);
                const { data: parentGraphNodes } = await notDeleted(getSupabaseAdmin()
                    .from('graph_nodes')
                    .select(GRAPH_NODES_SELECT)
                    .in('knowledge_point_id', parentIds)
                    );

                if (parentGraphNodes && parentGraphNodes.length > 0) {
                    context.parents = (parentGraphNodes as Array<{ knowledge_points: unknown }>).map((pgn) => {
                      const kpArr = pgn.knowledge_points;
                      const k = Array.isArray(kpArr) ? kpArr[0] : kpArr;
                      const kTitle = (k as { title?: string } | null | undefined)?.title || '';
                      const kContent = (k as { content?: string } | null | undefined)?.content || '';
                      return `Title: ${kTitle}\nContent: ${kContent}`;
                    }).join('\n---\n');
                }
            }
        }

        // Children Context
        if (action.variables.includeChildren) {
             const { data: edges } = await notDeleted(getSupabaseAdmin()
                .from('edges')
                .select('target_knowledge_point_id')
                .eq('source_knowledge_point_id', nodeId)
                );

            if (edges && edges.length > 0) {
                const childIds = edges.map((e: { target_knowledge_point_id: string }) => e.target_knowledge_point_id);
                const { data: childGraphNodes } = await notDeleted(getSupabaseAdmin()
                    .from('graph_nodes')
                    .select(GRAPH_NODES_SELECT)
                    .in('knowledge_point_id', childIds)
                    );

                if (childGraphNodes && childGraphNodes.length > 0) {
                    context.children = (childGraphNodes as Array<{ knowledge_points: unknown }>).map((cgn) => {
                      const kpArr = cgn.knowledge_points;
                      const k = Array.isArray(kpArr) ? kpArr[0] : kpArr;
                      const kTitle = (k as { title?: string } | null | undefined)?.title || '';
                      const kContent = (k as { content?: string } | null | undefined)?.content || '';
                      return `Title: ${kTitle}\nContent: ${kContent}`;
                    }).join('\n---\n');
                }
            }
        }

        // Siblings Context
        if (action.variables.includeSiblings) {
            const { data: parentEdges } = await notDeleted(getSupabaseAdmin()
                .from('edges')
                .select('source_knowledge_point_id')
                .eq('target_knowledge_point_id', nodeId)
                );

            if (parentEdges && parentEdges.length > 0) {
                const parentIds = parentEdges.map((e: { source_knowledge_point_id: string }) => e.source_knowledge_point_id);

                const { data: siblingEdges } = await notDeleted(getSupabaseAdmin()
                    .from('edges')
                    .select('target_knowledge_point_id')
                    .in('source_knowledge_point_id', parentIds)
                    );

                if (siblingEdges && siblingEdges.length > 0) {
                    const siblingIds = [...new Set(
                        siblingEdges
                            .map((e: { target_knowledge_point_id: string }) => e.target_knowledge_point_id)
                            .filter((id: string) => id !== nodeId)
                    )];

                    if (siblingIds.length > 0) {
                        const { data: siblingGraphNodes } = await notDeleted(getSupabaseAdmin()
                            .from('graph_nodes')
                            .select(GRAPH_NODES_SELECT)
                            .in('knowledge_point_id', siblingIds)
                            )
                            .limit(10);

                        if (siblingGraphNodes && siblingGraphNodes.length > 0) {
                            context.siblings = (siblingGraphNodes as Array<{ knowledge_points: unknown }>).map((sgn) => {
                              const kpArr = sgn.knowledge_points;
                              const k = Array.isArray(kpArr) ? kpArr[0] : kpArr;
                              const kTitle = (k as { title?: string } | null | undefined)?.title || '';
                              const kContent = (k as { content?: string } | null | undefined)?.content || '';
                              return `Title: ${kTitle}\nContent: ${kContent}`;
                            }).join('\n---\n');
                        }
                    }
                }
            }
        }
    }

    // 4. Render Prompt
    let prompt = TemplateEngine.render(action.prompt_template, context as unknown as Record<string, unknown>);
    
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
        const enrichedMetadata = await enrichMetadata(getSupabaseAdmin(), {
          graphId,
          userId,
          nodeId,
          nodeTitle: node.title,
          actionName: action.name,
        });

        const startTime = Date.now();
        const completion = await provider.client.chat.completions.create({
            messages: [
                { role: 'system', content: 'You are a helpful knowledge graph assistant.' },
                { role: 'user', content: prompt }
            ],
            model: provider.model,
            response_format: action.target_mode !== 'show_result' ? { type: "json_object" } : undefined
        });
        const duration = Date.now() - startTime;

        const usage = completion.usage;
        if (usage) {
          const cost = pricingService.calculateCost(
            provider.providerType,
            provider.model,
            usage.prompt_tokens,
            usage.completion_tokens,
            0
          );
          await performanceMonitor.recordLog({
            operation: 'ai_action_execute',
            provider: provider.providerType,
            model: provider.model,
            inputTokens: usage.prompt_tokens,
            outputTokens: usage.completion_tokens,
            totalTokens: usage.prompt_tokens + usage.completion_tokens,
            cachedInputTokens: 0,
            duration,
            success: true,
            estimatedCost: cost,
            metadata: enrichedMetadata,
          });
        }

        const responseContent = completion.choices[0].message.content || '';
        
        // 7. Handle Result
        return await this.handleActionResponse(action, responseContent, nodeId, userId, graphId);

    } catch (e: unknown) {
        logger.error('AI Action Execution Failed', e);
        const errorMessage = e instanceof Error ? e.message : String(e);
        return { success: false, message: errorMessage };
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
    let parsed: unknown;
    try {
        // Simple cleanup for markdown code blocks
        const cleanJson = responseContent.replace(/```json\s*|\s*```/g, '').trim();
        parsed = JSON.parse(cleanJson);
    } catch (_e) {
        return { success: false, message: 'Failed to parse AI response as JSON' };
    }

    // Type guard: ensure parsed is a non-null object with expected fields
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { success: false, message: 'Invalid AI response format' };
    }
    const parsedObj = parsed as AiActionParsedResponse;

    if (action.target_mode === 'update_node') {
        const kpUpdates: KpUpdateData = {};
        if (typeof parsedObj.content === 'string' && parsedObj.content) {
            kpUpdates.content = parsedObj.content;
        }
        if (typeof parsedObj.title === 'string' && parsedObj.title) {
            kpUpdates.title = parsedObj.title;
        }

        if (Array.isArray(parsedObj.tags)) {
             const { data: kp } = await getSupabaseAdmin()
               .from('knowledge_points')
               .select('properties')
               .eq('id', nodeId)
               .single();
             const currentProps = (kp?.properties ?? {}) as Record<string, unknown>;
             kpUpdates.properties = { ...currentProps, tags: parsedObj.tags as string[] };
        }

        if (Object.keys(kpUpdates).length > 0) {
            await getSupabaseAdmin()
              .from('knowledge_points')
              .update(kpUpdates)
              .eq('id', nodeId);
            return { success: true, data: { updatedFields: Object.keys(kpUpdates) } };
        }
        return { success: true, message: 'No changes needed' };
    }

    if (action.target_mode === 'spawn_children') {
        const childrenRaw = parsedObj.children;
        if (Array.isArray(childrenRaw)) {
            const children = childrenRaw as AiActionSpawnChild[];

            if (children.length === 0) {
              return { success: true, data: { createdCount: 0 } };
            }

            const createdNodeIds: string[] = [];

            if (transactionExecutor.isAvailable()) {
              try {
                const createdKpIds = await transactionExecutor.executeInTransaction(async (client) => {
                  // 批量 INSERT knowledge_points
                  const kpValues: unknown[] = [];
                  const kpPlaceholders: string[] = [];
                  let paramIdx = 1;
                  for (const child of children) {
                    kpPlaceholders.push(`($${paramIdx++}, $${paramIdx++}, 'private', $${paramIdx++}, '{}')`);
                    kpValues.push(child.title, child.content || '', userId);
                  }
                  const kpResult = await client.query(
                    `INSERT INTO knowledge_points (title, content, visibility, owner_id, properties) VALUES ${kpPlaceholders.join(', ')} RETURNING id`,
                    kpValues,
                  );
                  const kpIds = kpResult.rows.map((r: { id: string }) => r.id);

                  // 批量 INSERT graph_nodes
                  const gnValues: unknown[] = [];
                  const gnPlaceholders: string[] = [];
                  paramIdx = 1;
                  for (const kpId of kpIds) {
                    gnPlaceholders.push(`($${paramIdx++}, $${paramIdx++}, 0, 0, 'normal', true)`);
                    gnValues.push(graphId, kpId);
                  }
                  await client.query(
                    `INSERT INTO graph_nodes (graph_id, knowledge_point_id, x_position, y_position, level, is_accepted) VALUES ${gnPlaceholders.join(', ')}`,
                    gnValues,
                  );

                  // 批量 INSERT edges
                  const edgeValues: unknown[] = [];
                  const edgePlaceholders: string[] = [];
                  paramIdx = 1;
                  for (const kpId of kpIds) {
                    edgePlaceholders.push(`($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, 'generated')`);
                    edgeValues.push(graphId, nodeId, kpId);
                  }
                  await client.query(
                    `INSERT INTO edges (graph_id, source_knowledge_point_id, target_knowledge_point_id, relationship_type) VALUES ${edgePlaceholders.join(', ')}`,
                    edgeValues,
                  );

                  return kpIds;
                });

                createdNodeIds.push(...createdKpIds);
                return { success: true, data: { createdCount: createdNodeIds.length } };
              } catch (txError) {
                logger.warn('spawn_children transaction failed, falling back to non-transactional creation:', txError);
                // 降级路径：批量创建
                await this.batchCreateChildren(children, userId, graphId, nodeId, createdNodeIds);
              }
            } else {
              // transactionExecutor 不可用，使用降级路径
              logger.warn('transactionExecutor not available, using non-transactional spawn_children');
              await this.batchCreateChildren(children, userId, graphId, nodeId, createdNodeIds);
            }

            return { success: true, data: { createdCount: createdNodeIds.length } };
        }
        return { success: false, message: 'No children to spawn' };
    }

    return { success: false, message: 'Unknown target mode or invalid response format' };
  }

  /**
   * 降级路径：通过 Supabase 客户端批量创建子节点
   * 依次批量插入 knowledge_points → graph_nodes → edges
   */
  private async batchCreateChildren(
    children: AiActionSpawnChild[],
    userId: string,
    graphId: string,
    nodeId: string,
    createdNodeIds: string[],
  ): Promise<void> {
    // 1. 批量 INSERT knowledge_points
    const kpRows = children.map(child => ({
      title: child.title,
      content: child.content || '',
      visibility: 'private' as const,
      owner_id: userId,
      properties: {},
    }));

    const { data: kpData, error: kpError } = await getSupabaseAdmin()
      .from('knowledge_points')
      .insert(kpRows)
      .select('id');

    if (kpError || !kpData || kpData.length === 0) {
      logger.error('Batch insert knowledge_points failed:', kpError);
      return;
    }

    const kpIds = kpData.map(kp => kp.id);

    // 2. 批量 INSERT graph_nodes
    const gnRows = kpIds.map(kpId => ({
      graph_id: graphId,
      knowledge_point_id: kpId,
      x_position: 0,
      y_position: 0,
      level: 'normal' as const,
      is_accepted: true,
    }));

    const { error: gnError } = await getSupabaseAdmin()
      .from('graph_nodes')
      .insert(gnRows);

    if (gnError) {
      logger.error('Batch insert graph_nodes failed, rolling back knowledge_points:', gnError);
      await getSupabaseAdmin()
        .from('knowledge_points')
        .delete()
        .in('id', kpIds);
      return;
    }

    // 3. 批量 INSERT edges
    const edgeRows = kpIds.map(kpId => ({
      graph_id: graphId,
      source_knowledge_point_id: nodeId,
      target_knowledge_point_id: kpId,
      relationship_type: 'generated' as const,
    }));

    const { error: edgeError } = await getSupabaseAdmin()
      .from('edges')
      .insert(edgeRows);

    if (edgeError) {
      logger.error('Batch insert edges failed, rolling back graph_nodes and knowledge_points:', edgeError);
      await getSupabaseAdmin()
        .from('edges')
        .delete()
        .eq('graph_id', graphId)
        .in('target_knowledge_point_id', kpIds);
      await getSupabaseAdmin()
        .from('graph_nodes')
        .delete()
        .eq('graph_id', graphId)
        .in('knowledge_point_id', kpIds);
      await getSupabaseAdmin()
        .from('knowledge_points')
        .delete()
        .in('id', kpIds);
      return;
    }

    // 所有插入成功后才记录到 createdNodeIds
    createdNodeIds.push(...kpIds);
  }
}

export const aiActionService = new AIActionService();
