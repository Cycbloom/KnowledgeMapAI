import { SupabaseClient } from '@supabase/supabase-js';
import { TaskProcessor, registerProcessor, UpdateTaskStatusFunction } from './index';
import { aiService } from '../ai/aiService';
import { logger } from '../../utils/logger';

import type { AIProviderType } from '@shared/types';
import { notDeleted } from '../common/softDeleteHelper';

interface BatchGenerateCardsPayload {
  node_ids: string[];
  config?: {
    types?: string[];
    count?: number;
    pack_template?: string;
    provider?: string;
    model?: string;
  };
}

interface GraphNodeWithKnowledgePoint {
  id: string;
  graph_id: string;
  knowledge_point_id: string;
  level: string;
  knowledge_points: {
    id: string;
    title: string;
    content: string | null;
  }[] | null;
}

interface EdgeForParent {
  source_knowledge_point_id: string;
  target_knowledge_point_id: string;
}

interface ParentGraphNodeWithKnowledgePoint {
  knowledge_point_id: string;
  knowledge_points: {
    id: string;
    title: string;
    content: string | null;
  }[] | null;
}

interface AIGeneratedCard {
  question: string;
  answer: string;
  explanation?: string;
  type?: string;
  options?: string[];
}

export class BatchGenerateCardsProcessor implements TaskProcessor {
  async process(
    taskId: string, 
    userId: string, 
    payload: BatchGenerateCardsPayload, 
    supabase: SupabaseClient,
    updateTaskStatus: UpdateTaskStatusFunction
  ): Promise<void> {
    logger.info(`Starting batch generate cards task ${taskId} for user ${userId}`, { payload });
    
    try {
      await updateTaskStatus(supabase, taskId, 'in_progress', undefined, undefined, undefined, userId);
      
      const { node_ids, config } = payload;
      const { types = ['qa', 'choice', 'true_false'], count = 3 } = config || {};

      const { data: graphNodes, error: gnError } = await notDeleted(supabase
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
        );

      if (gnError || !graphNodes || graphNodes.length === 0) {
        throw new Error('Failed to fetch nodes');
      }

      const nodes = graphNodes.map((gn: GraphNodeWithKnowledgePoint) => {
        const kp = gn.knowledge_points?.[0];
        return {
          id: kp?.id || gn.knowledge_point_id,
          graph_id: gn.graph_id,
          graph_node_id: gn.id,
          title: kp?.title || '',
          content: kp?.content || '',
          level: gn.level,
        };
      });

      const { data: edges } = await supabase
        .from('edges')
        .select('source_knowledge_point_id, target_knowledge_point_id')
        .in('target_knowledge_point_id', node_ids);
      
      const parentMap = new Map<string, string>();
      if (edges) {
        edges.forEach((e: EdgeForParent) => parentMap.set(e.target_knowledge_point_id, e.source_knowledge_point_id));
      }

      const parentIds = Array.from(parentMap.values());
      const parentNodesMap = new Map<string, { id: string; title: string; content: string | null }>();
      
      if (parentIds.length > 0) {
        const { data: parentGraphNodes } = await notDeleted(supabase
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
          );
        
        if (parentGraphNodes) {
          parentGraphNodes.forEach((pgn: ParentGraphNodeWithKnowledgePoint) => {
            const kp = pgn.knowledge_points?.[0];
            parentNodesMap.set(pgn.knowledge_point_id, {
              id: kp?.id || pgn.knowledge_point_id,
              title: kp?.title || '',
              content: kp?.content || '',
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
            provider: config?.provider as AIProviderType | undefined,
            model: config?.model
          });

          const cards = (aiResult.cards || []) as AIGeneratedCard[];

          if (cards.length > 0) {
            const cardsToInsert = cards.map((card) => ({
              user_id: userId,
              knowledge_point_id: node.id,
              graph_id: node.graph_id,
              question: card.question,
              answer: card.answer,
              explanation: card.explanation,
              card_type: card.type ?? 'qa',
              options: card.options ? JSON.stringify(card.options) : null,
              next_review: new Date().toISOString()
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
        } catch (err: unknown) {
            logger.error(`Error processing node ${node.id}:`, err);
            const errMsg = err instanceof Error ? err.message : String(err);
            results.push({ node_id: node.id, title: node.title, error: errMsg, status: 'failed' });
        }
        
        processedCount++;
        await updateTaskStatus(supabase, taskId, 'in_progress', { 
            progress: Math.round((processedCount / sortedNodes.length) * 100),
            current_node: node.title
        }, undefined, undefined, userId);
      }

      logger.info(`Batch card generation completed: ${totalCards} cards generated`);
      await updateTaskStatus(supabase, taskId, 'completed', { 
        success: true, 
        totalCards, 
        details: results 
      }, undefined, undefined, userId);

    } catch (error: unknown) {
      logger.error(`Batch generate cards task ${taskId} failed:`, error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await updateTaskStatus(supabase, taskId, 'failed', null, undefined, errorMessage, userId);
    }
  }
}

registerProcessor('batch_generate_cards', new BatchGenerateCardsProcessor());
