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
    url: getEnv('VITE_SUPABASE_URL', 'https://yslvcftsxllmgsopjqwn.supabase.co'),
    anonKey: getEnv('VITE_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzbHZjZnRzeGxsbWdzb3BqcXduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1NzkwNjcsImV4cCI6MjA4OTE1NTA2N30.2UVZ3np5CV7ANU0kavnFd4AA2yf_X5d0eptlMIbYG1I'),
  },
} as const;

export const getAuthModeDisplay = (): string => {
  return '云端模式';
};
