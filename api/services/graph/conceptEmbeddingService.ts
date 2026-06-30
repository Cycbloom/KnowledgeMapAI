import { SupabaseClient } from "@supabase/supabase-js";
import { aiService } from "../ai/aiService";
import { logger } from "../../utils/logger";

const BATCH_SIZE = 50;

export class ConceptEmbeddingService {
  async generateEmbeddingForConcept(
    supabase: SupabaseClient,
    knowledgePointId: string,
  ): Promise<boolean> {
    const { data: kp, error } = await supabase
      .from("knowledge_points")
      .select("title, content")
      .eq("id", knowledgePointId)
      .single();

    if (error || !kp) {
      logger.error(`Knowledge point not found: ${knowledgePointId}`);
      return false;
    }

    const textToEmbed = kp.content
      ? `${kp.title}: ${kp.content.slice(0, 500)}`
      : kp.title;

    const embedding = await aiService.generateEmbedding(textToEmbed);

    if (!embedding) {
      logger.error(`Failed to generate embedding for ${knowledgePointId}`);
      return false;
    }

    const { error: updateError } = await supabase
      .from("knowledge_points")
      .update({ embedding })
      .eq("id", knowledgePointId);

    if (updateError) {
      logger.error(
        `Failed to update embedding for ${knowledgePointId}:`,
        updateError,
      );
      return false;
    }

    return true;
  }

  async generateEmbeddingsBatch(
    supabase: SupabaseClient,
    knowledgePointIds: string[],
  ): Promise<{ processed: number; failed: number }> {
    let processed = 0;
    let failed = 0;

    for (let i = 0; i < knowledgePointIds.length; i += BATCH_SIZE) {
      const batch = knowledgePointIds.slice(i, i + BATCH_SIZE);

      const { data: kps, error } = await supabase
        .from("knowledge_points")
        .select("id, title, content")
        .in("id", batch);

      if (error || !kps) {
        failed += batch.length;
        continue;
      }

      const texts = kps.map((kp) =>
        kp.content ? `${kp.title}: ${kp.content.slice(0, 500)}` : kp.title,
      );

      const embeddings = await aiService.generateEmbeddingsBatch(texts);

      for (let j = 0; j < kps.length; j++) {
        if (embeddings[j]) {
          const { error: updateError } = await supabase
            .from("knowledge_points")
            .update({ embedding: embeddings[j] })
            .eq("id", kps[j].id);

          if (updateError) {
            failed++;
          } else {
            processed++;
          }
        } else {
          failed++;
        }
      }
    }

    logger.info(
      `Batch embedding generation: ${processed} processed, ${failed} failed`,
    );

    return { processed, failed };
  }
}

export const conceptEmbeddingService = new ConceptEmbeddingService();
