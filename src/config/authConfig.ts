export type AuthMode = "supabase";

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
  // "test" 环境同样使用开发回退（空字符串），避免单元测试因缺少 VITE_ 变量而抛错
  return (
    mode === "development" ||
    mode === "test" ||
    nodeEnv === "development" ||
    nodeEnv === "test" ||
    !!devServerUrl
  );
}

const SUPABASE_CONFIG_KEY = "supabase_config";

const getDefaultUrl = (): string => {
  const url = getEnv("VITE_SUPABASE_URL");
  if (url) return url;
  if (isDevelopment()) {
    console.warn("VITE_SUPABASE_URL is not set in development environment");
    return "";
  }
  throw new Error("VITE_SUPABASE_URL is required in production environment");
};

const getDefaultAnonKey = (): string => {
  const anonKey = getEnv("VITE_SUPABASE_ANON_KEY");
  if (anonKey) return anonKey;
  if (isDevelopment()) {
    console.warn(
      "VITE_SUPABASE_ANON_KEY is not set in development environment",
    );
    return "";
  }
  throw new Error(
    "VITE_SUPABASE_ANON_KEY is required in production environment",
  );
};

export const authConfig = {
  mode: "supabase" as AuthMode,
  isSupabase: () => true,

  supabase: {
    url: getDefaultUrl(),
    anonKey: getDefaultAnonKey(),
  },
};

export const updateSupabaseConfig = (url: string, anonKey: string): void => {
  authConfig.supabase.url = url;
  authConfig.supabase.anonKey = anonKey;

  try {
    localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify({ url, anonKey }));
  } catch {
    // ignore storage errors
  }
};

export const loadSavedSupabaseConfig = (): void => {
  try {
    const saved = localStorage.getItem(SUPABASE_CONFIG_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.url && parsed.anonKey) {
        authConfig.supabase.url = parsed.url;
        authConfig.supabase.anonKey = parsed.anonKey;
      }
    }
  } catch {
    // ignore parse errors
  }
};

loadSavedSupabaseConfig();

export const getAuthModeDisplay = (): string => {
  const url = authConfig.supabase.url;
  if (!url) return "";
  if (url.includes("127.0.0.1") || url.includes("localhost")) {
    return "本地模式";
  }
  return "云端模式";
};

export const isSupabaseConfigured = (): boolean => {
  return !!(authConfig.supabase.url && authConfig.supabase.anonKey);
};
