import { supabaseAdmin } from '../../supabase.js';
import { logger } from '../../utils/logger.js';
export class SettingsService {
    cache = new Map();
    CACHE_TTL = 60 * 1000; // 1 minute cache
    async getSetting(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.value;
        }
        const { data, error } = await supabaseAdmin
            .from('app_settings')
            .select('value')
            .eq('key', key)
            .single();
        if (error) {
            // If not found, return null (caller should handle default)
            if (error.code === 'PGRST116')
                return null;
            logger.error(`Failed to fetch setting ${key}:`, error);
            return null;
        }
        this.cache.set(key, { value: data.value, timestamp: Date.now() });
        return data.value;
    }
    async updateSetting(key, value, userId) {
        const { error } = await supabaseAdmin
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
    clearCache(key) {
        if (key) {
            this.cache.delete(key);
        }
        else {
            this.cache.clear();
        }
    }
}
export const settingsService = new SettingsService();
//# sourceMappingURL=settingsService.js.map