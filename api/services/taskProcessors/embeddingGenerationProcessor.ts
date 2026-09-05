import { SupabaseClient } from '@supabase/supabase-js';
import { TaskProcessor, registerProcessor, UpdateTaskStatusFunction, TaskControl, TaskAbortError } from './index';
import { aiService } from '../ai/aiService';
import { chunkingService } from '../ai/chunkingService';
import { chunkContextService } from '../ai/chunkContextService';
import { logger } from '../../utils/logger';
import { notDeleted } from '../common/softDeleteHelper';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import { resolveLocalizedText, type LocalizedText } from '../../../shared/utils/localization';
import { serializeSparse } from '../../utils/sparse';

const BATCH_SIZE = 20;
const EMBEDDING_DELAY_MS = 100;
const CHUNK_CONTENT_THRESHOLD = 500;
const NOTE_CHUNK_TEXT_MAX_LENGTH = 2000; // 与 notesService CHUNK_TEXT_MAX_LENGTH 一致

export class EmbeddingGenerationProcessor implements TaskProcessor {
  async process(
    taskId: string,
    userId: string,
    payload: Record<string, unknown>,
    supabase: SupabaseClient,
    updateTaskStatus: UpdateTaskStatusFunction,
    control: TaskControl
  ): Promise<void> {
    logger.info(`Starting embedding generation task ${taskId} for user ${userId}`, { payload });
    
    try {
      await updateTaskStatus(supabase, taskId, 'in_progress', undefined, undefined, undefined, userId);

      const { graphId, knowledgePointIds, scope } = payload;
      const isAllScope = scope === "all";

      let knowledgePoints: Array<{ id: string; title: string; content: string | null }> = [];
      let graphsToBackfill: Array<{ id: string; title: string }> = [];
      let notesToBackfill: Array<{ id: string; content: string }> = [];

      if (isAllScope) {
        // 全量回填：当前用户缺失 embedding 的知识点 + 图谱
        const { data, error } = await supabase
          .from('knowledge_points')
          .select('id, title, content')
          .eq('owner_id', userId)
          .is('embedding', null);

        if (error) {
          throw new AppError(`Failed to fetch knowledge points: ${error.message}`, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
        }
        knowledgePoints = (data || []).map((kp) => ({
          id: kp.id,
          title: resolveLocalizedText(kp.title as LocalizedText),
          content: kp.content ? resolveLocalizedText(kp.content as LocalizedText) : '',
        }));

        const { data: graphs, error: graphError } = await notDeleted(supabase
          .from('knowledge_graphs')
          .select('id, title')
          .eq('user_id', userId)
          .is('embedding', null)
          );

        if (graphError) {
          throw new AppError(`Failed to fetch graphs: ${graphError.message}`, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
        }
        graphsToBackfill = (graphs || []).map((g) => ({ id: g.id, title: g.title ?? '' }));

        // 笔记向量补全：备份不存向量，恢复时 notes 直接落库、绕过 notesService 的
        // refreshEmbedding（仅在创建/更新时触发），因此 all-scope 在此补全缺失的
        // 笔记向量（dense + sparse），否则恢复后笔记检索（语义 + 稀疏）静默为空
        const { data: notes, error: notesError } = await supabase
          .from('notes')
          .select('id, content, note_embeddings(note_id)')
          .eq('user_id', userId)
          .is('deleted_at', null);

        if (notesError) {
          throw new AppError(`Failed to fetch notes: ${notesError.message}`, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
        }
        notesToBackfill = (notes || [])
          .filter((n) => {
            const embeddings = n.note_embeddings as unknown as { note_id: string }[] | null;
            return !embeddings || embeddings.length === 0;
          })
          .map((n) => ({ id: n.id, content: n.content ?? '' }));
      } else if (knowledgePointIds && Array.isArray(knowledgePointIds) && knowledgePointIds.length > 0) {
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
            const kpArray = gn.knowledge_points as unknown as { id: string; title: unknown; content: unknown; embedding: number[] | null }[] | null;
            const kp = kpArray?.[0];
            return kp && kp.embedding === null;
          })
          .map((gn) => {
            const kpArray = gn.knowledge_points as unknown as { id: string; title: unknown; content: unknown }[] | null;
            const kp = kpArray?.[0];
            if (!kp) {
              return null;
            }
            return {
              id: kp.id,
              title: resolveLocalizedText(kp.title as LocalizedText),
              content: resolveLocalizedText(kp.content as LocalizedText)
            };
          })
          .filter((kp): kp is { id: string; title: string; content: string } => kp !== null);
      } else {
        throw new AppError('Either graphId or knowledgePointIds must be provided', 400, ErrorCodes.VALIDATION_ERROR);
      }

      if (knowledgePoints.length === 0 && graphsToBackfill.length === 0 && notesToBackfill.length === 0) {
        await updateTaskStatus(supabase, taskId, 'completed', {
          success: true,
          processed: 0,
          failed: 0,
          message: 'No knowledge points, graphs or notes need embedding generation'
        }, undefined, undefined, userId);
        return;
      }

      logger.info(`Processing ${knowledgePoints.length} knowledge points for embedding generation`);

      // 全量回填进度口径含笔记阶段（知识点阶段 + 图谱阶段 + 笔记阶段）
      const totalWork = knowledgePoints.length + graphsToBackfill.length + notesToBackfill.length;
      const pointsProgress = (done: number) =>
        isAllScope
          ? Math.round((Math.min(done, knowledgePoints.length) / Math.max(1, totalWork)) * 100)
          : Math.round((Math.min(done, knowledgePoints.length) / Math.max(1, knowledgePoints.length)) * 100);
      const graphsProgress = (done: number) =>
        Math.round(((knowledgePoints.length + Math.min(done, graphsToBackfill.length)) / Math.max(1, totalWork)) * 100);
      const notesProgress = (done: number) =>
        Math.round(((knowledgePoints.length + graphsToBackfill.length + Math.min(done, notesToBackfill.length)) / Math.max(1, totalWork)) * 100);

      let processed = 0;
      let failed = 0;
      const failedIds: string[] = [];

      for (let i = 0; i < knowledgePoints.length; i += BATCH_SIZE) {
        control.throwIfAborted();
        const batch = knowledgePoints.slice(i, i + BATCH_SIZE);
        const texts = batch.map(kp => kp.title);

        try {
          const embeddings = await aiService.generateEmbeddingsBatch(texts);

          for (let j = 0; j < batch.length; j++) {
            if (embeddings[j]) {
              // 同步生成稀疏向量（provider 不支持时返回 null，sparse 通道缺省不阻塞）
              const sparse = await aiService.generateSparseEmbedding(batch[j].title);
              const { error: updateError } = await supabase
                .from('knowledge_points')
                .update({
                  embedding: embeddings[j],
                  sparse_embedding: sparse ? serializeSparse(sparse) : null,
                })
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

          const progress = pointsProgress(i + batch.length);
          await updateTaskStatus(supabase, taskId, 'in_progress', {
            progress,
            processed,
            failed,
            total: totalWork
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

      // 长内容知识点重建分块（chunk 的 dense + sparse 向量随分块生成）。
      // all-scope 不能跳过：备份不存向量也不含 document_chunks 表，恢复后这里是
      // 分块重建的唯一入口，跳过会导致分块级检索（含 chunk 稀疏通道）静默为空
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
              .select('id, chunk_index, content');

            if (insertError || !insertedChunks) {
              logger.error(`Failed to insert chunks for ${kp.id}:`, insertError);
              continue;
            }

            // Contextual Retrieval：为分块生成上下文定位说明（整篇文档语境），
            // embedding / sparse 按 context + content 计算，content 保持原文用于展示。
            // 生成失败（无 AI key / 超时 / JSON 解析失败）降级为无上下文，不阻塞索引。
            const contextMap = await chunkContextService.generateChunkContexts({
              userId,
              documentTitle: resolveLocalizedText(kp.title as unknown as LocalizedText),
              documentContent: content,
              chunks: insertedChunks.map(c => ({ index: c.chunk_index, content: c.content })),
            });

            const chunkTexts = insertedChunks.map(c => {
              const ctx = contextMap.get(c.chunk_index);
              return ctx ? `${ctx}\n\n${c.content}` : c.content;
            });
            const chunkEmbeddings = await aiService.generateEmbeddingsBatch(chunkTexts);

            for (let k = 0; k < insertedChunks.length; k++) {
              if (chunkEmbeddings[k]) {
                // 分块同样生成稀疏向量（输入与 dense 一致：context + content），供分块级关键词检索
                const chunkSparse = await aiService.generateSparseEmbedding(chunkTexts[k]);
                const { error: updateChunkError } = await supabase
                  .from('document_chunks')
                  .update({
                    embedding: chunkEmbeddings[k],
                    sparse_embedding: chunkSparse ? serializeSparse(chunkSparse) : null,
                    context: contextMap.get(insertedChunks[k].chunk_index) ?? null,
                  })
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

      if (graphsToBackfill.length > 0) {
        logger.info(`Processing ${graphsToBackfill.length} knowledge graphs for embedding generation`);

        for (let i = 0; i < graphsToBackfill.length; i += BATCH_SIZE) {
          control.throwIfAborted();
          const batch = graphsToBackfill.slice(i, i + BATCH_SIZE);
          const texts = batch.map(g => g.title);

          try {
            const embeddings = await aiService.generateEmbeddingsBatch(texts);

            for (let j = 0; j < batch.length; j++) {
              if (embeddings[j]) {
                const sparse = await aiService.generateSparseEmbedding(batch[j].title);
                const { error: updateError } = await supabase
                  .from('knowledge_graphs')
                  .update({
                    embedding: embeddings[j],
                    sparse_embedding: sparse ? serializeSparse(sparse) : null,
                  })
                  .eq('id', batch[j].id);

                if (updateError) {
                  logger.error(`Failed to update graph embedding for ${batch[j].id}:`, updateError);
                  failed++;
                } else {
                  processed++;
                }
              } else {
                failed++;
              }
            }

            const progress = graphsProgress(i + batch.length);
            await updateTaskStatus(supabase, taskId, 'in_progress', {
              progress,
              processed,
              failed,
              total: totalWork
            }, undefined, undefined, userId);

            if (i + BATCH_SIZE < graphsToBackfill.length) {
              await this.sleep(EMBEDDING_DELAY_MS);
            }
          } catch (error) {
            logger.error(`Failed to generate graph embeddings for batch starting at ${i}:`, error);
            failed += batch.length;
          }
        }
      }

      // 笔记阶段：逐条生成 dense + sparse 并 upsert（note_id 唯一，重复导入幂等）
      for (let n = 0; n < notesToBackfill.length; n++) {
        control.throwIfAborted();
        const note = notesToBackfill[n];
        try {
          if (note.content && note.content.trim()) {
            const embedding = await aiService.generateEmbedding(note.content);
            if (!embedding) {
              failed++;
              failedIds.push(note.id);
            } else {
              const sparse = await aiService.generateSparseEmbedding(note.content);
              const { error: upsertError } = await supabase
                .from('note_embeddings')
                .upsert(
                  {
                    note_id: note.id,
                    embedding,
                    sparse_embedding: sparse ? serializeSparse(sparse) : null,
                    chunk_text: note.content.slice(0, NOTE_CHUNK_TEXT_MAX_LENGTH),
                  },
                  { onConflict: 'note_id' },
                );

              if (upsertError) {
                logger.error(`Failed to upsert note embedding for ${note.id}:`, upsertError);
                failed++;
                failedIds.push(note.id);
              } else {
                processed++;
              }
            }
          } else {
            // 空内容笔记无向量可生成，计入完成以保持进度口径一致
            processed++;
          }
        } catch (error) {
          logger.error(`Failed to generate note embedding for ${note.id}:`, error);
          failed++;
          failedIds.push(note.id);
        }

        await updateTaskStatus(supabase, taskId, 'in_progress', {
          progress: notesProgress(n + 1),
          processed,
          failed,
          total: totalWork
        }, undefined, undefined, userId);

        if (n + 1 < notesToBackfill.length) {
          await this.sleep(EMBEDDING_DELAY_MS);
        }
      }

      logger.info(`Embedding generation completed: ${processed} processed, ${failed} failed`);

      await updateTaskStatus(supabase, taskId, 'completed', {
        success: true,
        processed,
        failed,
        total: totalWork,
        failedIds: failedIds.length > 0 ? failedIds : undefined
      }, undefined, undefined, userId);

    } catch (error: unknown) {
      if (error instanceof TaskAbortError) {
        logger.info(`Embedding generation task ${taskId} ${error.reason}`);
        await updateTaskStatus(supabase, taskId, error.reason, undefined, undefined, undefined, userId);
        return;
      }
      logger.error(`Embedding generation task ${taskId} failed:`, error);
      await updateTaskStatus(supabase, taskId, 'failed', null, undefined, error instanceof Error ? error.message : 'Unknown error', userId);
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

registerProcessor('embedding_generation', new EmbeddingGenerationProcessor());
