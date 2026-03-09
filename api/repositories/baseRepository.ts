import { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '../supabase.js';

export interface QueryOptions {
  filters?: Record<string, unknown>;
  orderBy?: { column: string; ascending?: boolean };
  limit?: number;
  offset?: number;
  select?: string;
}

export abstract class BaseRepository<T> {
  protected tableName: string;
  protected client: SupabaseClient;

  constructor(tableName: string, client?: SupabaseClient) {
    this.tableName = tableName;
    this.client = client || supabaseAdmin;
  }

  async findAll(options?: QueryOptions): Promise<T[]> {
    let query = this.client.from(this.tableName).select(options?.select || '*');

    if (options?.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      }
    }

    if (options?.orderBy) {
      query = query.order(options.orderBy.column, {
        ascending: options.orderBy.ascending ?? true,
      });
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 100) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch ${this.tableName}: ${error.message}`);
    }

    return data as T[];
  }

  async findById(id: string, select?: string): Promise<T | null> {
    const { data, error } = await this.client
      .from(this.tableName)
      .select(select || '*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch ${this.tableName} by id: ${error.message}`);
    }

    return data as T;
  }

  async findOne(filters: Record<string, unknown>, select?: string): Promise<T | null> {
    let query = this.client.from(this.tableName).select(select || '*');

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value);
      }
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch ${this.tableName}: ${error.message}`);
    }

    return data as T;
  }

  async create(data: Partial<T>): Promise<T> {
    const { data: result, error } = await this.client
      .from(this.tableName)
      .insert(data)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create ${this.tableName}: ${error.message}`);
    }

    return result as T;
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    const { data: result, error } = await this.client
      .from(this.tableName)
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update ${this.tableName}: ${error.message}`);
    }

    return result as T;
  }

  async delete(id: string): Promise<void> {
    const { error } = await this.client.from(this.tableName).delete().eq('id', id);

    if (error) {
      throw new Error(`Failed to delete ${this.tableName}: ${error.message}`);
    }
  }

  async count(filters?: Record<string, unknown>): Promise<number> {
    let query = this.client.from(this.tableName).select('*', { count: 'exact', head: true });

    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value);
        }
      }
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Failed to count ${this.tableName}: ${error.message}`);
    }

    return count || 0;
  }
}
