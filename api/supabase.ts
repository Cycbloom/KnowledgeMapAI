import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { logger } from "./utils/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
// Local Supabase service_role key (matching .env.development).
// Used ONLY as a development fallback when SUPABASE_SERVICE_ROLE_KEY is missing.
// NOTE: The old official demo key (signature ...JyHcsQwClqkuYnl9pJeCDr6Pmns) no
// longer works with newer Supabase CLI versions. This key matches the local
// Supabase JWT secret and is the same value Kong gateway issues for sb_secret_*.
const DEMO_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

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

  // Env file loading strategy (Vite-compatible order):
  // - Production: load .env.production with override=false (system env wins)
  // - Development: load .env.development with override=true (beats pre-set cloud
  //   values from --env-file or other modules), then .env.development.local with
  //   override=true (CI writes instance-specific keys extracted from `supabase status`)
  const envFiles: Array<{ file: string; override: boolean }> = [];

  if (isPackaged) {
    const resourcesPath = (process as { resourcesPath?: string }).resourcesPath;
    if (resourcesPath) {
      envFiles.push({ file: path.join(resourcesPath, ".env.production"), override: false });
    }
    envFiles.push({ file: path.join(__dirname, "..", ".env.production"), override: false });
    envFiles.push({ file: path.join(__dirname, "..", "..", ".env.production"), override: false });
  } else if (isDevelopment()) {
    // .env.development: committed dev config with local Supabase keys.
    // override=true ensures local values win over pre-set cloud values
    // (e.g., from --env-file=.env or system env vars).
    envFiles.push({ file: path.join(__dirname, "..", ".env.development"), override: true });
    // .env.development.local: gitignored, CI writes instance-specific keys here.
    // override=true so CI-extracted keys override the fixed .env.development values.
    envFiles.push({ file: path.join(__dirname, "..", ".env.development.local"), override: true });
    // Parent directory fallbacks (e.g., when running from api/ subdir)
    envFiles.push({ file: path.join(__dirname, "..", "..", ".env.development"), override: true });
    envFiles.push({ file: path.join(__dirname, "..", "..", ".env.development.local"), override: true });
  } else {
    envFiles.push({ file: path.join(__dirname, "..", ".env"), override: false });
    envFiles.push({ file: path.join(__dirname, "..", "..", ".env"), override: false });
  }

  for (const { file: tryPath, override } of envFiles) {
    try {
      const result = dotenv.config({ path: tryPath, override });
      if (!result.error) {
        envPath = tryPath;
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
