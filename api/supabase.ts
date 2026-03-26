import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";
import { logger } from "./utils/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let envPath = null;

try {
  const isPackaged =
    process.mainModule?.filename?.includes("app.asar") ||
    (process as any).resourcesPath?.includes("resources");

  const possiblePaths = [];

  if (isPackaged) {
    if ((process as any).resourcesPath) {
      possiblePaths.push(
        path.join((process as any).resourcesPath, ".env.production"),
      );
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
    } catch {}
  }

  if (!envPath) {
    dotenv.config();
  }
} catch {}

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

let supabaseAdmin: any = null;
let supabaseAnon: any = null;

try {
  const validUrl = supabaseUrl || "https://placeholder.supabase.co";
  const validKey = supabaseServiceKey || "placeholder-key";
  const validAnonKey = supabaseAnonKey || validKey;

  supabaseAdmin = createClient(validUrl, validKey);
  supabaseAnon = createClient(validUrl, validAnonKey);

  logger.info("Supabase clients initialized successfully");
} catch (error) {
  logger.error("Failed to initialize Supabase clients:", error);
  const validUrl = "https://placeholder.supabase.co";
  const validKey = "placeholder-key";

  supabaseAdmin = createClient(validUrl, validKey);
  supabaseAnon = createClient(validUrl, validKey);
}

export { supabaseAdmin, supabaseAnon };

export const createClientWithToken = (token: string) => {
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
