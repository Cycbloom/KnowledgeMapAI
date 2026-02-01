import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabase.js';
import { taskService } from '../services/taskService.js';
import { openai, getAIModel, getMockResponse } from '../services/aiService.js';
import { getNextLevel } from '../utils/graphUtils.js';

export class TaskWorker {
  private isRunning: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('Task Worker started...');
    
    // Check for tasks every 5 seconds
    this.checkInterval = setInterval(() => this.processPendingTasks(), 5000);
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    console.log('Task Worker stopped.');
  }

  private async processPendingTasks() {
    try {
      const tasks = await taskService.getPendingTasks(supabaseAdmin);
      
      if (tasks && tasks.length > 0) {
        console.log(`Found ${tasks.length} pending tasks. Processing...`);
        
        // Process tasks sequentially to avoid rate limits
        for (const task of tasks) {
          await this.processTask(task);
        }
      }
    } catch (error) {
      console.error('Error checking pending tasks:', error);
    }
  }

  private async processTask(task: any) {
    console.log(`Processing task ${task.id} (${task.type})...`);
    
    try {
      // Update status to processing
      await taskService.updateTaskStatus(supabaseAdmin, task.id, 'processing');

      let result;
      if (task.type === 'expand_graph') {
        result = await this.handleExpandGraphTask(task);
      } else {
        throw new Error(`Unknown task type: ${task.type}`);
      }

      // Update status to completed
      await taskService.updateTaskStatus(supabaseAdmin, task.id, 'completed', result);
      console.log(`Task ${task.id} completed successfully.`);
      
    } catch (error: any) {
      console.error(`Task ${task.id} failed:`, error);
      await taskService.updateTaskStatus(supabaseAdmin, task.id, 'failed', undefined, error.message);
    }
  }

  private async handleExpandGraphTask(task: any) {
    const { node_id, node_title, node_content, graph_id, existing_nodes, child_nodes } = task.payload;
    
    // 1. Call AI to get suggestions
    let suggestions = [];
    
    if (openai) {
      const existingNodesContext = existing_nodes && existing_nodes.length > 0 
        ? `\nExisting Nodes in Graph: ${existing_nodes.slice(0, 50).join(', ')}`
        : '';
        
      const childrenContext = child_nodes && child_nodes.length > 0
        ? `\nCurrent Direct Children (DO NOT suggest these): ${child_nodes.join(', ')}`
        : '';

      const completion = await openai.chat.completions.create({
        messages: [
          { role: "system", content: "You are a knowledge graph expert. Suggest a comprehensive list of related sub-topics or concepts for the given node to expand the graph deeply. \n" +
            "Quantity: Generate as many relevant nodes as necessary to cover the topic thoroughly (up to 20 nodes), but quality and representativeness are more important than quantity.\n" +
            "If a suggested concept matches an 'Existing Node', please use the EXACT same title so we can link to it.\n" +
            "Do not suggest topics that are already listed in 'Current Direct Children'.\n" +
            "Return JSON array of objects with 'title' and 'content'.\n" +
            "Please respond in Chinese." },
          { role: "user", content: `Node Title: ${node_title}\nNode Content: ${node_content || ''}${existingNodesContext}${childrenContext}` }
        ],
        model: getAIModel(),
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0].message.content;
      const parsed = JSON.parse(content || '{"suggestions": []}');
      suggestions = parsed.suggestions || parsed;
    } else {
      // @ts-ignore
      suggestions = getMockResponse('expand', node_title);
    }

    // 2. Process suggestions and update graph directly in DB
    // This allows the task to be truly "background" - modifying DB without frontend intervention
    const newNodes = [];
    const newEdges = [];
    
    // Fetch current node to get position
    const { data: currentNode } = await supabaseAdmin
      .from('nodes')
      .select('x_position, y_position, level')
      .eq('id', node_id)
      .single();
      
    if (!currentNode) throw new Error('Source node not found');
    
    const newLevel = getNextLevel(currentNode.level);
    
    for (const s of suggestions) {
       // Check if node exists (by title in this graph)
       const { data: existingNode } = await supabaseAdmin
        .from('nodes')
        .select('id')
        .eq('graph_id', graph_id)
        .eq('title', s.title)
        .single();

       if (existingNode) {
         // Create edge if not exists
         const { data: existingEdge } = await supabaseAdmin
          .from('edges')
          .select('id')
          .or(`and(source_node_id.eq.${node_id},target_node_id.eq.${existingNode.id}),and(source_node_id.eq.${existingNode.id},target_node_id.eq.${node_id})`)
          .single();
          
         if (!existingEdge && existingNode.id !== node_id) {
           const { data: edge } = await supabaseAdmin
            .from('edges')
            .insert({
              source_node_id: node_id,
              target_node_id: existingNode.id,
              relationship_type: 'related',
              graph_id: graph_id
            })
            .select()
            .single();
            
           if (edge) newEdges.push(edge);
         }
       } else {
         // Create new node
         const angle = Math.random() * Math.PI * 2;
         const radius = 4 + Math.random() * 4;
         const x = Math.round(currentNode.x_position + Math.cos(angle) * radius);
         const y = Math.round(currentNode.y_position + Math.sin(angle) * radius);
         
         const { data: newNode } = await supabaseAdmin
          .from('nodes')
          .insert({
            graph_id: graph_id,
            title: s.title,
            content: s.content,
            x_position: x,
            y_position: y,
            level: newLevel,
            color: '#10B981', // Default AI color, can be refined
            user_id: task.user_id
          })
          .select()
          .single();
          
         if (newNode) {
           newNodes.push(newNode);
           
           // Link to parent
           const { data: edge } = await supabaseAdmin
            .from('edges')
            .insert({
              source_node_id: node_id,
              target_node_id: newNode.id,
              relationship_type: 'related',
              graph_id: graph_id
            })
            .select()
            .single();
            
           if (edge) newEdges.push(edge);
         }
       }
    }

    return {
      suggestions_count: suggestions.length,
      new_nodes_count: newNodes.length,
      new_edges_count: newEdges.length,
      node_ids: newNodes.map(n => n.id)
    };
  }
}

export const taskWorker = new TaskWorker();
