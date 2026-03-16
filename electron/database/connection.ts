import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: Database.Database | null = null;

export interface MigrationRecord {
  id: number;
  name: string;
  applied_at: string;
}

export function getDatabasePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'knowledgemap.db');
}

export function getMigrationsPath(): string {
  return path.join(__dirname, 'migrations');
}

export function getSeedsPath(): string {
  return path.join(__dirname, 'seeds');
}

export function initializeDatabase(): Database.Database {
  if (db) {
    return db;
  }

  const dbPath = getDatabasePath();
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    return initializeDatabase();
  }
  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function createMigrationsTable(): void {
  const database = getDatabase();
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `);
}

export function getAppliedMigrations(): Set<string> {
  const database = getDatabase();
  createMigrationsTable();
  
  const rows = database.prepare('SELECT name FROM migrations').all() as { name: string }[];
  return new Set(rows.map(row => row.name));
}

export function getPendingMigrations(): string[] {
  const migrationsPath = getMigrationsPath();
  const appliedMigrations = getAppliedMigrations();
  
  if (!fs.existsSync(migrationsPath)) {
    return [];
  }
  
  const files = fs.readdirSync(migrationsPath)
    .filter(file => file.endsWith('.sql'))
    .sort();
  
  return files.filter(file => !appliedMigrations.has(file));
}

export function applyMigration(migrationFile: string): void {
  const database = getDatabase();
  const migrationsPath = getMigrationsPath();
  const filePath = path.join(migrationsPath, migrationFile);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Migration file not found: ${migrationFile}`);
  }
  
  const sql = fs.readFileSync(filePath, 'utf-8');
  
  const applyMigrationTx = database.transaction(() => {
    database.exec(sql);
    
    const stmt = database.prepare('INSERT INTO migrations (name) VALUES (?)');
    stmt.run(migrationFile);
  });
  
  applyMigrationTx();
}

export function runMigrations(): { applied: string[]; errors: Error[] } {
  const pendingMigrations = getPendingMigrations();
  const applied: string[] = [];
  const errors: Error[] = [];
  
  for (const migration of pendingMigrations) {
    try {
      applyMigration(migration);
      applied.push(migration);
      console.log(`Applied migration: ${migration}`);
    } catch (error) {
      errors.push(error as Error);
      console.error(`Failed to apply migration ${migration}:`, error);
      break;
    }
  }
  
  return { applied, errors };
}

export function getMigrationStatus(): {
  applied: string[];
  pending: string[];
} {
  const appliedMigrations = getAppliedMigrations();
  const migrationsPath = getMigrationsPath();
  
  let allMigrations: string[] = [];
  if (fs.existsSync(migrationsPath)) {
    allMigrations = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();
  }
  
  return {
    applied: Array.from(appliedMigrations).sort(),
    pending: allMigrations.filter(m => !appliedMigrations.has(m))
  };
}

export function query<T = unknown>(sql: string, params: unknown[] = []): T[] {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  return stmt.all(...params) as T[];
}

export function queryOne<T = unknown>(sql: string, params: unknown[] = []): T | undefined {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  return stmt.get(...params) as T | undefined;
}

export function execute(sql: string, params: unknown[] = []): Database.RunResult {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  return stmt.run(...params);
}

export function executeMany(sql: string, paramsList: unknown[][]): Database.RunResult[] {
  const database = getDatabase();
  const stmt = database.prepare(sql);
  const results: Database.RunResult[] = [];
  
  const insertMany = database.transaction(() => {
    for (const params of paramsList) {
      results.push(stmt.run(...params));
    }
  });
  
  insertMany();
  return results;
}

export function transaction<T>(fn: () => T): T {
  const database = getDatabase();
  return database.transaction(fn)();
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function now(): string {
  return new Date().toISOString();
}

export function toJson(value: unknown): string {
  return JSON.stringify(value);
}

export function fromJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
