import { getSupabaseAdmin } from "../../supabase";
import { getAIProviderForTask } from "./factory";
import { logger } from "../../utils/logger";
import { promptService } from "./promptService";
import { withTimeoutAndRetry } from "../../../shared/utils/retry";

/**
 * 检索查询改写（Query Rewrite）。
 *
 * 用户口语化提问直接用于向量/关键词检索命中率低（query 与 doc 存在语义鸿沟）。
 * 这里用主 AI 把问题改写为检索友好表达：提取核心术语、去除冗余、保留型号/编号。
 *
 * 设计约束（对齐项目规范）：
 * - prompt 从 DB（prompt_templates.query_rewrite）渲染，不硬编码（DEFAULT_PROMPTS 仅作降级兜底）
 * - 任何失败（无 AI key / 超时 / 返回空）都回退原文，绝不阻塞检索主链路
 * - 用 withTimeoutAndRetry 控制延迟与重试，避免为改写付出过高 RT 代价
 */
export class QueryRewriteService {
  /**
   * 改写用户问题为检索友好查询。
   * @param query 用户原始问题
   * @param userId 用户 ID（用于 prompt 渲染上下文）
   * @param options.language 语言（zh-CN / en-US）
   * @returns 改写后的查询；任何异常或空结果时返回原文
   */
  async rewrite(
    query: string,
    userId: string,
    options: { language?: string } = {},
  ): Promise<string> {
    const trimmed = query.trim();
    if (!trimmed) return query;

    // 过短的查询无需改写（改写可能引入噪声）
    if (trimmed.length <= 6) return query;

    try {
      const aiProvider = await getAIProviderForTask("text");
      if (!aiProvider.hasKey) return query;

      const supabase = getSupabaseAdmin();
      const systemPrompt = await promptService.getRenderedPrompt(
        supabase,
        "query_rewrite",
        { query: trimmed },
        userId,
        undefined,
        options.language,
      );

      const rewritten = await withTimeoutAndRetry(
        async () => {
          const completion = await aiProvider.client.chat.completions.create({
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: trimmed },
            ],
            model: aiProvider.model,
            temperature: 0,
            max_tokens: 80,
          });
          return completion.choices[0]?.message?.content?.trim() ?? "";
        },
        { timeout: 8000, maxRetries: 1 },
      );

      if (!rewritten || rewritten.length === 0 || rewritten.length > 200) {
        return query;
      }

      logger.info("[QueryRewrite] query rewritten", {
        from: trimmed.slice(0, 80),
        to: rewritten.slice(0, 80),
      });
      return rewritten;
    } catch (error) {
      // 改写失败不阻塞检索，回退原文
      logger.warn("[QueryRewrite] rewrite failed, fallback to original query", {
        message: error instanceof Error ? error.message : String(error),
      });
      return query;
    }
  }
}

export const queryRewriteService = new QueryRewriteService();
