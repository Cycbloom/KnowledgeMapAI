import { SupabaseClient } from '@supabase/supabase-js';
import { TaskProcessor, registerProcessor, UpdateTaskStatusFunction } from './index.js';
import { aiService, type CardDifficulty } from '../ai/index.js';
import { logger } from '../../utils/logger.js';

interface QuizGenerationTaskConfig {
  cardTypes: string[];
  difficulty: CardDifficulty;
  cardsPerType?: Record<string, number>;
  customPrompt?: string;
  provider?: string;
  model?: string;
}

interface QuizGenerationTaskPayload {
  quizSetId: string;
  userId: string;
  knowledgePointIds: string[];
  config: QuizGenerationTaskConfig;
}

export class QuizGenerationProcessor implements TaskProcessor {
  async process(
    taskId: string,
    userId: string,
    payload: QuizGenerationTaskPayload,
    supabase: SupabaseClient,
    updateTaskStatus: UpdateTaskStatusFunction
  ): Promise<void> {
    try {
      await updateTaskStatus(supabase, taskId, 'processing', { stage: 'initializing', progress: 0 }, undefined, userId);

      const { quizSetId, knowledgePointIds, config } = payload;
      const { cardTypes = ['qa', 'choice'], difficulty = 'medium', cardsPerType, customPrompt, provider, model } = config || {};

      const { data: quizSet, error: quizSetError } = await supabase
        .from('quiz_sets')
        .select('id, title, graph_id, config')
        .eq('id', quizSetId)
        .eq('user_id', userId)
        .single();

      if (quizSetError || !quizSet) {
        throw new Error('Quiz set not found');
      }

      await supabase
        .from('quiz_sets')
        .update({ status: 'generating', updated_at: new Date().toISOString() })
        .eq('id', quizSetId);

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
        .in('knowledge_point_id', knowledgePointIds)
        .is('deleted_at', null);

      if (gnError || !graphNodes || graphNodes.length === 0) {
        throw new Error('Failed to fetch knowledge points');
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
        .in('target_knowledge_point_id', knowledgePointIds);

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
      const allGeneratedCards: any[] = [];

      for (const node of sortedNodes) {
        const parentId = parentMap.get(node.id);
        const parentNode = parentId ? parentNodesMap.get(parentId) : null;
        let context = parentNode ? `Parent Node: "${parentNode.title}"` : 'Root Node';
        
        if (customPrompt) {
          context = `${context}\n\nCustom Instructions: ${customPrompt}`;
        }

        let typesForNode = cardTypes;
        let countForNode = cardsPerType ? 
          cardTypes.reduce((sum, type) => sum + (cardsPerType[type] || 1), 0) : 
          3;

        try {
          const aiResult = await aiService.generateCards(node.title, node.content, {
            context,
            types: typesForNode,
            count: countForNode,
            difficulty,
            provider: provider as any,
            model,
            userId,
            graphId: quizSet.graph_id,
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
              difficulty: difficulty === 'mixed' ? this.getRandomDifficulty() : difficulty,
              options: card.options ? JSON.stringify(card.options) : null,
              next_review: new Date().toISOString(),
              interval: 0,
              ease_factor: 2.5,
              repetitions: 0
            }));

            const { data: insertedCards, error: insertError } = await supabase
              .from('study_cards')
              .insert(cardsToInsert)
              .select('id');

            if (insertError) {
              logger.error(`Failed to insert cards for node ${node.id}`, insertError);
            } else {
              totalCards += cards.length;
              allGeneratedCards.push(...(insertedCards || []));
            }
          }

          results.push({ node_id: node.id, title: node.title, cards: cards.length, status: 'success' });
        } catch (err: any) {
          logger.error(`Error processing node ${node.id}:`, err);
          results.push({ node_id: node.id, title: node.title, error: err.message, status: 'failed' });
        }

        processedCount++;
        await updateTaskStatus(supabase, taskId, 'processing', {
          stage: 'generating',
          progress: Math.round((processedCount / sortedNodes.length) * 100),
          current_node: node.title,
          total_cards: totalCards
        }, undefined, userId);
      }

      if (allGeneratedCards.length > 0) {
        const quizSetCardsToInsert = allGeneratedCards.map((card: any, index: number) => ({
          quiz_set_id: quizSetId,
          card_id: card.id,
          display_order: index + 1
        }));

        const { error: linkError } = await supabase
          .from('quiz_set_cards')
          .insert(quizSetCardsToInsert);

        if (linkError) {
          logger.error('Failed to link cards to quiz set:', linkError);
        }
      }

      await supabase
        .from('quiz_sets')
        .update({
          status: 'ready',
          card_count: totalCards,
          updated_at: new Date().toISOString()
        })
        .eq('id', quizSetId);

      await updateTaskStatus(supabase, taskId, 'completed', {
        success: true,
        totalCards,
        quizSetId,
        details: results
      }, undefined, userId);

    } catch (error: any) {
      logger.error('Quiz generation task failed:', error);

      try {
        const { quizSetId } = payload;
        await supabase
          .from('quiz_sets')
          .update({ status: 'error', updated_at: new Date().toISOString() })
          .eq('id', quizSetId);
      } catch (updateError) {
        logger.error('Failed to update quiz set status:', updateError);
      }

      await updateTaskStatus(supabase, taskId, 'failed', null, error.message, userId);
    }
  }

  private getRandomDifficulty(): 'easy' | 'medium' | 'hard' {
    const difficulties: ('easy' | 'medium' | 'hard')[] = ['easy', 'medium', 'hard'];
    return difficulties[Math.floor(Math.random() * difficulties.length)];
  }
}

registerProcessor('generate_quiz', new QuizGenerationProcessor());
