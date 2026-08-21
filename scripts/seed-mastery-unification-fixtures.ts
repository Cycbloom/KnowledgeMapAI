import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';
import * as path from 'node:path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import * as crypto from 'node:crypto';

dotenv.config();

const _RAW_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!_RAW_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase credentials: set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env / .env.local / .env.development');
  process.exit(1);
}

// Normalize URL: host.docker.internal is a Docker-bridge DNS name that is
// NOT resolvable from the native Windows host shell. When the Supabase stack
// runs locally via supabase CLI (Docker Desktop), Kong exposes the REST API
// directly on localhost:54321. Rewrite the client URL so @supabase/supabase-js
// (which uses fetch under the hood) can reach Kong without Docker networking.
const SUPABASE_URL = (() => {
  try {
    const u = new URL(_RAW_URL);
    if (u.hostname === 'host.docker.internal') u.hostname = '127.0.0.1';
    return u.toString();
  } catch {
    return _RAW_URL;
  }
})();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Same email/password format as src/utils/silentAuth.ts generateCredentials. */
interface OwnerCredentials { email: string; password: string; }

const CREDENTIALS_OUTPUT_FILE = path.resolve(
  import.meta.dirname ?? process.cwd(),
  '../.seed-owner-credentials.json',
);

/** Mirrors frontend provisionOwner's credential generator — owner-<uuid>@local.app + 32-byte base64 password. */
function generateOwnerCredentials(): OwnerCredentials {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return {
    email: `owner-${crypto.randomUUID()}@local.app`,
    password: Buffer.from(bytes).toString('base64'),
  };
}

async function loadPersistedCredentials(userId: string): Promise<OwnerCredentials | null> {
  try {
    const raw = await readFile(CREDENTIALS_OUTPUT_FILE, 'utf-8');
    const p = JSON.parse(raw) as unknown;
    if (
      p && typeof p === 'object' &&
      (p as { userId?: string }).userId === userId &&
      typeof (p as { email?: unknown }).email === 'string' &&
      typeof (p as { password?: unknown }).password === 'string'
    ) {
      return { email: (p as { email: string }).email, password: (p as { password: string }).password };
    }
  } catch {
    /* fall through */
  }
  return null;
}

async function persistCredentials(creds: OwnerCredentials & { userId: string }): Promise<void> {
  try {
    await mkdir(path.dirname(CREDENTIALS_OUTPUT_FILE), { recursive: true });
    await writeFile(CREDENTIALS_OUTPUT_FILE, JSON.stringify(creds, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[seed:mastery-fixtures] could not write credentials file (skipping):', (err as Error).message);
  }
}

/** Reset password via pg UPDATE so we always know a valid login for an adopted existing user. */
async function resetUserPasswordViaPg(userId: string, creds: OwnerCredentials): Promise<boolean> {
  const pool = buildPgPool();
  let client: import('pg').PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    const r = await client.query(
      `UPDATE auth.users
          SET encrypted_password = crypt($1::text, gen_salt('bf')),
              email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
              updated_at = NOW(),
              raw_user_meta_data = COALESCE(NULLIF(raw_user_meta_data, '{}'::jsonb), '{"name":"Owner"}'::jsonb)
        WHERE id = $2::uuid
          AND (is_sso_user = false OR is_sso_user IS NULL)`,
      [creds.password, userId],
    );
    return (r.rowCount ?? 0) > 0;
  } catch (err) {
    console.warn('[seed:mastery-fixtures] pg UPDATE auth.users password failed:', (err as Error).message);
    return false;
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
  }
}

async function materializeCredentialsFor(userId: string, emailHint?: string | null): Promise<OwnerCredentials> {
  const cached = await loadPersistedCredentials(userId);
  if (cached) return cached;
  const keepEmail = emailHint && /^owner-[0-9a-f-]{36}@local\.app$/i.test(emailHint);
  const fresh: OwnerCredentials = keepEmail
    ? { email: emailHint, password: generateOwnerCredentials().password }
    : generateOwnerCredentials();
  await resetUserPasswordViaPg(userId, fresh);
  return fresh;
}

function printLocalStorageInjectCommand(creds: OwnerCredentials): void {
  const payload = JSON.stringify(JSON.stringify(creds));
  console.log('');
  console.log('═══════════════ Connect frontend to these fixtures ═══════════════');
  console.log('  To see the mastery fixtures in the app run this in DevTools (F12):');
  console.log('');
  console.log(`     localStorage.clear();`);
  console.log(`     localStorage.setItem("km-owner-credentials", ${payload});`);
  console.log(`     location.reload();`);
  console.log('');
  console.log(`  Owner credentials (manual sign-in fallback):`);
  console.log(`        Email:    ${creds.email}`);
  console.log(`        Password: ${creds.password}`);
  console.log(`  Saved to: .seed-owner-credentials.json`);
  console.log('═══════════════════════════════════════════════════════════════════');
}

function offsetDate(minutesAgo: number): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - minutesAgo);
  return d.toISOString();
}

function addDays(base: string, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Build a pg.Pool from env — falls back to Supabase local defaults (54322/postgres). */
function buildPgPool(): Pool {
  let host = process.env.DB_HOST;
  if (!host) {
    try { host = new URL(SUPABASE_URL).hostname; } catch { host = '127.0.0.1'; }
  }
  // host.docker.internal is Docker-internal DNS — not resolvable from the Windows host shell.
  // When Supabase runs on the same machine via supabase CLI (Docker Desktop), the
  // Postgres port (default 54322) is exposed directly on localhost/127.0.0.1.
  if (host === 'host.docker.internal') host = '127.0.0.1';
  const port = parseInt(process.env.DB_PORT ?? '', 10) || 54322;
  const user = process.env.DB_USER || 'postgres';
  const database = process.env.DB_NAME || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';
  return new Pool({ host, port, user, database, password, ssl: false, connectionTimeoutMillis: 5000 });
}

/** Query auth.users via direct Postgres — prefer frontend-style owner-<uuid>@local.app users. */
async function listOwnerUserViaPg(): Promise<{ id: string; email?: string | null } | null> {
  const pool = buildPgPool();
  try {
    const { rows } = await pool.query<{ id: string; email?: string | null }>(
      `SELECT id::text AS id, email FROM auth.users ORDER BY
         CASE WHEN email ~ '^owner-[0-9a-f-]{36}@local\\.app$' THEN 0 ELSE 1 END ASC,
         created_at ASC
       LIMIT 1`,
    );
    return rows.length ? rows[0] : null;
  } catch (err) {
    console.warn('[seed:mastery-fixtures] pg query auth.users failed:', (err as Error).message);
    return null;
  } finally {
    await pool.end().catch(() => {});
  }
}

/** Last-resort: create demo owner directly via SQL (bcrypt) into auth.users + auth.identities. */
async function createOwnerUserViaPg(
  credentials: OwnerCredentials = generateOwnerCredentials(),
): Promise<{ id: string; credentials: OwnerCredentials } | null> {
  const { email: EMAIL, password: PLAIN } = credentials;
  const pool = buildPgPool();
  let client: import('pg').PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO auth.users (
         id, instance_id, email, encrypted_password, email_confirmed_at,
         invited_at, confirmation_token, confirmation_sent_at, recovery_token,
         recovery_sent_at, email_change_token_new, email_change, email_change_sent_at,
         raw_app_meta_data, raw_user_meta_data, is_super_admin, role, aud,
         created_at, updated_at, phone, phone_confirmed_at, phone_change,
         phone_change_token, phone_change_sent_at, email_change_token_current,
         email_change_confirm_status, banned_until, reauthentication_token,
         reauthentication_sent_at, is_sso_user, deleted_at
       ) VALUES (
         gen_random_uuid(),
         '00000000-0000-0000-0000-000000000000'::uuid,
         $1::text,
         crypt($2::text, gen_salt('bf')),
         NOW(),
         NULL, '', NULL, '', NULL, '', '', NULL,
         '{"provider":"email","providers":["email"]}'::jsonb, '{"name":"Owner"}'::jsonb, FALSE,
         'authenticated', 'authenticated',
         NOW(), NOW(), NULL, NULL, '', '', NULL,
         '', 0, NULL, '', NULL,
         FALSE, NULL
       )
       ON CONFLICT (email) WHERE (is_sso_user = false) DO UPDATE SET
         updated_at = NOW(),
         email_confirmed_at = NOW(),
         encrypted_password = EXCLUDED.encrypted_password,
         raw_user_meta_data = '{"name":"Owner"}'::jsonb
       RETURNING id::text AS id`,
      [EMAIL, PLAIN],
    );
    const uid = rows[0]?.id;
    if (!uid) return null;
    await client.query(
      `INSERT INTO auth.identities (
         id, provider_id, user_id, identity_data, provider,
         last_sign_in_at, created_at, updated_at, email
       ) VALUES (
         gen_random_uuid(), $1::text, $2::uuid,
         jsonb_build_object('sub', $1::text, 'email', $3::text),
         'email', NOW(), NOW(), NOW(), $3::text
       ) ON CONFLICT (provider, provider_id) DO NOTHING`,
      [uid, uid, EMAIL],
    ).catch(() => {});
    return { id: uid, credentials };
  } catch (err) {
    console.warn('[seed:mastery-fixtures] pg INSERT auth.users failed:', (err as Error).message);
    return null;
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
  }
}

async function ensureOwnerUser(
  client: SupabaseClient,
): Promise<{ userId: string; credentials: OwnerCredentials }> {
  // Path A: reuse an existing user_id already present in public tables (fastest + safest)
  const { data, error } = await client
    .from('user_tasks')
    .select('user_id')
    .limit(1)
    .maybeSingle();

  if (!error && data?.user_id && UUID_RE.test(data.user_id)) {
    const creds = await materializeCredentialsFor(data.user_id);
    await persistCredentials({ userId: data.user_id, email: creds.email, password: creds.password });
    console.log(`Reusing existing user: ${data.user_id}`);
    return { userId: data.user_id, credentials: creds };
  }

  const { data: kpData, error: kpErr } = await client
    .from('knowledge_points')
    .select('owner_id')
    .limit(1)
    .maybeSingle();

  if (!kpErr && kpData?.owner_id && UUID_RE.test(kpData.owner_id)) {
    const creds = await materializeCredentialsFor(kpData.owner_id);
    await persistCredentials({ userId: kpData.owner_id, email: creds.email, password: creds.password });
    console.log(`Reusing existing user via KP: ${kpData.owner_id}`);
    return { userId: kpData.owner_id, credentials: creds };
  }

  // Path B: direct Postgres auth.users (bypasses Auth Admin REST API — common failure
  //          point after `supabase db reset` when Kong/PostgREST aren't kept running)
  const pgUser = await listOwnerUserViaPg();
  if (pgUser && UUID_RE.test(pgUser.id)) {
    const creds = await materializeCredentialsFor(pgUser.id, pgUser.email ?? null);
    await persistCredentials({ userId: pgUser.id, email: creds.email, password: creds.password });
    console.log(`Reusing owner user via Postgres auth.users: ${pgUser.id}`);
    return { userId: pgUser.id, credentials: creds };
  }

  // Path C: Auth Admin REST API — create user if reachable
  const credentials = generateOwnerCredentials();
  try {
    const { data: signUp, error: signUpErr } = await client.auth.admin.createUser({
      email: credentials.email,
      password: credentials.password,
      email_confirm: true,
      user_metadata: { name: 'Owner' },
    });
    if (signUpErr || !signUp.user) {
      throw signUpErr ?? new Error('createUser returned no user');
    }
    await persistCredentials({ userId: signUp.user.id, email: credentials.email, password: credentials.password });
    console.log(`Upserted owner user via Auth Admin API: ${signUp.user.id}`);
    return { userId: signUp.user.id, credentials };
  } catch (err) {
    // Path D (new): SQL INSERT fallback — bypasses GoTrue entirely, needs only Postgres.
    console.warn(`Auth admin API unavailable (${(err as Error).message}); attempting SQL INSERT into auth.users...`);
    const sqlCreated = await createOwnerUserViaPg(credentials);
    if (sqlCreated) {
      await persistCredentials({ userId: sqlCreated.id, email: sqlCreated.credentials.email, password: sqlCreated.credentials.password });
      console.log(`Upserted owner user via Postgres SQL: ${sqlCreated.id}`);
      return { userId: sqlCreated.id, credentials: sqlCreated.credentials };
    }
    // Path E (last resort): well-known placeholder UUID — may fail FK if auth.users row absent
    const fallback = '00000000-0000-4000-8000-000000000001';
    console.warn(
      `SQL INSERT also unavailable; using fallback userId=${fallback}.\n` +
      `  Tip: run \`npm run db:local:start\` first to launch all Supabase services.`,
    );
    const fallbackCreds = await materializeCredentialsFor(fallback);
    await persistCredentials({ userId: fallback, email: fallbackCreds.email, password: fallbackCreds.password });
    return { userId: fallback, credentials: fallbackCreds };
  }
}

type FixtureIds = {
  userId: string;
  kpIds: string[];
  cardIds: string[];
  taskId: string;
  subtaskIds: string[];
};

async function insertFixtures(client: SupabaseClient, userId: string): Promise<FixtureIds> {
  const now = new Date().toISOString();

  const kpToInsert = [
    { id: crypto.randomUUID(), owner_id: userId, title: 'FSRS Fixture: KP 入门 (mastery 0.12)', mastery_level: 0.12, content: '低掌握度知识点，对应 New / Learning 卡片。', created_at: now, updated_at: now },
    { id: crypto.randomUUID(), owner_id: userId, title: 'FSRS Fixture: KP 进阶 (mastery 0.48)', mastery_level: 0.48, content: '中等掌握度知识点，对应 Learning / Review 卡片。', created_at: now, updated_at: now },
    { id: crypto.randomUUID(), owner_id: userId, title: 'FSRS Fixture: KP 精通 (mastery 0.78)', mastery_level: 0.78, content: '高掌握度知识点，对应 Review 状态卡片（稳定 S 值）。', created_at: now, updated_at: now },
  ];

  const { error: kpErr } = await client.from('knowledge_points').upsert(kpToInsert, { onConflict: 'id' });
  if (kpErr) throw kpErr;
  const kpIds = kpToInsert.map((k) => k.id);
  console.log(`Upserted ${kpIds.length} knowledge_points (mastery 0.12 / 0.48 / 0.78)`);

  const states: Array<'New' | 'Learning' | 'Review' | 'Relearning' | 'Review'> = ['New', 'Learning', 'Review', 'Relearning', 'Review'];
  const stabilities = [0.1, 1, 7, 36, 365, 0.1, 1, 7, 36, 365];
  const reviewOffsetsMin = [0, 120, 1440, 10080, 43200, 5, 60, 720, 5040, 21600];

  const cards = [];
  for (let i = 0; i < 10; i++) {
    const kpIndex = i % 3;
    const state = states[i % 5];
    const S = stabilities[i];
    const D = 3 + (i % 5) * 0.4;
    const lastReviewMin = reviewOffsetsMin[i];
    const lastReviewIso = offsetDate(lastReviewMin);
    const retrievability = Math.exp(-Math.log(2) * (lastReviewMin / 1440) / Math.max(S, 0.001));
    const scheduledDays = Math.max(1, Math.round(S));
    const nextReviewIso = addDays(lastReviewIso, scheduledDays);
    cards.push({
      id: crypto.randomUUID(),
      user_id: userId,
      knowledge_point_id: kpIds[kpIndex],
      card_type: 'qa',
      question: `Fixture Q${i + 1} [S=${S} state=${state}]`,
      answer: `Fixture A${i + 1} – 对应 state=${state}, stability=${S}d, review@${lastReviewMin}min ago.`,
      difficulty: 1 + (i % 5),
      fsrs_state: state,
      fsrs_stability: S,
      fsrs_difficulty: D,
      fsrs_elapsed_days: lastReviewMin / 1440,
      fsrs_scheduled_days: scheduledDays,
      fsrs_retrievability: Number.isFinite(retrievability) ? Math.min(1, Math.max(0, retrievability)) : 0,
      fsrs_last_review: lastReviewIso,
      fsrs_repetitions: i < 5 ? i : 5 + ((i - 5) % 3),
      last_reviewed: lastReviewIso,
      next_review: nextReviewIso,
      review_count: i,
      created_at: offsetDate(reviewOffsetsMin[i] + 60),
      updated_at: lastReviewIso,
    });
  }

  const { error: cardErr } = await client.from('study_cards').upsert(cards, { onConflict: 'id' });
  if (cardErr) throw cardErr;
  const cardIds = cards.map((c) => c.id);
  console.log(`Upserted ${cardIds.length} study_cards covering states New/Learning/Review/Relearning + S=0.1/1/7/36/365 gradient`);

  const { data: task, error: taskErr } = await client
    .from('user_tasks')
    .insert({
      user_id: userId,
      title: 'FSRS Mastery Unification Fixture Task',
      description: 'Created by seed-mastery-unification-fixtures.ts – 包含 4 个子任务（overdue/now/future due dates）。',
      position: 0,
      status: 'in_progress',
      task_type: 'learning',
      estimated_duration: 60,
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (taskErr || !task?.id) throw taskErr ?? new Error('user_tasks insert returned no id');
  console.log(`Created user_task: ${task.id}`);

  const subtaskDueDates = [
    offsetDate(60 * 24 * 2),
    offsetDate(30),
    now,
    addDays(now, 7),
  ];

  const subtasks = [
    { id: crypto.randomUUID(), task_id: task.id, title: 'Fixture Subtask A: 过期 2 天 (KP 入门)', knowledge_point_id: kpIds[0], status: 'pending', learning_state: 'learning', due_date: subtaskDueDates[0], created_at: now, updated_at: now },
    { id: crypto.randomUUID(), task_id: task.id, title: 'Fixture Subtask B: 过期 30min (KP 进阶)', knowledge_point_id: kpIds[1], status: 'in_progress', learning_state: 'practice', due_date: subtaskDueDates[1], created_at: now, updated_at: now },
    { id: crypto.randomUUID(), task_id: task.id, title: 'Fixture Subtask C: 现在到期 (KP 精通)', knowledge_point_id: kpIds[2], status: 'pending', learning_state: 'review', due_date: subtaskDueDates[2], created_at: now, updated_at: now },
    { id: crypto.randomUUID(), task_id: task.id, title: 'Fixture Subtask D: 7 天后到期 (KP 进阶)', knowledge_point_id: kpIds[1], status: 'pending', learning_state: 'quiz', due_date: subtaskDueDates[3], created_at: now, updated_at: now },
  ];

  const { error: stErr } = await client.from('task_subtasks').upsert(subtasks, { onConflict: 'id' });
  if (stErr) {
    console.warn('task_subtasks upsert failed (possible missing mastery_level column?); retrying without extra fields:', stErr.message);
    const { error: stErr2 } = await client
      .from('task_subtasks')
      .upsert(
        subtasks.map(({ id, task_id, title, knowledge_point_id, status, learning_state, due_date, created_at, updated_at }) => ({
          id, task_id, title, knowledge_point_id, status, learning_state, due_date, created_at, updated_at,
        })),
        { onConflict: 'id' },
      );
    if (stErr2) throw stErr2;
  }
  const subtaskIds = subtasks.map((s) => s.id);
  console.log(`Upserted ${subtaskIds.length} task_subtasks (overdue / overdue-30min / now / future+7d)`);

  return { userId, kpIds, cardIds, taskId: task.id, subtaskIds };
}

async function main() {
  console.log('[seed:mastery-fixtures] Starting...');
  console.log(`[seed:mastery-fixtures] Supabase URL: ${SUPABASE_URL}`);

  const { userId, credentials } = await ensureOwnerUser(supabase);
  const { cardIds, kpIds, subtaskIds } = await insertFixtures(supabase, userId);

  console.log('');
  console.log('========================================');
  console.log(`Inserted ${cardIds.length} cards, ${kpIds.length} KPs, ${subtaskIds.length} subtasks`);
  console.log('========================================');
  console.log('Summary:');
  console.log(`  - Owner user:       ${userId} (${credentials.email})`);
  console.log(`  - Knowledge points: ${kpIds.length} (mastery 0.12 / 0.48 / 0.78)`);
  kpIds.forEach((id, i) => console.log(`      KP[${i}]: ${id}`));
  console.log(`  - Study cards:      ${cardIds.length}`);
  console.log(`      * States: New / Learning / Review / Relearning / Review (x2 each via gradient)`);
  console.log(`      * S gradient:   0.1, 1, 7, 36, 365 (x2)`);
  console.log(`      * Last review offsets (min): 0,120,1440,10080,43200 + 5,60,720,5040,21600`);
  console.log(`  - Task subtasks:    ${subtaskIds.length} (due dates: overdue-2d / overdue-30m / now / future+7d)`);
  subtaskIds.forEach((id, i) => console.log(`      Subtask[${i}]: ${id}`));
  console.log('========================================');
  console.log('[seed:mastery-fixtures] Done.');
  printLocalStorageInjectCommand(credentials);
}

main().catch((err) => {
  console.error('[seed:mastery-fixtures] FATAL:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
