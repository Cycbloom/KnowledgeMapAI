import { SupabaseClient } from '@supabase/supabase-js';
import { aiService } from './aiService';
import { logger } from '../../utils/logger';

const BATCH_SIZE = 20;
const EMBEDDING_DELAY_MS = 100;

export class EmbeddingService {
  private isRunning = false;
  private stopRequested = false;

  async generateEmbeddingsBatch(
    supabase: SupabaseClient,
    limit: number = 100
  ): Promise<{ processed: number; failed: number }> {
    if (this.isRunning) {
      logger.warn('Embedding generation already in progress');
      return { processed: 0, failed: 0 };
    }

    this.isRunning = true;
    this.stopRequested = false;
    let processed = 0;
    let failed = 0;

    try {
      const { data: knowledgePoints, error } = await supabase
        .from('knowledge_points')
        .select('id, title, content')
        .is('embedding', null)
        .limit(limit);

      if (error) {
        logger.error('Failed to fetch knowledge points without embedding:', error);
        return { processed: 0, failed: 0 };
      }

      if (!knowledgePoints || knowledgePoints.length === 0) {
        logger.info('No knowledge points without embedding found');
        return { processed: 0, failed: 0 };
      }

      logger.info(`Processing ${knowledgePoints.length} knowledge points without embedding`);

      for (let i = 0; i < knowledgePoints.length; i += BATCH_SIZE) {
        if (this.stopRequested) {
          logger.info('Embedding generation stopped by request');
          break;
        }

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
              } else {
                processed++;
              }
            } else {
              failed++;
            }
          }

          if (i + BATCH_SIZE < knowledgePoints.length) {
            await this.sleep(EMBEDDING_DELAY_MS);
          }
        } catch (error) {
          logger.error(`Failed to generate embeddings for batch starting at ${i}:`, error);
          failed += batch.length;
        }
      }

      logger.info(`Embedding generation completed: ${processed} processed, ${failed} failed`);
      return { processed, failed };
    } finally {
      this.isRunning = false;
    }
  }

  async generateEmbeddingForKnowledgePoint(
    supabase: SupabaseClient,
    knowledgePointId: string
  ): Promise<boolean> {
    try {
      const { data: kp, error } = await supabase
        .from('knowledge_points')
        .select('title')
        .eq('id', knowledgePointId)
        .single();

      if (error || !kp) {
        logger.error(`Failed to fetch knowledge point ${knowledgePointId}:`, error);
        return false;
      }

      const embedding = await aiService.generateEmbedding(kp.title);

      if (!embedding) {
        logger.error(`Failed to generate embedding for ${knowledgePointId}`);
        return false;
      }

      const { error: updateError } = await supabase
        .from('knowledge_points')
        .update({ embedding })
        .eq('id', knowledgePointId);

      if (updateError) {
        logger.error(`Failed to update embedding for ${knowledgePointId}:`, updateError);
        return false;
      }

      return true;
    } catch (error) {
      logger.error(`Error generating embedding for ${knowledgePointId}:`, error);
      return false;
    }
  }

  stop() {
    this.stopRequested = true;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      stopRequested: this.stopRequested
    };
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const embeddingService = new EmbeddingService();
