import dotenv from 'dotenv';
import { getSupabaseAdmin } from '../api/supabase.js';
import { AIService } from '../api/services/ai/aiService.js';
import { chunkContextService } from '../api/services/ai/chunkContextService.js';
import { serializeSparse } from '../api/utils/sparse.js';
import { resolveLocalizedText, type LocalizedText } from '../shared/utils/localization.js';
import { logger } from '../api/utils/logger.js';

dotenv.config();

const aiService = new AIService();
const API_DELAY_MS = 200;

/**
 * 为四类数据源批量重建 dense + sparse 向量：
 *   knowledge_points（title）/ knowledge_graphs（title）/ document_chunks（content）
 *   / notes → note_embeddings（content）
 *
 * 强制重新生成所有行（不按 embedding IS NULL 过滤）：sparse 索引基准修复
 * （api/utils/sparse.ts 移除 0/1-based 逐条猜测）后，存量 sparse 数据可能
 * 行间基准不一致，必须全量重刷才能保证内积匹配正确。
 *
 * 文本口径与在线管线对齐：
 *   - 知识点/图谱用 title（embeddingService.generateEmbeddingForKnowledgePoint、
 *     embeddingGenerationProcessor 同口径）
 *   - 分块用 content，笔记用 content（notesService.refreshEmbedding 同口径）
 */
async function embedAndWrite(
  label: string,
  text: string,
  apply: (embedding: number[], sparseText: string | null) => Promise<{ error: unknown } | null>,
): Promise<boolean> {
  if (!text || !text.trim()) {
    logger.warn(`[跳过] ${label} 文本为空`);
    return false;
  }

  const embedding = await aiService.generateEmbedding(text);
  if (!embedding) {
    logger.info(`❌ ${label} AI 未返回向量`);
    return false;
  }

  const sparse = await aiService.generateSparseEmbedding(text);
  const { error } = await apply(embedding, sparse ? serializeSparse(sparse) : null);
  if (error) {
    throw error;
  }
  return true;
}

async function backfillKnowledgePoints(): Promise<[number, number]> {
  const { data: rows, error } = await getSupabaseAdmin()
    .from('knowledge_points')
    .select('id, title');

  if (error) throw error;
  let ok = 0;
  let fail = 0;
  for (const row of (rows || []) as { id: string; title: LocalizedText }[]) {
    process.stdout.write(`知识点 ${row.id}... `);
    try {
      const success = await embedAndWrite(
        `知识点 ${row.id}`,
        resolveLocalizedText(row.title),
        async (embedding, sparseText) =>
          getSupabaseAdmin()
            .from('knowledge_points')
            .update({ embedding, sparse_embedding: sparseText })
            .eq('id', row.id),
      );
      if (success) ok++; else fail++;
    } catch (err) {
      logger.error(`知识点 ${row.id} 处理出错:`, err);
      fail++;
    }
    await new Promise((resolve) => setTimeout(resolve, API_DELAY_MS));
  }
  return [ok, fail];
}

async function backfillKnowledgeGraphs(): Promise<[number, number]> {
  const { data: rows, error } = await getSupabaseAdmin()
    .from('knowledge_graphs')
    .select('id, title');

  if (error) throw error;
  let ok = 0;
  let fail = 0;
  for (const row of (rows || []) as { id: string; title: string | null }[]) {
    process.stdout.write(`图谱 ${row.id}... `);
    try {
      const success = await embedAndWrite(
        `图谱 ${row.id}`,
        row.title ?? '',
        async (embedding, sparseText) =>
          getSupabaseAdmin()
            .from('knowledge_graphs')
            .update({ embedding, sparse_embedding: sparseText })
            .eq('id', row.id),
      );
      if (success) ok++; else fail++;
    } catch (err) {
      logger.error(`图谱 ${row.id} 处理出错:`, err);
      fail++;
    }
    await new Promise((resolve) => setTimeout(resolve, API_DELAY_MS));
  }
  return [ok, fail];
}

async function backfillDocumentChunks(): Promise<[number, number]> {
  const supabase = getSupabaseAdmin();
  const { data: rows, error } = await supabase
    .from('document_chunks')
    .select('id, chunk_index, content, knowledge_point_id');

  if (error) throw error;
  const chunks = (rows || []) as {
    id: string;
    chunk_index: number;
    content: string | null;
    knowledge_point_id: string;
  }[];

  // 按知识点分组：Contextual Retrieval 的上下文说明以整篇文档（知识点）为单位批量生成，
  // 与 embeddingGenerationProcessor 分块阶段同口径（embedding/sparse 按 context + content 计算）
  const byKp = new Map<string, typeof chunks>();
  for (const c of chunks) {
    const list = byKp.get(c.knowledge_point_id) ?? [];
    list.push(c);
    byKp.set(c.knowledge_point_id, list);
  }

  const kpIds = [...byKp.keys()];
  const { data: kps, error: kpError } = await supabase
    .from('knowledge_points')
    .select('id, title, content')
    .in('id', kpIds);
  if (kpError) throw kpError;
  const kpById = new Map(
    ((kps || []) as { id: string; title: LocalizedText; content: LocalizedText }[]).map((kp) => [
      kp.id,
      kp,
    ]),
  );

  let ok = 0;
  let fail = 0;
  for (const [kpId, kpChunks] of byKp) {
    const kp = kpById.get(kpId);
    process.stdout.write(`分块组 ${kpId}（${kpChunks.length} 块）... `);
    try {
      const contextMap = kp
        ? await chunkContextService.generateChunkContexts({
            documentTitle: resolveLocalizedText(kp.title),
            documentContent: resolveLocalizedText(kp.content),
            chunks: kpChunks.map((c) => ({ index: c.chunk_index, content: c.content ?? '' })),
          })
        : new Map<number, string>();

      for (const row of kpChunks) {
        const ctx = contextMap.get(row.chunk_index) ?? null;
        const rawContent = row.content ?? '';
        const text = ctx ? `${ctx}\n\n${rawContent}` : rawContent;
        try {
          const success = await embedAndWrite(
            `分块 ${row.id}`,
            text,
            async (embedding, sparseText) =>
              supabase
                .from('document_chunks')
                .update({ embedding, sparse_embedding: sparseText, context: ctx })
                .eq('id', row.id),
          );
          if (success) ok++; else fail++;
        } catch (err) {
          logger.error(`分块 ${row.id} 处理出错:`, err);
          fail++;
        }
        await new Promise((resolve) => setTimeout(resolve, API_DELAY_MS));
      }
    } catch (err) {
      logger.error(`分块组 ${kpId} 处理出错:`, err);
      fail += kpChunks.length;
    }
  }
  return [ok, fail];
}

const NOTE_CHUNK_TEXT_MAX_LENGTH = 2000; // 与 notesService CHUNK_TEXT_MAX_LENGTH 一致

async function backfillNoteEmbeddings(): Promise<[number, number]> {
  const { data: rows, error } = await getSupabaseAdmin()
    .from('notes')
    .select('id, content')
    .is('deleted_at', null);

  if (error) throw error;
  let ok = 0;
  let fail = 0;
  for (const row of (rows || []) as { id: string; content: string | null }[]) {
    process.stdout.write(`笔记 ${row.id}... `);
    try {
      const success = await embedAndWrite(
        `笔记 ${row.id}`,
        row.content ?? '',
        async (embedding, sparseText) =>
          getSupabaseAdmin()
            .from('note_embeddings')
            .upsert(
              {
                note_id: row.id,
                embedding,
                sparse_embedding: sparseText,
                chunk_text: (row.content ?? '').slice(0, NOTE_CHUNK_TEXT_MAX_LENGTH),
              },
              { onConflict: 'note_id' },
            ),
      );
      if (success) ok++; else fail++;
    } catch (err) {
      logger.error(`笔记 ${row.id} 处理出错:`, err);
      fail++;
    }
    await new Promise((resolve) => setTimeout(resolve, API_DELAY_MS));
  }
  return [ok, fail];
}

async function main() {
  logger.info('🚀 开始批量重建四类数据源的 dense + sparse 向量...');

  const targets: [string, () => Promise<[number, number]>][] = [
    ['knowledge_points', backfillKnowledgePoints],
    ['knowledge_graphs', backfillKnowledgeGraphs],
    ['document_chunks', backfillDocumentChunks],
    ['notes → note_embeddings', backfillNoteEmbeddings],
  ];

  for (const [name, run] of targets) {
    logger.info(`\n=== ${name} ===`);
    try {
      const [ok, fail] = await run();
      logger.info(`✨ ${name} 完成: 成功 ${ok}，失败 ${fail}`);
    } catch (err) {
      logger.error(`❌ ${name} 批次失败:`, err);
    }
  }

  logger.info('\n✨ 全部批次结束');
}

main().catch((err) => {
  logger.error('脚本运行出错:', err);
  process.exit(1);
});
