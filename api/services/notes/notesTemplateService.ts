import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  NoteTemplate,
  CreateNoteTemplateInput,
  UpdateNoteTemplateInput,
} from '@shared/types/note';
import { logger } from '../../utils/logger';
import i18next from 'i18next';
import { AppError } from '../../middleware/errorHandler';
import { ErrorCodes } from '../../../shared/types/errorCodes';
import {
  mapRowToTemplate,
  type NoteTemplateRow,
} from './notesShared';

/**
 * 模板域服务：note_templates 表的 CRUD、默认模板查询与属主校验。
 * 纯只读/独立，不依赖 NotesService，由 NotesService 组合注入。
 */
export class NotesTemplateService {
  /**
   * 查询用户可见模板(own OR is_system)。RLS 自动过滤。
   */
  async listTemplates(supabase: SupabaseClient, _userId: string): Promise<NoteTemplate[]> {
    const { data, error } = await supabase
      .from('note_templates')
      .select('*')
      .order('is_system', { ascending: false })
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      logger.error('listTemplates: query error', { error });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: {} });
    }

    return (data ?? []).map((row) => mapRowToTemplate(row as unknown as NoteTemplateRow));
  }

  /**
   * 创建自定义模板。user_id=当前用户,is_system=false。
   * RLS 保证 user_id 必须为当前用户。
   */
  async createTemplate(
    supabase: SupabaseClient,
    userId: string,
    data: CreateNoteTemplateInput,
  ): Promise<NoteTemplate> {
    const { data: inserted, error } = await supabase
      .from('note_templates')
      .insert({
        user_id: userId,
        name: data.name,
        content: data.content,
        is_default: false,
        is_system: false,
      })
      .select('*')
      .single();

    if (error) {
      logger.error('createTemplate: insert error', { userId, error });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId } });
    }

    return mapRowToTemplate(inserted as unknown as NoteTemplateRow);
  }

  /**
   * 更新自定义模板。
   * - 校验存在性 + ownership(跨用户返回 NOT_FOUND)
   * - is_system=true 模板返回 403(系统模板不可改)
   */
  async updateTemplate(
    supabase: SupabaseClient,
    userId: string,
    id: string,
    data: UpdateNoteTemplateInput,
  ): Promise<NoteTemplate> {
    // 1. 校验存在性 + 属主 + is_system
    const existing = await this.getTemplateForOwner(supabase, userId, id);
    if (existing.isSystem) {
      throw new AppError(ErrorCodes.CANNOT_MODIFY_SYSTEM_TEMPLATE, {
        context: { userId, id },
      });
    }

    // 2. 执行更新
    const updateRow: Record<string, unknown> = {};
    if (data.name !== undefined) updateRow.name = data.name;
    if (data.content !== undefined) updateRow.content = data.content;

    if (Object.keys(updateRow).length === 0) {
      // 无字段需要更新,直接返回当前模板
      return existing;
    }

    const { data: updated, error } = await supabase
      .from('note_templates')
      .update(updateRow)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      logger.error('updateTemplate: update error', { userId, id, error });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, id } });
    }

    return mapRowToTemplate(updated as unknown as NoteTemplateRow);
  }

  /**
   * 删除自定义模板。
   * - 校验存在性 + ownership
   * - is_system=true 模板返回 403(系统模板不可删)
   */
  async deleteTemplate(
    supabase: SupabaseClient,
    userId: string,
    id: string,
  ): Promise<void> {
    // 1. 校验存在性 + 属主 + is_system
    const existing = await this.getTemplateForOwner(supabase, userId, id);
    if (existing.isSystem) {
      throw new AppError(ErrorCodes.CANNOT_MODIFY_SYSTEM_TEMPLATE, {
        context: { userId, id },
      });
    }

    // 2. 执行删除
    const { error } = await supabase
      .from('note_templates')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('deleteTemplate: delete error', { userId, id, error });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, id } });
    }
  }

  /**
   * 设为默认模板。
   * - 校验存在性 + ownership + is_system=false(系统模板不可设默认)
   * - 事务:UPDATE 其他同 user 模板 is_default=false,UPDATE 该模板 is_default=true
   *
   * 实现:由于 Supabase JS 客户端不支持原生事务,通过两条 UPDATE 顺序执行;
   * 单一用户并发场景极低,且由 idx_note_templates_user_default 唯一索引兜底
   * (若并发导致同时存在两个 is_default=true,后续创建时 DB 会拒绝)。
   */
  async setDefaultTemplate(
    supabase: SupabaseClient,
    userId: string,
    id: string,
  ): Promise<NoteTemplate> {
    // 1. 校验存在性 + 属主 + is_system
    const existing = await this.getTemplateForOwner(supabase, userId, id);
    if (existing.isSystem) {
      throw new AppError(ErrorCodes.CANNOT_MODIFY_SYSTEM_TEMPLATE, {
        context: { userId, id },
      });
    }

    // 2. 取消同用户其他模板的默认标记
    const { error: clearError } = await supabase
      .from('note_templates')
      .update({ is_default: false })
      .eq('user_id', userId)
      .neq('id', id);

    if (clearError) {
      logger.error('setDefaultTemplate: clear other defaults error', { userId, id, error: clearError });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, id } });
    }

    // 3. 设置当前模板为默认
    const { data: updated, error: updateError } = await supabase
      .from('note_templates')
      .update({ is_default: true })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      logger.error('setDefaultTemplate: set default error', { userId, id, error: updateError });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, id } });
    }

    return mapRowToTemplate(updated as unknown as NoteTemplateRow);
  }

  /**
   * 获取用户默认模板(自定义默认优先,无则系统默认模板)。
   * RLS 保证用户只能查到自己的 + 系统的。
   */
  async getDefaultTemplate(
    supabase: SupabaseClient,
    userId: string,
  ): Promise<NoteTemplate> {
    // 1. 用户自定义默认模板
    const { data: userDefault, error: userErr } = await supabase
      .from('note_templates')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .maybeSingle();

    if (userErr) {
      logger.error('getDefaultTemplate: user default query error', { userId, error: userErr });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId } });
    }

    if (userDefault) {
      return mapRowToTemplate(userDefault as unknown as NoteTemplateRow);
    }

    // 2. 系统默认模板(is_system=true,由 seed 注入)
    const { data: sysTemplate, error: sysErr } = await supabase
      .from('note_templates')
      .select('*')
      .eq('is_system', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (sysErr) {
      logger.error('getDefaultTemplate: system template query error', { userId, error: sysErr });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId } });
    }

    if (!sysTemplate) {
      // 兜底:数据库未 seed 系统模板时使用硬编码三段式(仅此一处例外,保证可用)
      return {
        id: '',
        userId: null,
        name: i18next.t('notes.api.defaults.templateName'),
        content:
          '# {{date}} 学习日志\n\n## 今日数据\n- 复习卡片: {{today_reviewed_cards}}\n- 完成任务: {{today_completed_tasks}}\n- 专注时长: {{today_focus_time}}\n\n## 今日学习\n\n## 今日复习\n\n## 今日反思\n',
        isDefault: false,
        isSystem: true,
        createdAt: '',
        updatedAt: '',
      };
    }

    return mapRowToTemplate(sysTemplate as unknown as NoteTemplateRow);
  }

  /**
   * 查询单个模板并校验属主(跨用户返回 NOT_FOUND)。
   * RLS 已保证用户只能查到自己的 + 系统的;此处显式校验 ownership 用于
   * update/delete/setDefault 场景(系统模板可见但不可改)。
   */
  private async getTemplateForOwner(
    supabase: SupabaseClient,
    userId: string,
    id: string,
  ): Promise<NoteTemplate> {
    const { data, error } = await supabase
      .from('note_templates')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logger.error('getTemplateForOwner: query error', { userId, id, error });
      throw new AppError(ErrorCodes.DATABASE_QUERY_ERROR, { context: { userId, id } });
    }

    if (!data) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { context: { userId, id } });
    }

    const template = mapRowToTemplate(data as unknown as NoteTemplateRow);

    // 系统模板对所有用户可见,但 ownership 校验时:系统模板视为"共享只读",
    // 调用方根据 isSystem 判断是否允许修改。其他模板必须 user_id === userId。
    if (!template.isSystem && template.userId !== userId) {
      throw new AppError(ErrorCodes.RESOURCE_NOT_FOUND, { context: { userId, id } });
    }

    return template;
  }
}

export const notesTemplateService = new NotesTemplateService();