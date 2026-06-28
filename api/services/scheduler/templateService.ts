import { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "../../utils/logger";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { notDeleted } from '../common/softDeleteHelper';

class TemplateService {
  async listTemplates(
    supabase: SupabaseClient,
    userId: string,
    filters: {
      category?: string;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ templates: Array<Record<string, unknown>>; total: number }> {
    const { category, search, limit = 50, offset = 0 } = filters;

    let query = supabase
      .from("task_templates")
      .select("*", { count: "exact" })
      .or(`user_id.eq.${userId},is_system.eq.true`)
      .order("is_system", { ascending: true })
      .order("category", { ascending: true })
      .order("name", { ascending: true })
      .range(offset, offset + limit - 1);

    if (category) {
      query = query.eq("category", category);
    }
    if (search) {
      query = query.or(
        `name.ilike.%${search}%,title_template.ilike.%${search}%`,
      );
    }

    const { data: templates, error, count } = await query;

    if (error) {
      logger.error("Get templates error:", error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        context: { userId, operation: "listTemplates" },
      });
    }

    return { templates: templates ?? [], total: count ?? 0 };
  }

  async getTemplateCategories(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<
    Array<{
      value: string;
      label: string;
      icon: string;
      color: string;
      count: number;
    }>
  > {
    const { data: templates, error } = await supabase
      .from("task_templates")
      .select("category")
      .or(`user_id.eq.${userId},is_system.eq.true`);

    if (error) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        context: { userId, operation: "getTemplateCategories" },
      });
    }

    const categories = [
      { value: "study", label: "学习", icon: "📚", color: "blue" },
      { value: "work", label: "工作", icon: "💼", color: "purple" },
      { value: "life", label: "生活", icon: "🏠", color: "green" },
      { value: "health", label: "健康", icon: "💪", color: "red" },
      { value: "custom", label: "自定义", icon: "⭐", color: "amber" },
    ];

    const categoryCounts: Record<string, number> = {};
    for (const t of templates || []) {
      categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
    }

    const result = categories.map((cat) => ({
      ...cat,
      count: categoryCounts[cat.value] || 0,
    }));

    return result;
  }

  async getTemplate(
    supabase: SupabaseClient,
    userId: string,
    templateId: string,
  ): Promise<Record<string, unknown>> {
    const { data: template, error } = await supabase
      .from("task_templates")
      .select("*")
      .eq("id", templateId)
      .or(`user_id.eq.${userId},is_system.eq.true`)
      .single();

    if (error || !template) {
      throw new AppError(ErrorCodes.RESOURCE_TEMPLATE_NOT_FOUND, {
        context: { userId, templateId },
      });
    }

    return template;
  }

  async createTemplate(
    supabase: SupabaseClient,
    userId: string,
    data: {
      name: string;
      description?: string;
      category?: string;
      title_template: string;
      description_template?: string;
      estimated_duration?: number;
      tags?: string[];
      priority?: number;
      is_default?: boolean;
    },
  ): Promise<Record<string, unknown>> {
    const {
      name,
      description,
      category,
      title_template,
      description_template,
      estimated_duration,
      tags,
      priority,
      is_default,
    } = data;

    const { data: template, error } = await supabase
      .from("task_templates")
      .insert({
        user_id: userId,
        name,
        description,
        category: category ?? "custom",
        title_template,
        description_template,
        estimated_duration: estimated_duration ?? 25,
        tags: tags ?? [],
        priority: priority ?? 2,
        is_default: is_default ?? false,
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      logger.error("Create template error:", error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        context: { userId, operation: "createTemplate" },
      });
    }

    return template;
  }

  async updateTemplate(
    supabase: SupabaseClient,
    userId: string,
    templateId: string,
    updateData: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const { data: template, error } = await supabase
      .from("task_templates")
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", templateId)
      .eq("user_id", userId)
      .eq("is_system", false)
      .select()
      .single();

    if (error || !template) {
      throw new AppError(ErrorCodes.RESOURCE_TEMPLATE_NOT_FOUND, {
        context: { userId, templateId, operation: "updateTemplate" },
      });
    }

    return template;
  }

  async deleteTemplate(
    supabase: SupabaseClient,
    userId: string,
    templateId: string,
  ): Promise<void> {
    const { error } = await supabase
      .from("task_templates")
      .delete()
      .eq("id", templateId)
      .eq("user_id", userId)
      .eq("is_system", false);

    if (error) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        context: { userId, templateId, operation: "deleteTemplate" },
      });
    }
  }

  async applyTemplate(
    supabase: SupabaseClient,
    userId: string,
    templateId: string,
    data: {
      placeholders?: Record<string, string>;
      queue_level?: number;
      knowledge_point_id?: string;
      deadline?: string;
    },
  ): Promise<Record<string, unknown>> {
    const { placeholders, queue_level, knowledge_point_id, deadline } = data;

    const { data: template, error: templateError } = await supabase
      .from("task_templates")
      .select("*")
      .eq("id", templateId)
      .or(`user_id.eq.${userId},is_system.eq.true`)
      .single();

    if (templateError || !template) {
      throw new AppError(ErrorCodes.RESOURCE_TEMPLATE_NOT_FOUND, {
        context: { userId, templateId, operation: "applyTemplate" },
      });
    }

    let title = template.title_template;
    let description = template.description_template;

    if (placeholders) {
      for (const [key, value] of Object.entries(placeholders)) {
        const placeholder = `{{${key}}}`;
        title = title.replace(new RegExp(placeholder, "g"), value as string);
        if (description) {
          description = description.replace(
            new RegExp(placeholder, "g"),
            value as string,
          );
        }
      }
    }

    const unresolvedPlaceholders = title.match(/\{\{[^}]+\}\}/g);
    if (unresolvedPlaceholders) {
      for (const placeholder of unresolvedPlaceholders) {
        const key = placeholder.slice(2, -2);
        title = title.replace(placeholder, key);
        if (description) {
          description = description.replace(placeholder, key);
        }
      }
    }

    const { count } = await notDeleted(supabase
      .from("user_tasks")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("queue_level", queue_level ?? 0)
      );

    const { data: task, error: taskError } = await supabase
      .from("user_tasks")
      .insert({
        user_id: userId,
        title,
        description,
        queue_level: queue_level ?? 0,
        position: count ?? 0,
        estimated_duration: template.estimated_duration,
        tags: template.tags,
        priority: template.priority,
        knowledge_point_id,
        deadline,
        status: "pending",
      })
      .select()
      .single();

    if (taskError) {
      logger.error("Create task from template error:", taskError);
      throw new AppError(ErrorCodes.SCHEDULER_TASK_CREATION_FAILED, {
        context: { userId, templateId, operation: "applyTemplate" },
      });
    }

    await supabase
      .from("task_templates")
      .update({ usage_count: template.usage_count + 1 })
      .eq("id", templateId);

    return task;
  }

  async duplicateTemplate(
    supabase: SupabaseClient,
    userId: string,
    templateId: string,
    name?: string,
  ): Promise<Record<string, unknown>> {
    const { data: original, error: fetchError } = await supabase
      .from("task_templates")
      .select("*")
      .eq("id", templateId)
      .or(`user_id.eq.${userId},is_system.eq.true`)
      .single();

    if (fetchError || !original) {
      throw new AppError(ErrorCodes.RESOURCE_TEMPLATE_NOT_FOUND, {
        context: { userId, templateId, operation: "duplicateTemplate" },
      });
    }

    const { data: template, error } = await supabase
      .from("task_templates")
      .insert({
        user_id: userId,
        name: name || `${original.name} (副本)`,
        description: original.description,
        category: original.category,
        title_template: original.title_template,
        description_template: original.description_template,
        estimated_duration: original.estimated_duration,
        tags: original.tags,
        priority: original.priority,
        is_default: false,
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      logger.error("Duplicate template error:", error);
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        context: { userId, templateId, operation: "duplicateTemplate" },
      });
    }

    return template;
  }

  async setDefaultTemplate(
    supabase: SupabaseClient,
    userId: string,
    templateId: string,
  ): Promise<Record<string, unknown>> {
    const { data: template, error: fetchError } = await supabase
      .from("task_templates")
      .select("category")
      .eq("id", templateId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !template) {
      throw new AppError(ErrorCodes.RESOURCE_TEMPLATE_NOT_FOUND, {
        context: { userId, templateId, operation: "setDefaultTemplate" },
      });
    }

    await supabase
      .from("task_templates")
      .update({ is_default: false })
      .eq("user_id", userId)
      .eq("category", template.category);

    const { data: updated, error } = await supabase
      .from("task_templates")
      .update({ is_default: true })
      .eq("id", templateId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, {
        context: { userId, templateId, operation: "setDefaultTemplate" },
      });
    }

    return updated;
  }
}

export const templateService = new TemplateService();
