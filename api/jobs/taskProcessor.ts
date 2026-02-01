
import { supabaseAdmin } from '../supabase.js';
import { taskService, Task } from '../services/taskService.js';
import { aiService } from '../services/aiService.js';
import { graphService } from '../services/graphService.js';
import { getNextLevel } from '../utils/graphUtils.js';
import { cacheService, CacheKeys } from '../services/cache.js';

class TaskProcessor {
  private isProcessing = false;

  async processPendingTasks() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const tasks = await taskService.getPendingTasks(supabaseAdmin);
      
      if (tasks.length > 0) {
        console.log(`[TaskProcessor] Found ${tasks.length} pending tasks`);
        await Promise.all(tasks.map(task => this.processTask(task)));
      }
    } catch (error) {
      console.error('[TaskProcessor] Error polling tasks:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processTask(task: Task) {
    console.log(`[TaskProcessor] Processing task ${task.id} (${task.type})`);
    
    try {
      // Update status to processing
      await taskService.updateTaskStatus(supabaseAdmin, task.id, 'processing');

      let result;
      switch (task.type) {
        case 'generate_questions':
          result = await this.handleGenerateQuestions(task);
          break;
        case 'expand_graph':
          result = await this.handleExpandGraph(task);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      // Update status to completed
      await taskService.updateTaskStatus(supabaseAdmin, task.id, 'completed', result);
      console.log(`[TaskProcessor] Task ${task.id} completed`);
      
      // Invalidate cache
      if (task.type === 'expand_graph') {
         // We need user_id and graph_id to invalidate cache properly
         // task.user_id is available
         // task.payload.graph_id is available
         const { graph_id } = task.payload;
         if (graph_id && task.user_id) {
           await cacheService.del(CacheKeys.GRAPH_NODES(task.user_id, graph_id));
           console.log(`[TaskProcessor] Cache invalidated for graph ${graph_id}`);
         }
      }

    } catch (error: any) {
      console.error(`[TaskProcessor] Task ${task.id} failed:`, error);
      await taskService.updateTaskStatus(supabaseAdmin, task.id, 'failed', undefined, error.message);
    }
  }

  private async handleGenerateQuestions(task: Task) {
    const { node_id, node_title, node_content } = task.payload;
    
    // 1. Generate cards via AI
    const aiResult = await aiService.generateCards(node_title, node_content);
    const cards = aiResult.cards;

    // 2. Insert cards into database
    if (cards.length > 0) {
      const cardsToInsert = cards.map((card: any) => ({
        user_id: task.user_id,
        node_id: node_id,
        question: card.question,
        answer: card.answer,
        card_type: card.type || 'qa',
        options: card.options ? JSON.stringify(card.options) : null,
        next_review: new Date().toISOString(), // Immediate review
        interval: 0,
        ease_factor: 2.5,
        repetitions: 0
      }));

      const { error } = await supabaseAdmin
        .from('study_cards')
        .insert(cardsToInsert);

      if (error) throw error;
    }

    return { count: cards.length };
  }

  private async handleExpandGraph(task: Task) {
    const { graph_id, node_id, node_title, node_content, existing_nodes, child_nodes } = task.payload;

    // Fetch latest existing nodes in the graph to avoid duplicates/conflicts in batch processing
    const { data: allNodes } = await supabaseAdmin
      .from('nodes')
      .select('title')
      .eq('graph_id', graph_id);
      
    const latestExistingNodes = allNodes?.map(n => n.title) || existing_nodes || [];

    // Fetch latest children of the current node
    const { data: currentEdges } = await supabaseAdmin
      .from('edges')
      .select('target_node_id')
      .eq('source_node_id', node_id);
      
    let latestChildNodes: string[] = [];
    if (currentEdges && currentEdges.length > 0) {
      const targetIds = currentEdges.map(e => e.target_node_id);
      const { data: childNodeData } = await supabaseAdmin
        .from('nodes')
        .select('title')
        .in('id', targetIds);
      latestChildNodes = childNodeData?.map(n => n.title) || [];
    } else {
      latestChildNodes = child_nodes || [];
    }

    // 1. Get suggestions from AI
    const aiResult = await aiService.expandKnowledge(node_title, node_content, latestExistingNodes, latestChildNodes);
    const suggestions = aiResult.suggestions;

    // 2. Insert new nodes and edges
    const newNodes: any[] = [];
    const newEdges: any[] = [];

    // Fetch current node to get position
    const { data: currentNode } = await supabaseAdmin
      .from('nodes')
      .select('x_position, y_position, level')
      .eq('id', node_id)
      .single();
      
    if (!currentNode) throw new Error('Source node not found');
    
    const newLevel = getNextLevel(currentNode.level);

    if (Array.isArray(suggestions) && suggestions.length > 0) {
      for (const item of suggestions) {
        // Check if node already exists (by title in this graph)
        const { data: existingNode } = await supabaseAdmin
          .from('nodes')
          .select('id')
          .eq('graph_id', graph_id)
          .eq('title', item.title)
          .single();

        if (existingNode) {
          // Check if edge already exists
          if (existingNode.id !== node_id) {
            const { data: existingEdge } = await supabaseAdmin
              .from('edges')
              .select('id')
              .or(`and(source_node_id.eq.${node_id},target_node_id.eq.${existingNode.id}),and(source_node_id.eq.${existingNode.id},target_node_id.eq.${node_id})`)
              .single();

            if (!existingEdge) {
              const { data: edge } = await supabaseAdmin
                .from('edges')
                .insert({
                  graph_id: graph_id,
                  source_node_id: node_id,
                  target_node_id: existingNode.id,
                  relationship_type: 'related'
                })
                .select()
                .single();
              
              if (edge) newEdges.push(edge);
            }
          }
        } else {
          // Create new node
          const angle = Math.random() * Math.PI * 2;
          const radius = 4 + Math.random() * 4;
          const x = Math.round(currentNode.x_position + Math.cos(angle) * radius);
          const y = Math.round(currentNode.y_position + Math.sin(angle) * radius);

          const { data: newNode, error: nodeError } = await supabaseAdmin
            .from('nodes')
            .insert({
              graph_id: graph_id,
              title: item.title,
              content: item.content || '',
              x_position: x,
              y_position: y,
              level: newLevel,
              color: '#10B981'
            })
            .select()
            .single();

          if (nodeError) throw nodeError;
          if (newNode) {
            newNodes.push(newNode);

            // Create edge from parent to new node
            const { data: edge, error: edgeError } = await supabaseAdmin
              .from('edges')
              .insert({
                graph_id: graph_id,
                source_node_id: node_id,
                target_node_id: newNode.id,
                relationship_type: 'related'
              })
              .select()
              .single();

            if (edgeError) throw edgeError;
            if (edge) newEdges.push(edge);
          }
        }
      }
    }

    return { 
      nodesCreated: newNodes.length, 
      edgesCreated: newEdges.length,
      nodeTitles: newNodes.map(n => n.title) 
    };
  }
}

export const taskProcessor = new TaskProcessor();
