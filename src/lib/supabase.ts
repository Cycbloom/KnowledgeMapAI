import { createClient } from '@supabase/supabase-js';
import { authConfig } from '../config/authConfig';

let supabaseClient: ReturnType<typeof createClient> | null = null;

export const getSupabaseClient = () => {
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

export const resetSupabaseClient = () => {
  supabaseClient = null;
};
