
import { supabaseAdmin } from '../supabase.js';
import { taskService, Task } from '../services/taskService.js';
import { aiService } from '../services/aiService.js';
import { graphService } from '../services/graphService.js';

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
    const { graph_id, node_id, node_title } = task.payload;

    // 1. Get suggestions from AI
    const aiResult = await aiService.expandKnowledge(node_title);
    const suggestions = aiResult.suggestions;

    // 2. Insert new nodes and edges
    const newNodes: any[] = [];
    const newEdges: any[] = [];

    if (Array.isArray(suggestions) && suggestions.length > 0) {
      for (const item of suggestions) {
        // Create new node
        const { data: newNode, error: nodeError } = await supabaseAdmin
          .from('nodes')
          .insert({
            graph_id: graph_id,
            title: item.title,
            content: item.content || '',
            x_position: Math.round((Math.random() - 0.5) * 50),
            y_position: Math.round((Math.random() - 0.5) * 50),
            level: 'sub', // Default to sub-level for expansion
            color: '#F59E0B'
          })
          .select()
          .single();

        if (nodeError) throw nodeError;
        newNodes.push(newNode);

        // Create edge from parent to new node
        const { error: edgeError } = await supabaseAdmin
          .from('edges')
          .insert({
            graph_id: graph_id,
            source_node_id: node_id,
            target_node_id: newNode.id,
            relationship_type: 'related'
          });

        if (edgeError) throw edgeError;
        newEdges.push({ source: node_id, target: newNode.id });
      }
    }

    return { 
      nodesCreated: newNodes.length, 
      nodeTitles: newNodes.map(n => n.title) 
    };
  }
}

export const taskProcessor = new TaskProcessor();
