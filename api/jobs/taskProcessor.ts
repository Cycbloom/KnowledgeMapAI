
import { supabaseAdmin } from '../supabase.js';
import { taskService, Task } from '../services/taskService.js';
import { aiService } from '../services/aiService.js';
import { graphService } from '../services/graphService.js';
import { getNextLevel } from '../utils/graphUtils.js';
import { cacheService, CacheKeys } from '../services/cache.js';

class TaskProcessor {
  
  public async processTask(task: Task) {
    console.log(`[TaskProcessor] Processing task ${task.id} (${task.type})`);
    
    try {
      // Update status to processing
      await taskService.updateTaskStatus(supabaseAdmin, task.id, 'processing');

      let result;
      switch (task.type) {
        case 'generate_questions':
          result = await this.handleGenerateQuestions(task);
          break;
        case 'batch_generate_questions':
          await taskService.processBatchGenerateCards(task.id, task.user_id, task.payload);
          // Result is handled by processBatchGenerateCards, but we need to return something to avoid double completion overwriting with undefined if we were to return here.
          // However, processTask continues to set completed.
          // Let's return the final result from the task itself?
          // processBatchGenerateCards doesn't return the result.
          // We can just break, and the subsequent updateTaskStatus will overwrite 'completed' with 'completed' (and undefined result if we don't set it).
          // But processBatchGenerateCards sets a detailed result.
          // If we break here, result is undefined.
          // Then updateTaskStatus(..., 'completed', undefined) is called.
          // My updateTaskStatus implementation: if (r !== undefined) updateData.result = r;
          // So if result is undefined, it WON'T overwrite the result in DB!
          // Perfect.
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
    const { node_id, node_title, node_content, config } = task.payload;
    let totalCount = 0;
    const errors: string[] = [];
    
    // Fetch graph_id for the node (needed for optimized schema)
    const { data: nodeData } = await supabaseAdmin
        .from('nodes')
        .select('graph_id')
        .eq('id', node_id)
        .single();
    const graph_id = nodeData?.graph_id;

    // Truncate content to avoid context overflow
    const MAX_CONTENT_LENGTH = 15000;
    const truncatedContent = node_content ? node_content.substring(0, MAX_CONTENT_LENGTH) : '';
    
    // Determine types and counts
    // config: { types: string[], count: number, pack_template?: string, provider?: string, model?: string }
    const types = (config?.types && Array.isArray(config.types) && config.types.length > 0) 
        ? config.types 
        : ['qa', 'choice']; // Default types
    const totalRequestCount = config?.count || 5;
    const provider = config?.provider || task.payload.provider;
    const model = config?.model || task.payload.model;
    
    // Use remaining count strategy to ensure exact total count
    let remainingCount = totalRequestCount;

    console.log(`[TaskProcessor] Generating questions for node ${node_title}. Types: ${types.join(',')}, Total: ${totalRequestCount}`);

    for (let i = 0; i < types.length; i++) {
        const type = types[i];
        
        // Calculate count for this type
        const countPerType = Math.ceil(remainingCount / (types.length - i));
        remainingCount -= countPerType;
        
        if (countPerType <= 0) continue;
        
        // Update Progress
        const progress = Math.round((i / types.length) * 100);
        await taskService.updateTaskStatus(supabaseAdmin, task.id, 'processing', { 
            progress, 
            current_node: `正在生成 ${this.getTypeName(type)}...` 
        });

        try {
            // Generate for specific type
            const aiResult = await aiService.generateCards(node_title, truncatedContent, { 
                type: type as any, 
                count: countPerType,
                provider,
                model
            });
            const cards = aiResult.cards || [];

            // Insert cards into database
            if (cards.length > 0) {
                const cardsToInsert = cards.map((card: any) => ({
                    user_id: task.user_id,
                    node_id: node_id,
                    graph_id: graph_id, // Add graph_id
                    question: card.question,
                    answer: card.answer,
                    explanation: card.explanation, // Add explanation
                    card_type: card.type || type, // Use returned type or fallback to requested type
                    options: card.options ? JSON.stringify(card.options) : null,
                    next_review: new Date().toISOString(), // Immediate review
                    difficulty: 1,
                    // FSRS initial values (Replacing SM-2 fields)
                    fsrs_state: 0,
                    fsrs_stability: 0,
                    fsrs_difficulty: 0,
                    fsrs_elapsed_days: 0,
                    fsrs_scheduled_days: 0,
                    fsrs_retrievability: 0
                }));

                const { error } = await supabaseAdmin
                    .from('study_cards')
                    .insert(cardsToInsert);

                if (error) {
                    console.error(`[TaskProcessor] Failed to insert cards for type ${type}:`, error);
                    errors.push(`Failed to insert ${type}: ${error.message}`);
                } else {
                    totalCount += cards.length;
                }
            } else {
                console.warn(`[TaskProcessor] AI returned 0 cards for type ${type}`);
            }
        } catch (err: any) {
            console.error(`[TaskProcessor] Error generating type ${type}:`, err);
            errors.push(`Failed to generate ${type}: ${err.message}`);
            // Continue to next type even if one fails
        }
    }

    if (totalCount === 0 && errors.length > 0) {
        throw new Error(`Failed to generate cards: ${errors.join('; ')}`);
    }
    
    // Invalidate cache if graph_id is available
    if (graph_id) {
        await cacheService.del(CacheKeys.STUDY_CARDS(graph_id));
    }

    return { count: totalCount, progress: 100, errors: errors.length > 0 ? errors : undefined };
  }

  private getTypeName(type: string): string {
      const map: Record<string, string> = {
          'qa': '问答题',
          'choice': '单选题',
          'true_false': '判断题',
          'multi_choice': '多选题',
          'fill_in_the_blank': '填空题',
          'essay': '解答题'
      };
      return map[type] || type;
  }

  private async handleExpandGraph(task: Task) {
    const { graph_id, node_id, node_title, node_content, existing_nodes, child_nodes, provider, model } = task.payload;

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

    // 0. Fetch current node to get position and level
    const { data: currentNode } = await supabaseAdmin
      .from('nodes')
      .select('x_position, y_position, level')
      .eq('id', node_id)
      .single();
      
    if (!currentNode) throw new Error('Source node not found');

    // 1. Get suggestions from AI
    const aiResult = await aiService.expandKnowledge(
      node_title, 
      node_content, 
      latestExistingNodes, 
      latestChildNodes, 
      { provider, model, contextLevel: currentNode.level }
    );
    const suggestions = aiResult.suggestions;

    // 2. Insert new nodes and edges
    const newNodes: any[] = [];
    const newEdges: any[] = [];
      
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
