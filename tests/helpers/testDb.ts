/**
 * Local Supabase client factory for integration tests.
 *
 * Reads connection config from environment variables (same names the app uses):
 *   - VITE_SUPABASE_URL          (defaults to http://127.0.0.1:54321 per project rules)
 *   - VITE_SUPABASE_ANON_KEY      (anon public key — subject to RLS)
 *   - SUPABASE_SERVICE_ROLE_KEY   (service role key — bypasses RLS, for seeding/cleanup)
 *
 * NOTE: SUPABASE_SERVICE_ROLE_KEY must be set in .env.test or .env.development
 * before running integration tests. Retrieve it from `supabase status` output
 * (local dev) or Supabase Dashboard > Project Settings > API (cloud).
 *
 * Usage:
 *   import { describeIfDbAvailable, getAdminClient, cleanTable } from '../helpers/testDb';
 *
 *   describeIfDbAvailable('graphs integration', () => {
 *     afterEach(async () => { await cleanTable('graphs'); });
 *     // ...
 *   });
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { describe } from 'vitest';

// Read from environment — set in .env.test or .env.development.
// Local Supabase default URL from project rules (supabase/config.toml [api] port = 54321).
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Cache client instances — one per test run for performance.
let adminClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

/**
 * Returns a Supabase client authenticated with the service role key.
 * The service role key bypasses Row Level Security (RLS), making it suitable
 * for test seeding and cleanup operations.
 *
 * @throws Error if SUPABASE_SERVICE_ROLE_KEY is not set
 */
export function getAdminClient(): SupabaseClient {
  if (!adminClient) {
    if (!SUPABASE_SERVICE_KEY) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is not set. Set it in .env.test or .env.development. ' +
          'The service role key bypasses RLS and is required for test seeding/cleanup. ' +
          'Retrieve it via `supabase status` (local) or Supabase Dashboard > API (cloud).',
      );
    }
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return adminClient;
}

/**
 * Returns a Supabase client authenticated with the anon public key.
 * This client is subject to Row Level Security (RLS), making it suitable
 * for testing RLS policies and user-facing query behaviour.
 *
 * @throws Error if VITE_SUPABASE_ANON_KEY is not set
 */
export function getAnonClient(): SupabaseClient {
  if (!anonClient) {
    if (!SUPABASE_ANON_KEY) {
      throw new Error(
        'VITE_SUPABASE_ANON_KEY is not set. Set it in .env.test or .env.development.',
      );
    }
    anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return anonClient;
}

/**
 * Creates a Supabase client and signs in with email/password.
 * The returned client has an active session and is subject to RLS policies
 * for the authenticated user.
 *
 * @throws Error if login fails or anon key is missing
 */
export async function getAuthedClient(
  email: string,
  password: string,
): Promise<SupabaseClient> {
  if (!SUPABASE_ANON_KEY) {
    throw new Error(
      'VITE_SUPABASE_ANON_KEY is not set. Set it in .env.test or .env.development.',
    );
  }
  // persistSession: false — keep the session in memory only. The jsdom test
  // environment (src/setupTests.ts) mocks window.localStorage with no-op
  // stubs, which would prevent session persistence/retrieval. In-memory
  // sessions are sufficient for integration tests and consistent with
  // getAdminClient/getAnonClient above.
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Failed to sign in as ${email}: ${error.message}`);
  }
  return client;
}

/**
 * Truncates a table using the admin client (bypasses RLS).
 *
 * Uses a `truncate_table` PostgreSQL function via RPC to execute
 * `TRUNCATE TABLE <name> CASCADE`. This handles foreign key dependencies
 * and resets identity sequences.
 *
 * Required database function (add to a migration):
 *   CREATE OR REPLACE FUNCTION truncate_table(table_name TEXT)
 *   RETURNS void AS $$
 *   BEGIN
 *     EXECUTE format('TRUNCATE TABLE %I CASCADE', table_name);
 *   END;
 *   $$ LANGUAGE plpgsql SECURITY DEFINER;
 *
 * @throws Error if the truncate_table function is missing or fails
 */
export async function cleanTable(tableName: string): Promise<void> {
  const client = getAdminClient();
  const { error } = await client.rpc('truncate_table', { table_name: tableName });
  if (error) {
    throw new Error(
      `Failed to truncate table ${tableName}: ${error.message}. ` +
        'Ensure the truncate_table(text) function exists in the database.',
    );
  }
}

/**
 * Truncates multiple tables in order using the admin client.
 *
 * @param tableNames - Ordered list of table names to truncate
 */
export async function cleanTables(tableNames: string[]): Promise<void> {
  for (const name of tableNames) {
    await cleanTable(name);
  }
}

/**
 * Wraps `describe`, running the suite only when local Supabase is available
 * (i.e. URL and anon key are configured). When unavailable, the suite is
 * skipped so CI environments without a database don't fail.
 *
 * @example
 *   describeIfDbAvailable('graphs API', () => {
 *     it('creates a graph', async () => { ... });
 *   });
 */
export function describeIfDbAvailable(name: string, fn: () => void): void {
  const isAvailable = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
  if (isAvailable) {
    describe(name, fn);
  } else {
    describe.skip(name, fn);
  }
}
