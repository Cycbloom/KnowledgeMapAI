
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { aiService } from './aiService.js';
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

  async getTasks(client: SupabaseClient, userId: string, status?: string) {
    let query = client
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to fetch tasks: ${error.message}`);
    return data as Task[];
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
}

export const taskService = new TaskService();
