import { getSupabaseAdmin } from '../../supabase';
import { logger } from '../../utils/logger';

export class AppSettingsService {
  private cache: Map<string, { value: any; timestamp: number }> = new Map();
  private CACHE_TTL = 60 * 1000; // 1 minute cache

  async getSetting<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.value as T;
    }

    const { data, error } = await getSupabaseAdmin()
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .single();

    if (error) {
      // If not found, return null (caller should handle default)
      if (error.code === 'PGRST116') return null; 
      logger.error(`Failed to fetch setting ${key}:`, error);
      return null;
    }

    this.cache.set(key, { value: data.value, timestamp: Date.now() });
    return data.value as T;
  }

  async updateSetting(key: string, value: any, userId?: string) {
    const { error } = await getSupabaseAdmin()
      .from('app_settings')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString(),
        updated_by: userId
      });

    if (error) {
      logger.error(`Failed to update setting ${key}:`, error);
      throw error;
    }

    // Invalidate cache
    this.cache.delete(key);
    return true;
  }
  
  // Clear specific cache key or all
  clearCache(key?: string) {
      if (key) {
          this.cache.delete(key);
      } else {
          this.cache.clear();
      }
  }
}

export const appSettingsService = new AppSettingsService();
