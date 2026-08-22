import { SupabaseClient } from "@supabase/supabase-js";
import { TemplateEngine } from "../../utils/templateEngine";
import { cacheService, CacheKeys } from "../common/cacheService";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { getAIProviderForTask } from "./factory";
import { getSupabaseAdmin } from "../../supabase";
import {
  type PromptScope,
  type PromptTemplate,
  type PromptListOptions,
  type PromptCreateData,
  type PromptUpdateData,
  isEnglishLanguage,
  getLanguageInstruction,
  DEFAULT_PROMPTS,
  OUTPUT_SCHEMAS,
} from "./promptConstants";
import type { LearningMaterialSchema, LearningMaterialSection } from "@shared/types";

export type { PromptScope, PromptTemplate, PromptListOptions, PromptCreateData, PromptUpdateData };
export { getLanguageInstruction };

const DEFAULT_SCOPE = "system";

/**
 * 用 DEFAULT_PROMPTS 补齐 DB 中缺失的 system scope 模板。
 * 遵守"DB 权威、DEFAULT 仅作回退"原则：
 * - DB 已有同 code 的 system 行 → 保留 DB 行（可能被运维修改过）
 * - DB 缺该行 → 用 DEFAULT_PROMPTS[code] 合成一条虚拟 system 行，
 *   id=null 表示它未持久化，管理界面保存时会做 INSERT（upsert）。
 * 如果有 DB 缺失的 code，会打一条 warning，提示把新 code 加到 53 seed 迁移文件里。
 */
function mergeSystemTemplatesWithDefaults(
  dbRows: PromptTemplate[] | null,
): PromptTemplate[] {
  const rows = dbRows ?? [];
  const dbByCode = new Map(rows.map((row) => [row.code, row]));
  const missingInDb: string[] = [];
  const merged = new Map<string, PromptTemplate>();

  // 先插入所有 DB 行（权威源）
  for (const row of rows) {
    merged.set(row.code, row);
  }

  // 再补 DEFAULT_PROMPTS 有、DB 没有的 code
  for (const code of Object.keys(DEFAULT_PROMPTS)) {
    if (dbByCode.has(code)) continue;
    missingInDb.push(code);
    const now = new Date().toISOString();
    merged.set(code, {
      id: null,
      code,
      scope: DEFAULT_SCOPE,
      user_id: null,
      graph_id: null,
      template_content: DEFAULT_PROMPTS[code],
      created_at: now,
      updated_at: now,
    });
  }

  if (missingInDb.length > 0) {
    logger.warn(
      `[promptService.list] DB prompt_templates (scope=system) missing ${missingInDb.length} code(s): ${missingInDb.join(
        ", ",
      )}. Add them to supabase/migrations/53_seed_prompt_templates.sql.`,
    );
  }

  return Array.from(merged.values()).sort((a, b) =>
    a.code.localeCompare(b.code),
  );
}

export class PromptService {
  async list(
    supabase: SupabaseClient,
    options: PromptListOptions = {},
  ): Promise<{
    system: PromptTemplate[];
    user: PromptTemplate[];
    graph: PromptTemplate[];
  }> {
    const { userId, graphId } = options;

    const { data: systemTemplates, error: sysError } = await supabase
      .from("prompt_templates")
      .select("*")
      .eq("scope", "system");

    if (sysError) throw sysError;

    let userQuery = supabase
      .from("prompt_templates")
      .select("*")
      .eq("scope", "user");

    if (userId) {
      userQuery = userQuery.eq("user_id", userId);
    }

    const { data: userTemplates, error: userError } = await userQuery;

    if (userError) throw userError;

    let graphTemplates: PromptTemplate[] = [];
    if (graphId) {
      const { data: gTemplates, error: gError } = await supabase
        .from("prompt_templates")
        .select("*")
        .eq("scope", "graph")
        .eq("graph_id", graphId);

      if (gError) throw gError;
      graphTemplates = gTemplates || [];
    }

    return {
      system: mergeSystemTemplatesWithDefaults(systemTemplates),
      user: userTemplates || [],
      graph: graphTemplates,
    };
  }

  async get(
    supabase: SupabaseClient,
    id: string,
  ): Promise<PromptTemplate | null> {
    const { data, error } = await supabase
      .from("prompt_templates")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw error;
    }

    return data;
  }

  async create(
    supabase: SupabaseClient,
    data: PromptCreateData,
  ): Promise<PromptTemplate> {
    const { code, scope, template_content, user_id, graph_id } = data;

    const insertData: Record<string, unknown> = {
      code,
      scope,
      template_content,
      user_id: scope === "system" ? null : user_id,
      graph_id: scope === "graph" ? graph_id : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: result, error } = await supabase
      .from("prompt_templates")
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    return result;
  }

  async update(
    supabase: SupabaseClient,
    id: string,
    data: PromptUpdateData,
  ): Promise<PromptTemplate> {
    const updateData: Record<string, unknown> = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    const { data: result, error } = await supabase
      .from("prompt_templates")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    if (result) {
      const cacheUserId = result.user_id || "system";
      const cacheGraphId = result.graph_id || "none";
      await cacheService.del(
        CacheKeys.PROMPT_TEMPLATE(result.code, cacheUserId, cacheGraphId),
      );
    }

    return result;
  }

  async delete(supabase: SupabaseClient, id: string): Promise<void> {
    const { data: temp } = await supabase
      .from("prompt_templates")
      .select("*")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("prompt_templates")
      .delete()
      .eq("id", id);

    if (error) throw error;

    if (temp) {
      const cacheUserId = temp.user_id || "system";
      const cacheGraphId = temp.graph_id || "none";
      await cacheService.del(
        CacheKeys.PROMPT_TEMPLATE(temp.code, cacheUserId, cacheGraphId),
      );
    }
  }

  /**
   * Get the final rendered prompt string
   * Includes priority logic (Graph > User > System) and Schema appending
   */
  async getRenderedPrompt(
    supabase: SupabaseClient,
    code: string,
    context: Record<string, unknown>,
    userId?: string,
    graphId?: string,
    language?: string,
  ): Promise<string> {
    const template = await this.getTemplate(supabase, code, userId, graphId);

    let content = "";
    let source: "graph" | "user" | "system" | "default" = "default";

    if (!template) {
      // DB 为唯一权威来源，所有 12 个 prompt 已 seed 到 DB
      // (supabase/migrations/53_seed_prompt_templates.sql)，DEFAULT_PROMPTS
      // 仅作 DB 不可用时的降级安全网（如 Electron 桌面应用 DB 离线场景）。
      // 新增 prompt 必须通过 supabase/migrations/53_seed_prompt_templates.sql 写入 DB。
      const defaultPrompt = DEFAULT_PROMPTS[code];
      if (defaultPrompt) {
        logger.info(`[prompt:${code}] source=default (fallback)`);
        try {
          content = TemplateEngine.render(defaultPrompt, context);
        } catch (e) {
          logger.error(`Failed to render default prompt ${code}`, e);
          content = defaultPrompt;
        }
      } else {
        logger.warn(
          `No template found for code: ${code}. Using empty fallback.`,
        );
        content = "";
      }
    } else {
      // 识别命中层级（Graph > User > System），用于日志和排障
      if (template.scope === "graph" && template.graph_id === graphId) {
        source = "graph";
      } else if (template.scope === "user" && template.user_id === userId) {
        source = "user";
      } else {
        source = "system";
      }
      logger.info(
        `[prompt:${code}] source=${source} template_id=${template.id ?? "unsaved"}`,
      );
      try {
        content = TemplateEngine.render(template.template_content, context);
      } catch (e) {
        logger.error(`Failed to render prompt ${code}`, e);
        content = template.template_content;
      }
    }

    // Append fixed schema if exists
    if (OUTPUT_SCHEMAS[code]) {
      content += `\n\n${OUTPUT_SCHEMAS[code]}`;
    }

    // Replace output language placeholder in schemas
    const outputLanguage = isEnglishLanguage(language) ? "English" : "Chinese";
    content = content.replace(/\{\{outputLanguage\}\}/g, outputLanguage);

    // Replace category options based on language
    const categoryOptions = isEnglishLanguage(language)
      ? "'Definition', 'Concept', 'Method', 'Conclusion', 'Principle', 'Application', 'Terminology'"
      : "'定义', '概念', '方法', '结论', '原理', '应用', '术语'";
    content = content.replace(/\{\{categoryOptions\}\}/g, categoryOptions);

    // Append language instruction based on the language parameter
    const languageInstruction = getLanguageInstruction(language);
    content += `\n\n${languageInstruction}`;

    return content;
  }

  /**
   * Get the raw template object based on priority
   */
  async getTemplate(
    supabase: SupabaseClient,
    code: string,
    userId?: string,
    graphId?: string,
  ): Promise<PromptTemplate | null> {
    const cacheKey = CacheKeys.PROMPT_TEMPLATE(
      code,
      userId || "system",
      graphId || "none",
    );

    return cacheService.getOrSet<PromptTemplate | null>(cacheKey, async () => {
      // Server-side OR filter: only fetch templates that are actually relevant.
      // Matches: scope=system  OR  (scope=user AND user_id=userId)  OR  (scope=graph AND graph_id=graphId)
      // This avoids pulling every template with the same code into memory and prevents
      // returning other users' templates when a service-role (admin) client bypasses RLS.
      // userId/graphId are UUIDs (hex + hyphens), so they are safe to interpolate into
      // the PostgREST .or() string without injection risk.
      const orConditions: string[] = ["scope.eq.system"];
      if (userId) {
        orConditions.push(`and(scope.eq.user,user_id.eq.${userId})`);
      }
      if (graphId) {
        orConditions.push(`and(scope.eq.graph,graph_id.eq.${graphId})`);
      }

      const { data: templates, error } = await supabase
        .from("prompt_templates")
        .select("*")
        .eq("code", code)
        .or(orConditions.join(","));

      if (error) throw error;

      if (!templates || templates.length === 0) return null;

      // Sort by priority: Graph > User > System (filtering is already done server-side)
      const getWeight = (t: PromptTemplate) => {
        if (t.scope === "graph" && t.graph_id === graphId) return 3;
        if (t.scope === "user" && t.user_id === userId) return 2;
        if (t.scope === "system") return 1;
        return 0;
      };

      const sorted = templates.sort((a, b) => getWeight(b) - getWeight(a));
      const bestMatch = sorted[0];

      return bestMatch || null;
    }, 60);
  }

  // Management Methods

  async saveTemplate(
    supabase: SupabaseClient,
    template: Partial<PromptTemplate>,
  ) {
    const { data, error } = await supabase
      .from("prompt_templates")
      .upsert(
        {
          ...template,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "code,scope,user_id,graph_id" },
      )
      .select()
      .single();

    if (error) throw error;

    // Invalidate cache
    const userId = template.user_id || "system";
    const graphId = template.graph_id || "none";
    await cacheService.del(
      CacheKeys.PROMPT_TEMPLATE(template.code ?? "", userId, graphId),
    );

    return data;
  }

  async deleteTemplate(supabase: SupabaseClient, id: string) {
    // Get template first to know keys for cache invalidation
    const { data: temp } = await supabase
      .from("prompt_templates")
      .select("*")
      .eq("id", id)
      .single();

    const { error } = await supabase
      .from("prompt_templates")
      .delete()
      .eq("id", id);
    if (error) throw error;

    if (temp) {
      const userId = temp.user_id || "system";
      const graphId = temp.graph_id || "none";
      await cacheService.del(
        CacheKeys.PROMPT_TEMPLATE(temp.code, userId, graphId),
      );
    }
  }

  async resetToDefault(
    supabase: SupabaseClient,
    code: string,
    scope: PromptScope,
    userId?: string,
    graphId?: string,
  ) {
    // Delete the specific override
    let query = supabase
      .from("prompt_templates")
      .delete()
      .eq("code", code)
      .eq("scope", scope);

    if (scope === "user" && userId) query = query.eq("user_id", userId);
    if (scope === "graph" && graphId) query = query.eq("graph_id", graphId);

    const { error } = await query;
    if (error) throw error;

    // Invalidate cache
    await cacheService.del(
      CacheKeys.PROMPT_TEMPLATE(code, userId || "system", graphId || "none"),
    );
  }

  async optimizeWithAI(
    templateContent: string,
    instruction?: string,
  ): Promise<string> {
    const provider = await getAIProviderForTask("text");

    if (!provider.hasKey) {
      throw new AppError(ErrorCodes.AI_PROVIDER_NOT_CONFIGURED, { message: "AI服务未配置" });
    }

    const systemPrompt = await this.getRenderedPrompt(
      getSupabaseAdmin(),
      "optimize_prompt",
      { template_content: templateContent, instruction: instruction || "" },
    );

    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Original Prompt:\n${templateContent}\n\n${instruction ? `User Instruction: ${instruction}` : ""}`,
      },
    ];

    const completion = await provider.client.chat.completions.create({
      messages,
      model: provider.model,
      temperature: 0.7,
    });

    return completion.choices[0].message.content || "";
  }

  /**
   * 根据学习材料章节配置方案（可视化编辑器产出）动态拼装 prompt 文本。
   * 这样用户就可以通过可视化界面自由组合章节，而不必手写完整 prompt。
   *
   * 拼装逻辑：
   * 1. 复用现有 learning_material 模板的"人设+格式"公共头部（兜底用常量）
   * 2. 把 sections 数组按 order 排序后拼入 Structure 段落
   * 3. 保留原有的变量占位符（topic, context, level）以便模板引擎继续渲染
   */
  buildPromptFromSchema(schema: LearningMaterialSchema): string {
    const sortedSections = [...schema.sections].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    );

    const structureLines = sortedSections.map(
      (sec, idx) => this.formatSectionLine(idx + 1, sec),
    );

    return `You are a distinguished textbook author and educator. Write a comprehensive, structured learning module for the given topic.

Target Audience: University students or professionals learning this concept.

Structure:
${structureLines.join("\n")}

Formatting:
- Use Markdown headers (## for each section title above, ### for subsections inside).
- Use bolding for key terms.
- **IMPORTANT**: Wrap ALL mathematical formulas in LaTeX: $inline$ or $$block$$.
- Use lists and bullet points for readability.
- Respect the suggested word count per section whenever feasible.
- **Write every section title in {{outputLanguage}}**: translate each title listed in the Structure above into the target language, do not keep the original-language titles.

Topic: {{topic}}
Context/Background: {{context}}
${this.wrapOptional("Knowledge Level: {{level}}")}
Please write the learning material and keywords in {{outputLanguage}}.`;
  }

  /** 格式化单个章节行 */
  private formatSectionLine(
    seqNo: number,
    sec: LearningMaterialSection,
  ): string {
    const parts: string[] = [];
    parts.push(`${seqNo}. **${sec.title}**: ${sec.instruction.trim()}`);
    if (sec.min_words && sec.max_words) {
      parts.push(` Suggested length: approximately ${sec.min_words}-${sec.max_words} words.`);
    } else if (sec.min_words) {
      parts.push(` Suggested minimum length: ${sec.min_words} words.`);
    } else if (sec.max_words) {
      parts.push(` Suggested maximum length: ${sec.max_words} words.`);
    }
    return parts.join("");
  }

  private wrapOptional(text: string): string {
    return `{{#if level}}${text}{{/if}}`;
  }
}

export const promptService = new PromptService();
