import { SupabaseClient } from '@supabase/supabase-js';
import type { RelationshipTypeConfig, RelationshipCategory, EdgeLineStyle } from '@/types';
import { logger } from '../../utils/logger';

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
      throw new Error('获取关系类型失败');
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
      throw new Error('获取关系类型失败');
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
      throw new Error('获取关系类型失败');
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
      throw new Error('获取关系类型失败');
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
      throw new Error('关系类型名称已存在');
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
      throw new Error('创建关系类型失败');
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
      throw new Error('关系类型不存在');
    }

    if (existingType.is_builtin) {
      throw new Error('内置关系类型不允许修改');
    }

    if (existingType.user_id !== userId) {
      throw new Error('无权限修改此关系类型');
    }

    const { data: updatedType, error } = await supabase
      .from('relationship_types')
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error('Update relationship type error:', error);
      throw new Error('更新关系类型失败');
    }

    return this.mapRelationshipType(updatedType);
  }

  async delete(supabase: SupabaseClient, id: string, userId: string): Promise<void> {
    const existingType = await this.getById(supabase, id);

    if (!existingType) {
      throw new Error('关系类型不存在');
    }

    if (existingType.is_builtin) {
      throw new Error('内置关系类型不允许删除');
    }

    if (existingType.user_id !== userId) {
      throw new Error('无权限删除此关系类型');
    }

    const { error } = await supabase
      .from('relationship_types')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Delete relationship type error:', error);
      throw new Error('删除关系类型失败');
    }
  }

  private mapRelationshipType(dbRecord: any): RelationshipTypeConfig {
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
