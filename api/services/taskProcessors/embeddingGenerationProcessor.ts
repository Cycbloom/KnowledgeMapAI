import { SupabaseClient } from '@supabase/supabase-js';
import { TaskProcessor, registerProcessor, UpdateTaskStatusFunction } from './index';
import { aiService } from '../ai/aiService';
import { chunkingService } from '../ai/chunkingService';
import { logger } from '../../utils/logger';
import { notDeleted } from '../common/softDeleteHelper';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';

const BATCH_SIZE = 20;
const EMBEDDING_DELAY_MS = 100;
const CHUNK_CONTENT_THRESHOLD = 500;

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
      await updateTaskStatus(supabase, taskId, 'in_progress', undefined, undefined, undefined, userId);

      const { graphId, knowledgePointIds } = payload;

      let knowledgePoints: Array<{ id: string; title: string; content: string | null }> = [];

      if (knowledgePointIds && Array.isArray(knowledgePointIds) && knowledgePointIds.length > 0) {
        const { data, error } = await supabase
          .from('knowledge_points')
          .select('id, title, content')
          .in('id', knowledgePointIds)
          .is('embedding', null);

        if (error) {
          throw new AppError(`Failed to fetch knowledge points: ${error.message}`, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
        }
        knowledgePoints = data || [];
      } else if (graphId) {
        const { data: graphNodes, error: gnError } = await notDeleted(supabase
          .from('graph_nodes')
          .select(`
            knowledge_point_id,
            knowledge_points (
              id,
              title,
              content,
              embedding
            )
          `)
          .eq('graph_id', graphId)
          );

        if (gnError) {
          throw new AppError(`Failed to fetch graph nodes: ${gnError.message}`, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
        }

        knowledgePoints = (graphNodes || [])
          .filter((gn) => {
            const kpArray = gn.knowledge_points as unknown as { id: string; title: string; content: string | null; embedding: number[] | null }[] | null;
            const kp = kpArray?.[0];
            return kp && kp.embedding === null;
          })
          .map((gn) => {
            const kpArray = gn.knowledge_points as unknown as { id: string; title: string; content: string | null }[] | null;
            const kp = kpArray?.[0];
            if (!kp) {
              return null;
            }
            return {
              id: kp.id,
              title: kp.title,
              content: kp.content ?? null
            };
          })
          .filter((kp): kp is { id: string; title: string; content: string | null } => kp !== null);
      } else {
        throw new AppError('Either graphId or knowledgePointIds must be provided', 400, ErrorCodes.VALIDATION_ERROR);
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

          const progress = Math.round(((i + batch.length) / knowledgePoints.length) * 50);
          await updateTaskStatus(supabase, taskId, 'in_progress', {
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

      const longContentKps = knowledgePoints.filter(kp => kp.content && kp.content.length > CHUNK_CONTENT_THRESHOLD);

      if (longContentKps.length > 0) {
        logger.info(`Processing ${longContentKps.length} knowledge points for chunking`);

        for (const kp of longContentKps) {
          try {
            const content = kp.content;
            if (!content) continue;
            const chunks = chunkingService.chunkText(content);

            if (chunks.length === 0) continue;

            const { error: deleteError } = await supabase
              .from('document_chunks')
              .delete()
              .eq('knowledge_point_id', kp.id);

            if (deleteError) {
              logger.error(`Failed to delete existing chunks for ${kp.id}:`, deleteError);
              continue;
            }

            const { data: insertedChunks, error: insertError } = await supabase
              .from('document_chunks')
              .insert(
                chunks.map(chunk => ({
                  knowledge_point_id: kp.id,
                  chunk_index: chunk.index,
                  content: chunk.content
                }))
              )
              .select('id, content');

            if (insertError || !insertedChunks) {
              logger.error(`Failed to insert chunks for ${kp.id}:`, insertError);
              continue;
            }

            const chunkTexts = insertedChunks.map(c => c.content);
            const chunkEmbeddings = await aiService.generateEmbeddingsBatch(chunkTexts);

            for (let k = 0; k < insertedChunks.length; k++) {
              if (chunkEmbeddings[k]) {
                const { error: updateChunkError } = await supabase
                  .from('document_chunks')
                  .update({ embedding: chunkEmbeddings[k] })
                  .eq('id', insertedChunks[k].id);

                if (updateChunkError) {
                  logger.error(`Failed to update chunk embedding for ${insertedChunks[k].id}:`, updateChunkError);
                }
              }
            }

            await this.sleep(EMBEDDING_DELAY_MS);
          } catch (error) {
            logger.error(`Failed to process chunks for knowledge point ${kp.id}:`, error);
          }
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
