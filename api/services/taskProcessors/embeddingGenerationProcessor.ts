import { SupabaseClient } from '@supabase/supabase-js';
import { TaskProcessor, registerProcessor, UpdateTaskStatusFunction } from './index';
import { aiService } from '../ai/aiService';
import { logger } from '../../utils/logger';

const BATCH_SIZE = 20;
const EMBEDDING_DELAY_MS = 100;

export class EmbeddingGenerationProcessor implements TaskProcessor {
  async process(
    taskId: string,
    userId: string,
    payload: Record<string, unknown>,
    supabase: SupabaseClient,
    updateTaskStatus: UpdateTaskStatusFunction
  ): Promise<void> {
    logger.info(`Starting embedding generation task ${taskId} for user ${userId}`, { payload });
    
    try {
      await updateTaskStatus(supabase, taskId, 'processing', undefined, undefined, undefined, userId);

      const { graphId, knowledgePointIds } = payload;

      let knowledgePoints: Array<{ id: string; title: string }> = [];

      if (knowledgePointIds && Array.isArray(knowledgePointIds) && knowledgePointIds.length > 0) {
        const { data, error } = await supabase
          .from('knowledge_points')
          .select('id, title')
          .in('id', knowledgePointIds)
          .is('embedding', null);

        if (error) {
          throw new Error(`Failed to fetch knowledge points: ${error.message}`);
        }
        knowledgePoints = data || [];
      } else if (graphId) {
        const { data: graphNodes, error: gnError } = await supabase
          .from('graph_nodes')
          .select(`
            knowledge_point_id,
            knowledge_points (
              id,
              title,
              embedding
            )
          `)
          .eq('graph_id', graphId)
          .is('deleted_at', null);

        if (gnError) {
          throw new Error(`Failed to fetch graph nodes: ${gnError.message}`);
        }

        knowledgePoints = (graphNodes || [])
          .filter((gn) => {
            const kpArray = gn.knowledge_points as unknown as { id: string; title: string; embedding: number[] | null }[] | null;
            const kp = kpArray?.[0];
            return kp && kp.embedding === null;
          })
          .map((gn) => {
            const kpArray = gn.knowledge_points as unknown as { id: string; title: string }[] | null;
            const kp = kpArray?.[0];
            return {
              id: kp!.id,
              title: kp!.title
            };
          });
      } else {
        throw new Error('Either graphId or knowledgePointIds must be provided');
      }

      if (knowledgePoints.length === 0) {
        await updateTaskStatus(supabase, taskId, 'completed', {
          success: true,
          processed: 0,
          failed: 0,
          message: 'No knowledge points need embedding generation'
        }, undefined, undefined, userId);
        return;
      }

      logger.info(`Processing ${knowledgePoints.length} knowledge points for embedding generation`);

      let processed = 0;
      let failed = 0;
      const failedIds: string[] = [];

      for (let i = 0; i < knowledgePoints.length; i += BATCH_SIZE) {
        const batch = knowledgePoints.slice(i, i + BATCH_SIZE);
        const texts = batch.map(kp => kp.title);

        try {
          const embeddings = await aiService.generateEmbeddingsBatch(texts);

          for (let j = 0; j < batch.length; j++) {
            if (embeddings[j]) {
              const { error: updateError } = await supabase
                .from('knowledge_points')
                .update({ embedding: embeddings[j] })
                .eq('id', batch[j].id);

              if (updateError) {
                logger.error(`Failed to update embedding for ${batch[j].id}:`, updateError);
                failed++;
                failedIds.push(batch[j].id);
              } else {
                processed++;
              }
            } else {
              failed++;
              failedIds.push(batch[j].id);
            }
          }

          const progress = Math.round(((i + batch.length) / knowledgePoints.length) * 100);
          await updateTaskStatus(supabase, taskId, 'processing', {
            progress,
            processed,
            failed,
            total: knowledgePoints.length
          }, undefined, undefined, userId);

          if (i + BATCH_SIZE < knowledgePoints.length) {
            await this.sleep(EMBEDDING_DELAY_MS);
          }
        } catch (error) {
          logger.error(`Failed to generate embeddings for batch starting at ${i}:`, error);
          failed += batch.length;
          failedIds.push(...batch.map(kp => kp.id));
        }
      }

      logger.info(`Embedding generation completed: ${processed} processed, ${failed} failed`);

      await updateTaskStatus(supabase, taskId, 'completed', {
        success: true,
        processed,
        failed,
        total: knowledgePoints.length,
        failedIds: failedIds.length > 0 ? failedIds : undefined
      }, undefined, undefined, userId);

    } catch (error: unknown) {
      logger.error(`Embedding generation task ${taskId} failed:`, error);
      await updateTaskStatus(supabase, taskId, 'failed', null, undefined, error instanceof Error ? error.message : 'Unknown error', userId);
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

registerProcessor('embedding_generation', new EmbeddingGenerationProcessor());
