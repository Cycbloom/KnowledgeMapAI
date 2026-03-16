export type AuthMode = 'supabase';

export const authConfig = {
  mode: 'supabase' as AuthMode,
  isSupabase: () => true,
  
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  },
} as const;

export const getAuthModeDisplay = (): string => {
  return '云端模式';
};
