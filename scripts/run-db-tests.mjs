#!/usr/bin/env node
/**
 * Database test runner for pgTAP tests.
 *
 * Runs every `*.sql` file in `tests/database/` against the local Supabase
 * PostgreSQL instance and reports TAP results. Each test file is expected to
 * follow the pgTAP pattern:
 *
 *   BEGIN;
 *   SELECT plan(N);
 *   -- assertions...
 *   SELECT * FROM finish();
 *   ROLLBACK;
 *
 * Prerequisites:
 *   - Local Supabase running (`npm run db:local:start`)
 *   - `psql` available in PATH (bundled with Supabase CLI / PostgreSQL)
 *   - pgTAP extension enabled (added to `00_extensions_and_types.sql`)
 *
 * Usage: `npm run test:db`
 *
 * Connection defaults match `supabase/config.toml` ([db] port = 54322).
 * Override via environment variables: DB_HOST, DB_PORT, DB_USER, DB_NAME,
 * PGPASSWORD (defaults to the local Supabase password "postgres").
 *
 * Exit codes:
 *   0 — all tests passed (or no test files found)
 *   1 — one or more tests failed
 *   2 — infrastructure error (psql missing, Supabase not running, etc.)
 */

import { spawnSync } from 'child_process';
import { readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Connection config — matches supabase/config.toml ([db] port = 54322).
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = process.env.DB_PORT || '54322';
const DB_USER = process.env.DB_USER || 'postgres';
const DB_NAME = process.env.DB_NAME || 'postgres';
// Local Supabase default password; allow override via inherited env.
const DB_PASSWORD = process.env.PGPASSWORD || 'postgres';
const TESTS_DIR = resolve(__dirname, '../tests/database');

const PSQL_ENV = { ...process.env, PGPASSWORD: DB_PASSWORD };

// On Windows, spawnSync needs shell:true to resolve .cmd shims on PATH (e.g.
// a psql.cmd wrapper that delegates to the Supabase docker container). When
// shell is enabled, args containing spaces or cmd.exe metacharacters must be
// quoted so they survive cmd.exe's argument parsing.
const ON_WINDOWS = process.platform === 'win32';

function shellQuoteWin(arg) {
  if (!ON_WINDOWS) return arg;
  if (/[\s;&|<>()^!"]/.test(arg)) {
    return '"' + arg.replace(/"/g, '""') + '"';
  }
  return arg;
}

// -X: skip ~/.psqlrc  -tA: tuples-only unaligned (clean TAP output)
// -v ON_ERROR_STOP=1: abort on first SQL error
const PSQL_BASE_ARGS = [
  '-h', DB_HOST,
  '-p', DB_PORT,
  '-U', DB_USER,
  '-d', DB_NAME,
  '-X',
  '-tA',
  '-v', 'ON_ERROR_STOP=1',
];

function runPsql(args, label) {
  const allArgs = [...PSQL_BASE_ARGS, ...args];
  const finalArgs = ON_WINDOWS ? allArgs.map(shellQuoteWin) : allArgs;
  const result = spawnSync('psql', finalArgs, {
    encoding: 'utf-8',
    env: PSQL_ENV,
    shell: ON_WINDOWS,
  });
  if (result.error) {
    // ENOENT — psql not installed / not on PATH
    if (result.error.code === 'ENOENT') {
      return {
        status: 2,
        stdout: '',
        stderr: `psql not found in PATH. ${label}`,
      };
    }
    return {
      status: 2,
      stdout: result.stdout || '',
      stderr: `${result.error.message}`,
    };
  }
  return {
    status: result.status ?? 2,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

function checkPsqlAvailable() {
  const version = spawnSync('psql', ['--version'], { encoding: 'utf-8', shell: process.platform === 'win32' });
  if (version.error || version.status !== 0) {
    console.error('❌ psql not found in PATH.');
    console.error('   Start local Supabase (which bundles psql): npm run db:local:start');
    return false;
  }
  return true;
}

function ensurePgTAP() {
  const result = runPsql(['-c', 'CREATE EXTENSION IF NOT EXISTS pgtap;'], 'enabling pgTAP');
  if (result.status !== 0) {
    console.error('❌ Could not enable pgTAP extension.');
    if (/could not connect|connection refused/i.test(result.stderr)) {
      console.error('   Local Supabase is not running. Start it with: npm run db:local:start');
    } else if (result.stderr) {
      console.error('   psql error:', result.stderr.trim());
    }
    return false;
  }
  return true;
}

function findTestFiles(dir) {
  let entries = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => join(dir, f));
}

function parseTap(stdout) {
  const lines = stdout.split('\n').filter(Boolean);
  const assertions = lines.filter((l) => /^(ok|not ok)\s+\d+/i.test(l));
  const passed = assertions.filter((l) => /^ok\s+\d+/i.test(l)).length;
  const failed = assertions.filter((l) => /^not ok\s+\d+/i.test(l)).length;
  return { passed, failed };
}

function runTestFile(filePath) {
  const fileName = filePath.split(/[\\/]/).pop();
  const result = runPsql(['-f', filePath], `running ${fileName}`);
  const { passed, failed } = parseTap(result.stdout);
  return { fileName, status: result.status, passed, failed, stdout: result.stdout, stderr: result.stderr };
}

function main() {
  const tests = findTestFiles(TESTS_DIR);
  if (tests.length === 0) {
    console.log('ℹ️  No .sql test files found in tests/database/');
    console.log('   Add pgTAP tests as tests/database/*.test.sql');
    process.exit(0);
  }

  if (!checkPsqlAvailable()) process.exit(2);
  if (!ensurePgTAP()) process.exit(2);
  console.log(`✓ pgTAP ready on ${DB_HOST}:${DB_PORT}/${DB_NAME}\n`);
  console.log(`Running ${tests.length} test file(s)...\n`);

  let totalPassed = 0;
  let totalFailed = 0;
  const failedFiles = [];

  for (const testPath of tests) {
    const r = runTestFile(testPath);
    const ok = r.failed === 0 && r.status === 0;
    const marker = ok ? 'PASS' : 'FAIL';
    console.log(`[${marker}] ${r.fileName} — ${r.passed} ok, ${r.failed} failed`);
    totalPassed += r.passed;
    totalFailed += r.failed;
    if (!ok) {
      failedFiles.push(r);
      // Surface failing assertions and any error noise.
      const tapLines = r.stdout
        .split('\n')
        .filter((l) => /^(not ok|#)\s/i.test(l));
      if (tapLines.length) {
        for (const line of tapLines) console.log(`        ${line}`);
      }
      if (r.stderr.trim()) {
        const firstErr = r.stderr.split('\n').filter(Boolean).slice(0, 3);
        for (const line of firstErr) console.log(`        ${line}`);
      }
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Total: ${totalPassed} passed, ${totalFailed} failed (${tests.length} file(s))`);

  if (totalFailed > 0) {
    console.log(`\nFailed files: ${failedFiles.map((f) => f.fileName).join(', ')}`);
    process.exit(1);
  }
  console.log('\n✅ All database tests passed');
  process.exit(0);
}

main();
