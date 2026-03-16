export type AuthMode = 'local' | 'supabase';

const getAuthMode = (): AuthMode => {
  const mode = import.meta.env.VITE_DATABASE_MODE;
  if (mode === 'local' || mode === 'supabase') {
    return mode;
  }
  return 'local';
};

export const authConfig = {
  mode: getAuthMode(),
  isLocal: () => getAuthMode() === 'local',
  isSupabase: () => getAuthMode() === 'supabase',
  
  supabase: {
    url: import.meta.env.VITE_SUPABASE_URL || '',
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  },
  
  local: {
    apiBaseUrl: '/api/auth',
  },
} as const;

export const getAuthModeDisplay = (): string => {
  return authConfig.mode === 'local' ? '本地模式' : '云端模式';
};
