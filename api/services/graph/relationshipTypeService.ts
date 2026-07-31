import { SupabaseClient } from '@supabase/supabase-js';
import type { RelationshipTypeConfig, RelationshipCategory, EdgeLineStyle } from '@shared/types';
import { logger } from '../../utils/logger';
import i18next from "i18next";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

interface CreateRelationshipTypeData {
  name: string;
  display_name: string;
  category: RelationshipCategory;
  color: string;
  line_style: EdgeLineStyle;
  show_arrow: boolean | 'auto';
}

interface UpdateRelationshipTypeData {
  display_name?: string;
  category?: RelationshipCategory;
  color?: string;
  line_style?: EdgeLineStyle;
  show_arrow?: boolean | 'auto';
}

export class RelationshipTypeService {
  async getAll(supabase: SupabaseClient, userId?: string): Promise<RelationshipTypeConfig[]> {
    const { data, error } = await supabase
      .from('relationship_types')
      .select('*')
      .or(`is_builtin.eq.true,user_id.eq.${userId || 'null'}`)
      .order('is_builtin', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      logger.error('Get all relationship types error:', error);
      throw new AppError(i18next.t("relationshipTypes.api.errors.fetchFailed"), 500, ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return (data || []).map(this.mapRelationshipType);
  }

  async getByCategory(
    supabase: SupabaseClient,
    category: RelationshipCategory,
    userId?: string
  ): Promise<RelationshipTypeConfig[]> {
    const { data, error } = await supabase
      .from('relationship_types')
      .select('*')
      .eq('category', category)
      .or(`is_builtin.eq.true,user_id.eq.${userId || 'null'}`)
      .order('name', { ascending: true });

    if (error) {
      logger.error('Get relationship types by category error:', error);
      throw new AppError(i18next.t("relationshipTypes.api.errors.fetchFailed"), 500, ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return (data || []).map(this.mapRelationshipType);
  }

  async getByName(supabase: SupabaseClient, name: string): Promise<RelationshipTypeConfig | null> {
    const { data, error } = await supabase
      .from('relationship_types')
      .select('*')
      .eq('name', name)
      .maybeSingle();

    if (error) {
      logger.error('Get relationship type by name error:', error);
      throw new AppError(i18next.t("relationshipTypes.api.errors.fetchFailed"), 500, ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return data ? this.mapRelationshipType(data) : null;
  }

  async getById(supabase: SupabaseClient, id: string): Promise<RelationshipTypeConfig | null> {
    const { data, error } = await supabase
      .from('relationship_types')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      logger.error('Get relationship type by id error:', error);
      throw new AppError(i18next.t("relationshipTypes.api.errors.fetchFailed"), 500, ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return data ? this.mapRelationshipType(data) : null;
  }

  async create(
    supabase: SupabaseClient,
    userId: string,
    data: CreateRelationshipTypeData
  ): Promise<RelationshipTypeConfig> {
    const { data: existingType } = await supabase
      .from('relationship_types')
      .select('id')
      .eq('name', data.name)
      .maybeSingle();

    if (existingType) {
      throw new AppError(i18next.t("relationshipTypes.api.errors.nameExists"), 409, ErrorCodes.DATABASE_DUPLICATE_ENTRY);
    }

    const { data: newType, error } = await supabase
      .from('relationship_types')
      .insert([{
        name: data.name,
        display_name: data.display_name,
        category: data.category,
        color: data.color,
        line_style: data.line_style,
        show_arrow: data.show_arrow,
        is_builtin: false,
        user_id: userId
      }])
      .select()
      .single();

    if (error) {
      logger.error('Create relationship type error:', error);
      throw new AppError(i18next.t("relationshipTypes.api.errors.createFailed"), 500, ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return this.mapRelationshipType(newType);
  }

  async update(
    supabase: SupabaseClient,
    id: string,
    userId: string,
    data: UpdateRelationshipTypeData
  ): Promise<RelationshipTypeConfig> {
    const existingType = await this.getById(supabase, id);

    if (!existingType) {
      throw new AppError(i18next.t("relationshipTypes.api.errors.notFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    if (existingType.is_builtin) {
      throw new AppError(i18next.t("relationshipTypes.api.errors.builtInCannotModify"), 403, ErrorCodes.AUTH_FORBIDDEN);
    }

    if (existingType.user_id !== userId) {
      throw new AppError(i18next.t("relationshipTypes.api.errors.noPermissionToModify"), 403, ErrorCodes.AUTH_FORBIDDEN);
    }

    const { data: updatedType, error } = await supabase
      .from('relationship_types')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Update relationship type error:', error);
      throw new AppError(i18next.t("relationshipTypes.api.errors.updateFailed"), 500, ErrorCodes.DATABASE_QUERY_ERROR);
    }

    return this.mapRelationshipType(updatedType);
  }

  async delete(supabase: SupabaseClient, id: string, userId: string): Promise<void> {
    const existingType = await this.getById(supabase, id);

    if (!existingType) {
      throw new AppError(i18next.t("relationshipTypes.api.errors.notFound"), 404, ErrorCodes.RESOURCE_NOT_FOUND);
    }

    if (existingType.is_builtin) {
      throw new AppError(i18next.t("relationshipTypes.api.errors.builtInCannotDelete"), 403, ErrorCodes.AUTH_FORBIDDEN);
    }

    if (existingType.user_id !== userId) {
      throw new AppError(i18next.t("relationshipTypes.api.errors.noPermissionToDelete"), 403, ErrorCodes.AUTH_FORBIDDEN);
    }

    const { error } = await supabase
      .from('relationship_types')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Delete relationship type error:', error);
      throw new AppError(i18next.t("relationshipTypes.api.errors.deleteFailed"), 500, ErrorCodes.DATABASE_QUERY_ERROR);
    }
  }

  private mapRelationshipType(dbRecord: RelationshipTypeConfig): RelationshipTypeConfig {
    return {
      id: dbRecord.id,
      name: dbRecord.name,
      display_name: dbRecord.display_name,
      category: dbRecord.category,
      color: dbRecord.color,
      line_style: dbRecord.line_style,
      show_arrow: dbRecord.show_arrow,
      is_builtin: dbRecord.is_builtin,
      user_id: dbRecord.user_id,
      created_at: dbRecord.created_at,
      updated_at: dbRecord.updated_at
    };
  }
}

export const relationshipTypeService = new RelationshipTypeService();
