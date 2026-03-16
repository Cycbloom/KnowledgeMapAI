import type { DatabaseInterface, DatabaseMode, DatabaseConfig } from './interface.js';
import { SQLiteAdapter } from './adapters/sqlite.js';
import { SupabaseAdapter } from './adapters/supabase.js';

let currentDatabase: DatabaseInterface | null = null;
let currentMode: DatabaseMode | null = null;

export function getDatabaseMode(): DatabaseMode {
  const mode = process.env.DATABASE_MODE;
  if (mode === 'local') return 'local';
  return 'cloud';
}

export function getDatabaseConfig(): DatabaseConfig {
  const mode = getDatabaseMode();

  return {
    mode,
    sqlite: {
      path: process.env.SQLITE_PATH || './data/knowledgemap.db',
    },
    supabase: {
      url: process.env.VITE_SUPABASE_URL || '',
      key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
    },
  };
}

export async function getDatabase(): Promise<DatabaseInterface> {
  if (currentDatabase && currentMode === getDatabaseMode()) {
    return currentDatabase;
  }

  const config = getDatabaseConfig();

  if (config.mode === 'local') {
    const adapter = new SQLiteAdapter(config.sqlite!.path);
    await adapter.connect();
    currentDatabase = adapter;
    currentMode = 'local';
    return adapter;
  } else {
    if (!config.supabase?.url || !config.supabase?.key) {
      throw new Error('Supabase URL and key are required for cloud mode');
    }
    const adapter = new SupabaseAdapter(config.supabase.url, config.supabase.key);
    await adapter.connect();
    currentDatabase = adapter;
    currentMode = 'cloud';
    return adapter;
  }
}

export async function initializeDatabase(): Promise<DatabaseInterface> {
  return getDatabase();
}

export async function closeDatabase(): Promise<void> {
  if (currentDatabase) {
    await currentDatabase.disconnect();
    currentDatabase = null;
    currentMode = null;
  }
}

export function isLocalMode(): boolean {
  return getDatabaseMode() === 'local';
}

export function isCloudMode(): boolean {
  return getDatabaseMode() === 'cloud';
}

export { DatabaseInterface, DatabaseMode, DatabaseConfig };
export { SQLiteAdapter } from './adapters/sqlite.js';
export { SupabaseAdapter } from './adapters/supabase.js';
