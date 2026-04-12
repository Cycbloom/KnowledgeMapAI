import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { logger } from "./utils/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    possiblePaths.push(path.join(__dirname, "..", ".env.production"));
    possiblePaths.push(path.join(__dirname, "..", "..", ".env.production"));
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
} catch {
  logger.debug("Failed to initialize environment");
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

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
  const validUrl = supabaseUrl || "https://placeholder.supabase.co";
  const validAnonKey = supabaseAnonKey || "placeholder-key";

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
