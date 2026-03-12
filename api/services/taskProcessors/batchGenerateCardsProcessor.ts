import { SupabaseClient } from '@supabase/supabase-js';
import { TaskProcessor, registerProcessor, UpdateTaskStatusFunction } from './index.js';
import { aiService } from '../ai/aiService.js';
import { logger } from '../../utils/logger.js';

export class BatchGenerateCardsProcessor implements TaskProcessor {
  async process(
    taskId: string, 
    userId: string, 
    payload: any, 
    supabase: SupabaseClient,
    updateTaskStatus: UpdateTaskStatusFunction
  ): Promise<void> {
    try {
      await updateTaskStatus(supabase, taskId, 'processing', undefined, undefined, userId);
      
      const { node_ids, config } = payload;
      const { types = ['qa', 'choice', 'true_false'], count = 3 } = config || {};

      const { data: graphNodes, error: gnError } = await supabase
        .from('graph_nodes')
        .select(`
          id,
          graph_id,
          knowledge_point_id,
          level,
          knowledge_points (
            id,
            title,
            content
          )
        `)
        .in('knowledge_point_id', node_ids)
        .is('deleted_at', null);

      if (gnError || !graphNodes || graphNodes.length === 0) {
        throw new Error('Failed to fetch nodes');
      }

      const nodes = graphNodes.map((gn: any) => ({
        id: gn.knowledge_points?.id || gn.knowledge_point_id,
        graph_id: gn.graph_id,
        graph_node_id: gn.id,
        title: gn.knowledge_points?.title || '',
        content: gn.knowledge_points?.content || '',
        level: gn.level,
      }));

      const { data: edges } = await supabase
        .from('edges')
        .select('source_knowledge_point_id, target_knowledge_point_id')
        .in('target_knowledge_point_id', node_ids);
      
      const parentMap = new Map<string, string>();
      if (edges) {
        edges.forEach((e: any) => parentMap.set(e.target_knowledge_point_id, e.source_knowledge_point_id));
      }

      const parentIds = Array.from(parentMap.values());
      const parentNodesMap = new Map<string, any>();
      
      if (parentIds.length > 0) {
        const { data: parentGraphNodes } = await supabase
          .from('graph_nodes')
          .select(`
            knowledge_point_id,
            knowledge_points (
              id,
              title,
              content
            )
          `)
          .in('knowledge_point_id', parentIds)
          .is('deleted_at', null);
        
        if (parentGraphNodes) {
          parentGraphNodes.forEach((pgn: any) => {
            parentNodesMap.set(pgn.knowledge_point_id, {
              id: pgn.knowledge_points?.id || pgn.knowledge_point_id,
              title: pgn.knowledge_points?.title || '',
              content: pgn.knowledge_points?.content || '',
            });
          });
        }
      }

      const levelOrder: Record<string, number> = { 'root': 0, 'core': 1, 'sub': 2, 'normal': 3, 'leaf': 4 };
      const sortedNodes = [...nodes].sort((a, b) => {
        const la = levelOrder[a.level || 'leaf'] ?? 4;
        const lb = levelOrder[b.level || 'leaf'] ?? 4;
        return la - lb;
      });

      const results = [];
      let totalCards = 0;
      let processedCount = 0;

      for (const node of sortedNodes) {
        const parentId = parentMap.get(node.id);
        const parentNode = parentId ? parentNodesMap.get(parentId) : null;
        const context = parentNode ? `Parent Node: "${parentNode.title}"` : 'Root Node';

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
        await updateTaskStatus(supabase, taskId, 'processing', { 
            progress: Math.round((processedCount / sortedNodes.length) * 100),
            current_node: node.title
        }, undefined, userId);
      }

      await updateTaskStatus(supabase, taskId, 'completed', { 
        success: true, 
        totalCards, 
        details: results 
      }, undefined, userId);

    } catch (error: any) {
      logger.error('Task failed:', error);
      await updateTaskStatus(supabase, taskId, 'failed', null, error.message, userId);
    }
  }
}

registerProcessor('batch_generate_cards', new BatchGenerateCardsProcessor());
