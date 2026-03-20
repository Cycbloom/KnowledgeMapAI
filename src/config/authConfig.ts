export type AuthMode = 'supabase';

const getEnv = (key: string, defaultValue: string = ''): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || defaultValue;
  }
  return defaultValue;
};

export const authConfig = {
  mode: 'supabase' as AuthMode,
  isSupabase: () => true,
  
  supabase: {
    url: getEnv('VITE_SUPABASE_URL', 'https://gzceehtffqwlcyspmbvj.supabase.co'),
    anonKey: getEnv('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6Y2VlaHRmZnF3bGN5c3BtYnZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMDMzMTgsImV4cCI6MjA4OTU3OTMxOH0.xg1HAD00-BQBGCA_t8vcs3DLrKo2T6wYBMqaeR99Juk'),
  },
} as const;

export const getAuthModeDisplay = (): string => {
  return '云端模式';
};
