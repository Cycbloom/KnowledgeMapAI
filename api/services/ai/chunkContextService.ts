import { getSupabaseAdmin } from "../../supabase";
import { getAIProviderForTask } from "./factory";
import { logger } from "../../utils/logger";
import { promptService } from "./promptService";
import { withTimeoutAndRetry } from "../../../shared/utils/retry";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AIProvider } from "@shared/types";

/**
 * Contextual Retrieval（Anthropic）：分块入库前用 LLM 生成上下文定位说明。
 *
 * 分块脱离原文语境后（"它比之前提升了 30%"），向量与稀疏检索都难以命中。
 * 这里把每个分块放回整篇文档语境，生成 1-2 句定位说明，embedding / sparse
 * 按 context + content 计算，content 本身保持原文用于检索结果展示。
 * 参考Anthropic 工程博客：contextual embeddings + contextual BM25 可减少
 * ~49% 检索失败，配合 rerank 约 67%。
 *
 * 设计约束（对齐 queryRewriteService）：
 * - prompt 从 DB（prompt_templates.chunk_contextualize）渲染，DEFAULT_PROMPTS 降级兜底
 * - 一个知识点全部分块单次 LLM 调用批量生成（比逐块调用省一个数量级成本），
 *   超过 MAX_CHUNKS_PER_CALL 分多批
 * - 任何失败（无 AI key / 超时 / JSON 解析失败）都降级为"无上下文"，
 *   分块向量化回退到原文，绝不阻塞索引主链路
 */

// 单次 LLM 调用最多处理的分块数（控制输出长度与单批失败影响面）
const MAX_CHUNKS_PER_CALL = 30;
// prompt 中文档正文/分块文本的截断长度（上下文定位不需要全文精确，控制输入成本）
const DOCUMENT_SNIPPET_LIMIT = 6000;
const CHUNK_SNIPPET_LIMIT = 600;
// 单条上下文说明的最大长度（超出截断，防止模型输出跑飞撑爆 embedding 输入）
const CONTEXT_MAX_LENGTH = 300;

/**
 * 解析 LLM 返回的分块上下文 JSON。
 * 兼容裸数组、markdown 代码块包裹、前后夹杂说明文字三种形态；
 * 只保留请求过的 index，context 非空且截断到 CONTEXT_MAX_LENGTH。
 */
export function parseContextResponse(
  raw: string,
  validIndices: ReadonlySet<number>,
): Map<number, string> {
  const result = new Map<number, string>();
  try {
    let text = raw.trim();
    // 去掉 markdown 代码块围栏
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

    let parsed: unknown = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      // 模型可能在 JSON 前后夹了说明文字，截取最外层数组再试
      const start = text.indexOf("[");
      const end = text.lastIndexOf("]");
      if (start < 0 || end <= start) return result;
      try {
        parsed = JSON.parse(text.slice(start, end + 1));
      } catch {
        return result;
      }
    }

    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      // 兼容 { "contexts": [...] } 包裹形态
      const wrapped = (parsed as { contexts?: unknown }).contexts;
      if (Array.isArray(wrapped)) parsed = wrapped;
    }
    if (!Array.isArray(parsed)) return result;

    for (const item of parsed) {
      const entry = item as { index?: unknown; context?: unknown };
      if (typeof entry.index !== "number" || typeof entry.context !== "string") continue;
      if (!validIndices.has(entry.index)) continue;
      const context = entry.context.trim();
      if (!context) continue;
      result.set(entry.index, context.slice(0, CONTEXT_MAX_LENGTH));
    }
  } catch {
    return result;
  }
  return result;
}

export interface ChunkContextInput {
  /** 触发索引的用户（用于 prompt 模板个性化解析），可空 */
  userId?: string;
  /** 所属文档（知识点）标题 */
  documentTitle: string;
  /** 所属文档（知识点）完整内容 */
  documentContent: string;
  /** 待生成上下文的分块列表 */
  chunks: { index: number; content: string }[];
}

export class ChunkContextService {
  /**
   * 为一组分块批量生成上下文说明。返回 index → context 映射；
   * 未出现在映射中的分块按"无上下文"处理（向量化回退原文）。
   */
  async generateChunkContexts(params: ChunkContextInput): Promise<Map<number, string>> {
    const { userId, documentTitle, documentContent, chunks } = params;
    const empty = new Map<number, string>();
    if (!chunks || chunks.length === 0) return empty;

    try {
      const aiProvider = await getAIProviderForTask("text");
      if (!aiProvider.hasKey) return empty;

      const supabase = getSupabaseAdmin();
      const merged = new Map<number, string>();

      for (let i = 0; i < chunks.length; i += MAX_CHUNKS_PER_CALL) {
        const batch = chunks.slice(i, i + MAX_CHUNKS_PER_CALL);
        const batchResult = await this.contextualizeBatch({
          aiProvider,
          supabase,
          userId,
          documentTitle,
          documentContent,
          batch,
        });
        for (const [index, context] of batchResult) {
          merged.set(index, context);
        }
      }

      if (merged.size < chunks.length) {
        logger.info("[ChunkContext] partial context coverage", {
          total: chunks.length,
          contextualized: merged.size,
        });
      }
      return merged;
    } catch (error) {
      logger.warn("[ChunkContext] generateChunkContexts failed, fallback to no context", {
        message: error instanceof Error ? error.message : String(error),
      });
      return empty;
    }
  }

  private async contextualizeBatch(params: {
    aiProvider: AIProvider;
    supabase: SupabaseClient;
    userId?: string;
    documentTitle: string;
    documentContent: string;
    batch: { index: number; content: string }[];
  }): Promise<Map<number, string>> {
    const { aiProvider, supabase, userId, documentTitle, documentContent, batch } = params;
    const empty = new Map<number, string>();

    const systemPrompt = await promptService.getRenderedPrompt(
      supabase,
      "chunk_contextualize",
      {
        documentTitle,
        documentContent: documentContent.slice(0, DOCUMENT_SNIPPET_LIMIT),
        chunksJson: JSON.stringify(
          batch.map((c) => ({ index: c.index, text: c.content.slice(0, CHUNK_SNIPPET_LIMIT) })),
        ),
      },
      userId,
    );

    const completion = await withTimeoutAndRetry(
      async () =>
        aiProvider.client.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: "请按要求输出 JSON 数组。" },
          ],
          model: aiProvider.model,
          temperature: 0,
          max_tokens: Math.min(8000, batch.length * 120 + 300),
        }),
      { timeout: 30000, maxRetries: 1 },
    );

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) return empty;

    const parsed = parseContextResponse(raw, new Set(batch.map((c) => c.index)));
    if (parsed.size > 0) {
      logger.info("[ChunkContext] contextualized chunk batch", {
        documentTitle: documentTitle.slice(0, 50),
        requested: batch.length,
        ok: parsed.size,
      });
    }
    return parsed;
  }
}

export const chunkContextService = new ChunkContextService();
