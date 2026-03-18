import { createClient } from '@supabase/supabase-js';
import { authConfig } from '../../config/authConfig';

let mobileSupabaseClient: ReturnType<typeof createClient> | null = null;

export const getMobileSupabaseClient = () => {
  if (!mobileSupabaseClient && authConfig.isSupabase()) {
    const { url, anonKey } = authConfig.supabase;
    if (url && anonKey) {
      mobileSupabaseClient = createClient(url, anonKey, {
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
  return mobileSupabaseClient;
};

export const resetMobileSupabaseClient = () => {
  mobileSupabaseClient = null;
};
