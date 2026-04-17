import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { logger } from "./utils/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LOCAL_SUPABASE_URL = "http://127.0.0.1:54321";
const LOCAL_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";
const LOCAL_SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

function isDevelopment(): boolean {
  const nodeEnv = process.env.NODE_ENV;
  return nodeEnv === "development" || !nodeEnv;
}

function getSupabaseConfig(): {
  url: string;
  serviceKey: string;
  anonKey: string;
} {
  const envUrl = process.env.VITE_SUPABASE_URL;
  const envServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const envAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (envUrl && envServiceKey) {
    return {
      url: envUrl,
      serviceKey: envServiceKey,
      anonKey: envAnonKey || envServiceKey,
    };
  }

  if (isDevelopment()) {
    logger.info("Using local Supabase configuration for development");
    return {
      url: LOCAL_SUPABASE_URL,
      serviceKey: LOCAL_SUPABASE_SERVICE_KEY,
      anonKey: LOCAL_SUPABASE_ANON_KEY,
    };
  }

  return {
    url: envUrl || "",
    serviceKey: envServiceKey || "",
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

function createSupabaseClients(): {
  admin: SupabaseClient;
  anon: SupabaseClient;
} {
  const validUrl = supabaseUrl || "https://placeholder.supabase.co";
  const validKey = supabaseServiceKey || "placeholder-key";
  const validAnonKey = supabaseAnonKey || validKey;

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

const { admin: supabaseAdmin, anon: supabaseAnon } = createSupabaseClients();

export { supabaseAdmin, supabaseAnon };

export const createClientWithToken = (token: string): SupabaseClient => {
  const tokenConfig = getSupabaseConfig();
  const validUrl = tokenConfig.url || "https://placeholder.supabase.co";
  const validAnonKey = tokenConfig.anonKey || "placeholder-key";

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
