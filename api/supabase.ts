import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { logger } from "./utils/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
// Public Supabase demo service_role key (from official Supabase docs).
// Used ONLY as a development fallback when SUPABASE_SERVICE_ROLE_KEY is missing.
const DEMO_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35yJt5IUY2-hG09QYxi0IprSuN4kDawpg";

function isDevelopment(): boolean {
  const nodeEnv = process.env.NODE_ENV;
  // "test" 环境同样使用开发回退（demo key），避免单元测试因缺少密钥而无法加载模块
  return nodeEnv === "development" || nodeEnv === "test" || !nodeEnv;
}

function resolveServiceKey(): string {
  const envServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (envServiceKey) {
    return envServiceKey;
  }

  if (isDevelopment()) {
    console.warn(
      "SUPABASE_SERVICE_ROLE_KEY is missing; falling back to public Supabase demo service_role key for development.",
    );
    return DEMO_SERVICE_KEY;
  }

  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is missing in production environment. Refusing to start.",
  );
}

function getSupabaseConfig(): {
  url: string;
  serviceKey: string;
  anonKey: string;
} {
  const envUrl = process.env.VITE_SUPABASE_URL;
  const envAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const serviceKey = resolveServiceKey();

  if (envUrl) {
    return {
      url: envUrl,
      serviceKey,
      anonKey: envAnonKey || serviceKey,
    };
  }

  if (isDevelopment()) {
    logger.info("Using local Supabase configuration for development");
    return {
      url: LOCAL_SUPABASE_URL,
      serviceKey,
      anonKey: envAnonKey || LOCAL_SUPABASE_ANON_KEY,
    };
  }

  return {
    url: envUrl || "",
    serviceKey,
    anonKey: envAnonKey || "",
  };
}

let envPath: string | null = null;

try {
  const isPackaged =
    process.mainModule?.filename?.includes("app.asar") ||
    (process as { resourcesPath?: string }).resourcesPath?.includes(
      "resources",
    );

  const possiblePaths: string[] = [];

  if (isPackaged) {
    const resourcesPath = (process as { resourcesPath?: string }).resourcesPath;
    if (resourcesPath) {
      possiblePaths.push(path.join(resourcesPath, ".env.production"));
    }
    possiblePaths.push(path.join(__dirname, "..", ".env.production"));
    possiblePaths.push(path.join(__dirname, "..", "..", ".env.production"));
  } else {
    possiblePaths.push(path.join(__dirname, "..", ".env.development"));
    possiblePaths.push(path.join(__dirname, "..", ".env"));
    possiblePaths.push(path.join(__dirname, "..", "..", ".env.development"));
    possiblePaths.push(path.join(__dirname, "..", "..", ".env"));
  }

  for (const tryPath of possiblePaths) {
    try {
      const result = dotenv.config({ path: tryPath });
      if (!result.error) {
        envPath = tryPath;
        break;
      }
    } catch {
      logger.debug(`Failed to load .env from ${tryPath}`);
    }
  }

  if (!envPath) {
    dotenv.config();
  }
  
  if (envPath) {
    logger.info(`Loaded environment from: ${envPath}`);
  }
} catch {
  logger.debug("Failed to initialize environment");
}

const config = getSupabaseConfig();
const supabaseUrl = config.url;
const supabaseServiceKey = config.serviceKey;
const supabaseAnonKey = config.anonKey;

if (!supabaseUrl || !supabaseServiceKey) {
  logger.warn("Supabase credentials missing in .env file!");
  logger.warn(`VITE_SUPABASE_URL: ${supabaseUrl ? "present" : "missing"}`);
  logger.warn(
    `SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey ? "present" : "missing"}`,
  );
}

function createSupabaseClients(
  url?: string,
  serviceKey?: string,
  anonKey?: string,
): {
  admin: SupabaseClient;
  anon: SupabaseClient;
} {
  const validUrl = url || supabaseUrl || "https://placeholder.supabase.co";
  const validKey = serviceKey || supabaseServiceKey || "placeholder-key";
  const validAnonKey = anonKey || supabaseAnonKey || validKey;

  try {
    const admin = createClient(validUrl, validKey);
    const anon = createClient(validUrl, validAnonKey);
    logger.info("Supabase clients initialized successfully");
    return { admin, anon };
  } catch (error) {
    logger.error("Failed to initialize Supabase clients:", error);
    const placeholderUrl = "https://placeholder.supabase.co";
    const placeholderKey = "placeholder-key";
    return {
      admin: createClient(placeholderUrl, placeholderKey),
      anon: createClient(placeholderUrl, placeholderKey),
    };
  }
}

const clients = createSupabaseClients();

let currentConfig = {
  url: supabaseUrl,
  serviceKey: supabaseServiceKey,
  anonKey: supabaseAnonKey,
};

export const getSupabaseAdmin = () => clients.admin;
export const getSupabaseAnon = () => clients.anon;

export const reinitializeSupabaseClients = (
  config: { url: string; serviceKey: string; anonKey: string },
) => {
  if (!config.url || !config.serviceKey) {
    throw new Error("URL and service key are required");
  }

  try {
    const newClients = createSupabaseClients(
      config.url,
      config.serviceKey,
      config.anonKey,
    );
    clients.admin = newClients.admin;
    clients.anon = newClients.anon;
    currentConfig = {
      url: config.url,
      serviceKey: config.serviceKey,
      anonKey: config.anonKey,
    };
    logger.info("Supabase clients reinitialized successfully");
    return { success: true };
  } catch (error) {
    logger.error("Failed to reinitialize Supabase clients:", error);
    return { success: false, error: "Failed to reinitialize clients" };
  }
};

export const getCurrentSupabaseConfig = () => ({ ...currentConfig });

export const createClientWithToken = (token: string): SupabaseClient => {
  const validUrl = currentConfig.url || "https://placeholder.supabase.co";
  const validAnonKey = currentConfig.anonKey || "placeholder-key";

  try {
    return createClient(validUrl, validAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });
  } catch (error) {
    logger.error("Failed to create Supabase client with token:", error);
    return createClient("https://placeholder.supabase.co", "placeholder-key");
  }
};
