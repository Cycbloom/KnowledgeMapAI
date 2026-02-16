
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { aiService } from './aiService.js';
import { getAIProviderForTask } from './ai/factory.js';
import { taskQueue } from './queue.js';
import { sseService } from './sseService.js';
import { logger } from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

export interface Task {
  id: string;
  user_id: string;
  type: string;
  name?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  payload: any;
  result?: any;
  error?: string;
  created_at: string;
  updated_at: string;
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

// Default client for internal background tasks
const defaultClient = createClient(supabaseUrl!, supabaseServiceKey || supabaseKey!);

export class TaskService {
  
  async createTask(userId: string, type: string, payload?: any, name?: string) {
    const supabase = defaultClient;

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: userId,
        type: type,
        name: name,
        status: 'pending',
        payload: payload || {}
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create task: ${error.message}`);
    
    // Add to BullMQ Queue
    await taskQueue.add(type, { taskId: data.id });
    
    return data as Task;
  }

  async updateTaskStatus(client: SupabaseClient | string, taskId: string, status: string, result?: any, errorMsg?: string, userId?: string) {
    let supabase = defaultClient;
    let tid = taskId;
    let s = status;
    let r = result;
    let e = errorMsg;
    let uid = userId;

    // Handle overload
    if (typeof client !== 'string' && client !== undefined) {
        supabase = client;
    } else {
        // Shift arguments if client is missing (taskId was passed as first arg)
        uid = e; // errorMsg -> userId
        e = r;   // result -> errorMsg
        r = s;   // status -> result
        s = tid; // taskId -> status
        tid = client as string; // client -> taskId
    }

    const updateData: any = { status: s, updated_at: new Date().toISOString() };
    if (r !== undefined) updateData.result = r;
    if (e !== undefined) updateData.error = e;

    const { error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', tid);
      
    if (error) throw error;

    // Broadcast update via SSE if userId is provided
    if (uid) {
        sseService.sendToUser(uid, {
            type: 'task_update',
            taskId: tid,
            status: s,
            result: r,
            error: e
        });
    }
  }

  async getTasks(client: SupabaseClient, userId: string, status?: string, limit: number = 20, offset: number = 0) {
    let query = client
      .from('tasks')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;
    if (error) throw new Error(`Failed to fetch tasks: ${error.message}`);
    return { tasks: data as Task[], total: count || 0 };
  }

  async getPendingTasks(client: SupabaseClient) {
    const { data, error } = await client
      .from('tasks')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10); // Batch size

    if (error) throw error;
    return data as Task[];
  }

  async retryTask(client: SupabaseClient, taskId: string, userId: string) {
    const { data: task, error: fetchError } = await client
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !task) throw new Error('Task not found');

    const { data, error } = await client
      .from('tasks')
      .update({ status: 'pending', error: null, result: null, updated_at: new Date().toISOString() })
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw new Error(`Failed to retry task: ${error.message}`);
    
    // Re-add to BullMQ Queue
    await taskQueue.add(data.type, { taskId: data.id });
    
    return data as Task;
  }

  async deleteTask(client: SupabaseClient, taskId: string, userId: string) {
    const { error } = await client
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('user_id', userId);

    if (error) throw new Error(`Failed to delete task: ${error.message}`);
  }

  // The actual background worker logic for batch generation
  // This can be called directly (fire-and-forget) or via a worker
  async processBatchGenerateCards(taskId: string, userId: string, payload: any) {
    const supabase = defaultClient;
    try {
      await this.updateTaskStatus(supabase, taskId, 'processing', undefined, undefined, userId);
      
      const { node_ids, config } = payload;
      const { types = ['qa', 'choice', 'true_false'], count = 3 } = config || {};

      // 1. Fetch nodes
      const { data: nodes, error: nodesError } = await supabase
        .from('nodes')
        .select('id, title, content, level, graph_id')
        .in('id', node_ids);

      if (nodesError || !nodes) throw new Error('Failed to fetch nodes');

      // 2. Fetch context (parents)
      const { data: edges } = await supabase
        .from('edges')
        .select('source_node_id, target_node_id')
        .in('target_node_id', node_ids);
      
      const parentMap = new Map<string, string>();
      if (edges) {
        edges.forEach((e: any) => parentMap.set(e.target_node_id, e.source_node_id));
      }

      const parentIds = Array.from(parentMap.values());
      const parentNodesMap = new Map<string, any>();
      
      if (parentIds.length > 0) {
        const { data: parents } = await supabase
          .from('nodes')
          .select('id, title, content')
          .in('id', parentIds);
        
        if (parents) {
          parents.forEach((p: any) => parentNodesMap.set(p.id, p));
        }
      }

      // 3. Sort Top-Down
      const levelOrder: Record<string, number> = { 'root': 0, 'core': 1, 'sub': 2, 'normal': 3, 'leaf': 4 };
      const sortedNodes = [...nodes].sort((a, b) => {
        const la = levelOrder[a.level || 'leaf'] ?? 4;
        const lb = levelOrder[b.level || 'leaf'] ?? 4;
        return la - lb;
      });

      const results = [];
      let totalCards = 0;
      let processedCount = 0;

      // 4. Process Loop
      for (const node of sortedNodes) {
        const parentId = parentMap.get(node.id);
        const parentNode = parentId ? parentNodesMap.get(parentId) : null;
        const context = parentNode ? `Parent Node: "${parentNode.title}"` : 'Root Node';

        // Handle Pack Templates
        let finalTypes = types;
        let finalCount = count;

        if (config?.pack_template) {
            switch (config.pack_template) {
            case 'standard':
                finalTypes = ['choice', 'multi_choice', 'fill_in_the_blank', 'essay'];
                finalCount = 10;
                break;
            case 'exam':
                finalTypes = ['choice', 'multi_choice', 'essay'];
                finalCount = 15;
                break;
            case 'quick':
                finalTypes = ['qa', 'choice', 'true_false'];
                finalCount = 3;
                break;
            }
        }

        try {
          const aiResult = await aiService.generateCards(node.title, node.content, {
            context,
            types: finalTypes,
            count: finalCount,
            pack_type: config?.pack_template,
            provider: config?.provider,
            model: config?.model
          });

          const cards = aiResult.cards;

          if (cards.length > 0) {
            const cardsToInsert = cards.map((card: any) => ({
              user_id: userId,
              node_id: node.id,
              graph_id: node.graph_id,
              question: card.question,
              answer: card.answer,
              explanation: card.explanation,
              card_type: card.type || 'qa',
              options: card.options ? JSON.stringify(card.options) : null,
              next_review: new Date().toISOString(),
              interval: 0,
              ease_factor: 2.5,
              repetitions: 0
            }));

            const { error: insertError } = await supabase
              .from('study_cards')
              .insert(cardsToInsert);

            if (insertError) {
                logger.error(`Failed to insert cards for node ${node.id}`, insertError);
            } else {
                totalCards += cards.length;
            }
          }
          
          results.push({ node_id: node.id, title: node.title, cards: cards.length, status: 'success' });
        } catch (err: any) {
            logger.error(`Error processing node ${node.id}:`, err);
            results.push({ node_id: node.id, title: node.title, error: err.message, status: 'failed' });
        }
        
        processedCount++;
        await this.updateTaskStatus(supabase, taskId, 'processing', { 
            progress: Math.round((processedCount / sortedNodes.length) * 100),
            current_node: node.title
        }, undefined, userId);
      }

      await this.updateTaskStatus(supabase, taskId, 'completed', { 
        success: true, 
        totalCards, 
        details: results 
      }, undefined, userId);

    } catch (error: any) {
      logger.error('Task failed:', error);
      await this.updateTaskStatus(supabase, taskId, 'failed', null, error.message, userId);
    }
  }

  async processRecursiveGraphGeneration(taskId: string, userId: string, payload: any) {
    const supabase = defaultClient;
    try {
      await this.updateTaskStatus(supabase, taskId, 'processing', { 
        stage: 'init', 
        progress: 0 
      }, undefined, userId);

      const { graph_id, topic, depth = 3, style = 'academic' } = payload;

      const { data: graph } = await supabase
        .from('knowledge_graphs')
        .select('id, title')
        .eq('id', graph_id)
        .single();

      if (!graph) {
        throw new Error('Graph not found');
      }

      const provider = await getAIProviderForTask('text');
      if (!provider.hasKey) {
        throw new Error('AI provider not configured');
      }

      let totalNodes = 0;
      let totalEdges = 0;
      const nodeMap = new Map<string, string>();

      const systemPrompt = await this.getAutoGraphPrompt(supabase, userId, graph_id, 'init', {
        topic,
        isAcademic: style === 'academic',
        hasSources: false,
        isInit: true
      });

      const initCompletion = await provider.client.chat.completions.create({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `主题：${topic}\n\n请生成知识图谱的根节点和核心节点。` }
        ],
        model: provider.model,
        response_format: { type: "json_object" },
        max_tokens: 4000,
      });

      const initParsed = JSON.parse(initCompletion.choices[0].message.content || '{"root": null, "coreNodes": []}');
      
      const rootData = initParsed.root || { title: topic, content: `${topic}的核心概念` };
      const coreNodes = initParsed.coreNodes || [];

      const { data: rootNode } = await supabase
        .from('nodes')
        .insert({
          graph_id,
          title: rootData.title,
          content: rootData.content || '',
          level: 'root',
          x_position: 400,
          y_position: 300
        })
        .select('id')
        .single();

      if (rootNode) {
        nodeMap.set(rootData.title, rootNode.id);
        totalNodes++;

        for (const coreNode of coreNodes) {
          const { data: childNode } = await supabase
            .from('nodes')
            .insert({
              graph_id,
              title: coreNode.title,
              content: coreNode.content || '',
              level: 'core',
              x_position: 200 + Math.random() * 400,
              y_position: 500 + Math.random() * 200
            })
            .select('id')
            .single();

          if (childNode) {
            nodeMap.set(coreNode.title, childNode.id);
            totalNodes++;

            await supabase
              .from('edges')
              .insert({
                graph_id,
                source_node_id: rootNode.id,
                target_node_id: childNode.id,
                relationship_type: 'contains'
              });
            totalEdges++;
          }
        }
      }

      await this.updateTaskStatus(supabase, taskId, 'processing', { 
        stage: 'init_complete', 
        progress: 30,
        totalNodes 
      }, undefined, userId);

      if (depth >= 2) {
        const coreNodeEntries = Array.from(nodeMap.entries()).filter(([title]) => title !== rootData.title);
        
        for (let i = 0; i < coreNodeEntries.length; i++) {
          const [nodeTitle, nodeId] = coreNodeEntries[i];
          
          await this.updateTaskStatus(supabase, taskId, 'processing', { 
            stage: 'expanding', 
            progress: 30 + Math.round((i / coreNodeEntries.length) * 40),
            currentNode: nodeTitle
          }, undefined, userId);

          try {
            const expandPrompt = await this.getAutoGraphPrompt(supabase, userId, graph_id, 'expand', {
              nodeTitle: nodeTitle,
              nodeContent: '',
              nodeLevel: 'core',
              isAcademic: style === 'academic',
              hasExistingChildren: false,
              existingChildren: ''
            });

            const expandCompletion = await provider.client.chat.completions.create({
              messages: [
                { role: "system", content: expandPrompt },
                { role: "user", content: `请为「${nodeTitle}」生成子节点。` }
              ],
              model: provider.model,
              response_format: { type: "json_object" },
              max_tokens: 3000,
            });

            const expandParsed = JSON.parse(expandCompletion.choices[0].message.content || '{"children": []}');
            const children = expandParsed.children || [];

            for (const child of children.slice(0, 5)) {
              const { data: subNode } = await supabase
                .from('nodes')
                .insert({
                  graph_id,
                  title: child.title,
                  content: child.content || '',
                  level: 'sub',
                  x_position: 100 + Math.random() * 600,
                  y_position: 700 + Math.random() * 200
                })
                .select('id')
                .single();

              if (subNode) {
                nodeMap.set(child.title, subNode.id);
                totalNodes++;

                await supabase
                  .from('edges')
                  .insert({
                    graph_id,
                    source_node_id: nodeId,
                    target_node_id: subNode.id,
                    relationship_type: 'contains'
                  });
                totalEdges++;
              }
            }
          } catch (expandError) {
            logger.warn(`Failed to expand node ${nodeTitle}:`, expandError);
          }
        }
      }

      if (depth >= 3) {
        const subNodeEntries = Array.from(nodeMap.entries()).filter(([title]) => {
          return title !== rootData.title && !coreNodes.some((c: any) => c.title === title);
        });

        for (let i = 0; i < Math.min(subNodeEntries.length, 10); i++) {
          const [nodeTitle, nodeId] = subNodeEntries[i];
          
          await this.updateTaskStatus(supabase, taskId, 'processing', { 
            stage: 'deep_expanding', 
            progress: 70 + Math.round((i / Math.min(subNodeEntries.length, 10)) * 25),
            currentNode: nodeTitle
          }, undefined, userId);

          try {
            const expandPrompt = await this.getAutoGraphPrompt(supabase, userId, graph_id, 'expand', {
              nodeTitle: nodeTitle,
              nodeContent: '',
              nodeLevel: 'sub',
              isAcademic: style === 'academic',
              hasExistingChildren: false,
              existingChildren: ''
            });

            const expandCompletion = await provider.client.chat.completions.create({
              messages: [
                { role: "system", content: expandPrompt },
                { role: "user", content: `请为「${nodeTitle}」生成子节点。` }
              ],
              model: provider.model,
              response_format: { type: "json_object" },
              max_tokens: 2000,
            });

            const expandParsed = JSON.parse(expandCompletion.choices[0].message.content || '{"children": []}');
            const children = expandParsed.children || [];

            for (const child of children.slice(0, 3)) {
              const { data: leafNode } = await supabase
                .from('nodes')
                .insert({
                  graph_id,
                  title: child.title,
                  content: child.content || '',
                  level: 'leaf',
                  x_position: 50 + Math.random() * 700,
                  y_position: 900 + Math.random() * 200
                })
                .select('id')
                .single();

              if (leafNode) {
                totalNodes++;

                await supabase
                  .from('edges')
                  .insert({
                    graph_id,
                    source_node_id: nodeId,
                    target_node_id: leafNode.id,
                    relationship_type: 'contains'
                  });
                totalEdges++;
              }
            }
          } catch (expandError) {
            logger.warn(`Failed to expand sub-node ${nodeTitle}:`, expandError);
          }
        }
      }

      await this.updateTaskStatus(supabase, taskId, 'completed', { 
        success: true, 
        totalNodes,
        totalEdges,
        graphId: graph_id
      }, undefined, userId);

    } catch (error: any) {
      logger.error('Recursive graph generation failed:', error);
      await this.updateTaskStatus(supabase, taskId, 'failed', null, error.message, userId);
    }
  }

  private async getAutoGraphPrompt(supabase: any, userId: string, graphId: string, type: 'init' | 'expand', data: any): Promise<string> {
    const { promptService } = await import('./promptService.js');
    const templateCode = type === 'init' ? 'auto_graph_init' : 'auto_graph_expand';
    return promptService.getRenderedPrompt(supabase, templateCode, data, userId, graphId);
  }
}

export const taskService = new TaskService();
