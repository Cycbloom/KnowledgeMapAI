import { SupabaseClient } from "@supabase/supabase-js";
import { TemplateEngine } from "../../utils/templateEngine";
import { cacheService, CacheKeys } from "../common/cacheService";
import { logger } from "../../utils/logger";
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

export type { PromptScope, PromptTemplate, PromptListOptions, PromptCreateData, PromptUpdateData };
export { getLanguageInstruction };

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
      system: systemTemplates || [],
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

    if (!template) {
      // DB 为唯一权威来源，所有 12 个 prompt 已 seed 到 DB
      // (supabase/migrations/53_seed_prompt_templates.sql)，DEFAULT_PROMPTS
      // 仅作 DB 不可用时的降级安全网（如 Electron 桌面应用 DB 离线场景）。
      // 新增 prompt 必须通过 supabase/migrations/53_seed_prompt_templates.sql 写入 DB。
      const defaultPrompt = DEFAULT_PROMPTS[code];
      if (defaultPrompt) {
        logger.info(`Using default prompt for code: ${code}`);
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
      throw new Error("AI服务未配置");
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
}

export const promptService = new PromptService();
