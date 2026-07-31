import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { authConfig } from '../config/authConfig';

export interface SupabaseClientOptions {
  realtime?: boolean;
}

let supabaseClient: SupabaseClient | null = null;
let realtimeClient: SupabaseClient | null = null;

/**
 * 获取 Supabase 客户端实例
 * 
 * @param options - 配置选项
 * @param options.realtime - 是否启用 realtime 功能
 * @returns Supabase 客户端实例，如果未配置或配置无效则返回 null
 * 
 * @example
 * // 获取标准客户端
 * const client = getSupabaseClient();
 * if (!client) {
 *   throw new Error('Supabase client not initialized');
 * }
 * 
 * // 获取 realtime 客户端
 * const realtimeClient = getSupabaseClient({ realtime: true });
 */
export const getSupabaseClient = (options?: SupabaseClientOptions): SupabaseClient | null => {
  const enableRealtime = options?.realtime ?? false;
  
  if (enableRealtime) {
    if (!realtimeClient && authConfig.isSupabase()) {
      const { url, anonKey } = authConfig.supabase;
      if (url && anonKey) {
        realtimeClient = createClient(url, anonKey, {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            storage: window.localStorage,
          },
          realtime: {
            params: {
              eventsPerSecond: 10,
            },
          },
        });
      }
    }
    return realtimeClient;
  }
  
  if (!supabaseClient && authConfig.isSupabase()) {
    const { url, anonKey } = authConfig.supabase;
    if (url && anonKey) {
      supabaseClient = createClient(url, anonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          storage: window.localStorage,
        },
      });
    }
  }
  return supabaseClient;
};

export const resetSupabaseClient = (): void => {
  supabaseClient = null;
  realtimeClient = null;
};

/**
 * 获取移动端 Supabase 客户端（启用 realtime）
 * 
 * @returns Supabase 客户端实例，如果未配置或配置无效则返回 null
 */
export const getMobileSupabaseClient = (): SupabaseClient | null => getSupabaseClient({ realtime: true });

export const resetMobileSupabaseClient = (): void => {
  realtimeClient = null;
};