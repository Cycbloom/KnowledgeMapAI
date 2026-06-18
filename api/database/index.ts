import type { DatabaseInterface, DatabaseConfig } from './interface';
import { SupabaseAdapter } from './adapters/supabase';

let currentDatabase: DatabaseInterface | null = null;

export function getDatabaseConfig(): DatabaseConfig {
  return {
    supabase: {
      url: process.env.VITE_SUPABASE_URL || '',
      key: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
    },
  };
}

export async function getDatabase(): Promise<DatabaseInterface> {
  if (currentDatabase) {
    return currentDatabase;
  }

  const config = getDatabaseConfig();

  if (!config.supabase?.url || !config.supabase?.key) {
    throw new Error('Supabase URL and key are required');
  }
  
  const adapter = new SupabaseAdapter(config.supabase.url, config.supabase.key);
  await adapter.connect();
  currentDatabase = adapter;
  return adapter;
}

export async function initializeDatabase(): Promise<DatabaseInterface> {
  return getDatabase();
}

export async function closeDatabase(): Promise<void> {
  if (currentDatabase) {
    await currentDatabase.disconnect();
    currentDatabase = null;
  }
}

export { DatabaseInterface, DatabaseConfig };
export { SupabaseAdapter } from './adapters/supabase';
export { transactionExecutor } from './transactionExecutor';
