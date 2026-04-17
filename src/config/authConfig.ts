export type AuthMode = "supabase";

const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

const getEnv = (key: string, defaultValue: string = ""): string => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env[key] || defaultValue;
  }
  return defaultValue;
};

function isDevelopment(): boolean {
  const mode = getEnv("MODE");
  const nodeEnv = getEnv("NODE_ENV");
  const devServerUrl = getEnv("VITE_DEV_SERVER_URL");
  return mode === "development" || nodeEnv === "development" || !!devServerUrl;
}

export const authConfig = {
  mode: "supabase" as AuthMode,
  isSupabase: () => true,

  supabase: {
    url:
      getEnv("VITE_SUPABASE_URL") ||
      (isDevelopment()
        ? LOCAL_SUPABASE_URL
        : "https://gzceehtffqwlcyspmbvj.supabase.co"),
    anonKey:
      getEnv("VITE_SUPABASE_ANON_KEY") ||
      (isDevelopment()
        ? LOCAL_SUPABASE_ANON_KEY
        : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6Y2VlaHRmZnF3bGN5c3BtYnZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMDMzMTgsImV4cCI6MjA4OTU3OTMxOH0.xg1HAD00-BQBGCA_t8vcs3DLrKo2T6wYBMqaeR99Juk"),
  },
} as const;

export const getAuthModeDisplay = (): string => {
  const url = authConfig.supabase.url;
  if (url.includes("127.0.0.1") || url.includes("localhost")) {
    return "本地模式";
  }
  return "云端模式";
};
