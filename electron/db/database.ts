import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { TABLES, type TableDef, type ColumnDef } from './schema';
import { getInitialMigration } from './migrations/001_initial';

export class DatabaseManager {
  private db: Database.Database | null = null;
  private dbPath: string;
  private isInitialized = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  // Initialize database connection and run migrations
  initialize(): void {
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(this.dbPath);

    // Enable WAL mode for better concurrent read performance
    this.db.pragma('journal_mode = WAL');
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Run migrations
    this.runMigrations();

    this.isInitialized = true;
  }

  private runMigrations(): void {
    // Check current schema version
    const currentVersion = this.getSchemaVersion();

    if (currentVersion === 0) {
      // Run initial migration
      const migration = getInitialMigration();
      const transaction = this.db!.transaction((stmts: string[]) => {
        for (const stmt of stmts) {
          this.db!.exec(stmt);
        }
      });
      transaction(migration);

      // Update schema version
      this.setSchemaVersion(1);
    }
    // Future: add incremental migrations here
  }

  private getSchemaVersion(): number {
    try {
      const row = this.db!.prepare('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1').get() as { version: number } | undefined;
      return row?.version ?? 0;
    } catch {
      return 0; // Table doesn't exist yet
    }
  }

  private setSchemaVersion(version: number): void {
    this.db!.prepare('INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, ?)').run(version, new Date().toISOString());
  }

  // Close database connection
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }

  // Check if database is ready
  isReady(): boolean {
    return this.isInitialized && this.db !== null;
  }

  // Get the underlying database instance (for sync engine)
  getDb(): Database.Database {
    if (!this.db) throw new Error('Database not initialized');
    return this.db;
  }

  // ============ Generic CRUD Methods ============

  // Find all records with optional filters
  findAll<T = Record<string, unknown>>(tableName: string, filters?: Record<string, unknown>): T[] {
    this.ensureReady();
    const tableDef = this.getTableDef(tableName);

    let sql = `SELECT * FROM ${tableName}`;
    const params: unknown[] = [];

    if (filters && Object.keys(filters).length > 0) {
      const conditions: string[] = [];
      for (const [key, value] of Object.entries(filters)) {
        if (value === null) {
          conditions.push(`${key} IS NULL`);
        } else {
          conditions.push(`${key} = ?`);
          params.push(this.serializeValue(key, value, tableDef));
        }
      }
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    const rows = this.db!.prepare(sql).all(...params) as Record<string, unknown>[];
    return rows.map(row => this.deserializeRow(row, tableDef)) as T[];
  }

  // Find a single record by ID
  findById<T = Record<string, unknown>>(tableName: string, id: string): T | null {
    this.ensureReady();
    const tableDef = this.getTableDef(tableName);
    const row = this.db!.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    return row ? this.deserializeRow(row, tableDef) as T : null;
  }

  // Create a new record
  create<T = Record<string, unknown>>(tableName: string, data: Record<string, unknown>): T {
    this.ensureReady();
    const tableDef = this.getTableDef(tableName);

    // Add sync_status and local_updated_at
    const enrichedData = {
      ...data,
      sync_status: 'pending_push',
      local_updated_at: new Date().toISOString(),
    };

    const columns = Object.keys(enrichedData);
    const values = columns.map(col => this.serializeValue(col, enrichedData[col], tableDef));
    const placeholders = columns.map(() => '?').join(', ');

    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    this.db!.prepare(sql).run(...values);

    // Return the created record
    const id = (enrichedData as Record<string, unknown>).id as string;
    return this.findById<T>(tableName, id)!;
  }

  // Update an existing record
  update<T = Record<string, unknown>>(tableName: string, id: string, data: Record<string, unknown>): T {
    this.ensureReady();
    const tableDef = this.getTableDef(tableName);

    // Add sync_status and local_updated_at
    const enrichedData = {
      ...data,
      sync_status: 'pending_push',
      local_updated_at: new Date().toISOString(),
    };

    const columns = Object.keys(enrichedData);
    const setClauses = columns.map(col => `${col} = ?`);
    const values = columns.map(col => this.serializeValue(col, enrichedData[col], tableDef));

    const sql = `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = ?`;
    this.db!.prepare(sql).run(...values, id);

    return this.findById<T>(tableName, id)!;
  }

  // Delete a record (hard delete)
  delete(tableName: string, id: string): boolean {
    this.ensureReady();
    const result = this.db!.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  // Soft delete (set deleted_at)
  softDelete(tableName: string, id: string): boolean {
    this.ensureReady();
    const now = new Date().toISOString();
    const result = this.db!.prepare(
      `UPDATE ${tableName} SET deleted_at = ?, sync_status = 'pending_push', local_updated_at = ? WHERE id = ?`
    ).run(now, now, id);
    return result.changes > 0;
  }

  // ============ Batch Operations ============

  // Batch create records in a transaction
  batchCreate<T = Record<string, unknown>>(tableName: string, items: Record<string, unknown>[]): T[] {
    this.ensureReady();
    const tableDef = this.getTableDef(tableName);

    const transaction = this.db!.transaction(() => {
      const results: T[] = [];
      for (const data of items) {
        const enrichedData = {
          ...data,
          sync_status: 'synced', // Batch create from sync uses 'synced'
          local_updated_at: new Date().toISOString(),
        };

        const columns = Object.keys(enrichedData);
        const values = columns.map(col => this.serializeValue(col, enrichedData[col], tableDef));
        const placeholders = columns.map(() => '?').join(', ');

        const sql = `INSERT OR REPLACE INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
        this.db!.prepare(sql).run(...values);

        results.push(this.deserializeRow(enrichedData, tableDef) as T);
      }
      return results;
    });

    return transaction();
  }

  // Upsert: insert or update based on id
  upsert<T = Record<string, unknown>>(tableName: string, data: Record<string, unknown>): T {
    this.ensureReady();
    const tableDef = this.getTableDef(tableName);

    const enrichedData = {
      ...data,
      local_updated_at: new Date().toISOString(),
    };

    const columns = Object.keys(enrichedData);
    const values = columns.map(col => this.serializeValue(col, enrichedData[col], tableDef));
    const placeholders = columns.map(() => '?').join(', ');
    const updateClauses = columns.filter(c => c !== 'id').map(c => `${c} = excluded.${c}`).join(', ');

    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updateClauses}`;
    this.db!.prepare(sql).run(...values);

    return this.findById<T>(tableName, (enrichedData as Record<string, unknown>).id as string)!;
  }

  // ============ Sync-specific Methods ============

  // Get pending push records for a table
  getPendingPush(tableName: string): Record<string, unknown>[] {
    this.ensureReady();
    return this.db!.prepare(`SELECT * FROM ${tableName} WHERE sync_status = 'pending_push'`).all() as Record<string, unknown>[];
  }

  // Mark records as synced after successful push
  markAsSynced(tableName: string, ids: string[]): void {
    this.ensureReady();
    if (ids.length === 0) return;

    const placeholders = ids.map(() => '?').join(', ');
    this.db!.prepare(`UPDATE ${tableName} SET sync_status = 'synced' WHERE id IN (${placeholders})`).run(...ids);
  }

  // Get sync metadata for a table
  getSyncMetadata(tableName: string): { last_sync_at: string; sync_direction: string; record_count: number } | null {
    this.ensureReady();
    return this.db!.prepare('SELECT * FROM sync_metadata WHERE table_name = ?').get(tableName) as { last_sync_at: string; sync_direction: string; record_count: number } | null ?? null;
  }

  // Update sync metadata
  updateSyncMetadata(tableName: string, lastSyncAt: string, direction: string, recordCount: number): void {
    this.ensureReady();
    this.db!.prepare(
      `INSERT OR REPLACE INTO sync_metadata (table_name, last_sync_at, sync_direction, record_count) VALUES (?, ?, ?, ?)`
    ).run(tableName, lastSyncAt, direction, recordCount);
  }

  // Get sync conflicts
  getSyncConflicts(tableName?: string): Array<{ id: string; table_name: string; record_id: string; local_data: string; remote_data: string; resolved: number; created_at: string }> {
    this.ensureReady();
    if (tableName) {
      return this.db!.prepare('SELECT * FROM sync_conflicts WHERE table_name = ? AND resolved = 0').all(tableName) as Array<{ id: string; table_name: string; record_id: string; local_data: string; remote_data: string; resolved: number; created_at: string }>;
    }
    return this.db!.prepare('SELECT * FROM sync_conflicts WHERE resolved = 0').all() as Array<{ id: string; table_name: string; record_id: string; local_data: string; remote_data: string; resolved: number; created_at: string }>;
  }

  // Add a sync conflict
  addSyncConflict(tableName: string, recordId: string, localData: unknown, remoteData: unknown): void {
    this.ensureReady();
    const id = crypto.randomUUID();
    this.db!.prepare(
      `INSERT INTO sync_conflicts (id, table_name, record_id, local_data, remote_data, resolved, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)`
    ).run(id, tableName, recordId, JSON.stringify(localData), JSON.stringify(remoteData), new Date().toISOString());
  }

  // Resolve a conflict
  resolveConflict(conflictId: string): void {
    this.ensureReady();
    this.db!.prepare('UPDATE sync_conflicts SET resolved = 1, resolved_at = ? WHERE id = ?').run(new Date().toISOString(), conflictId);
  }

  // Count pending push records across all tables
  countPendingPush(): Record<string, number> {
    this.ensureReady();
    const result: Record<string, number> = {};
    for (const tableName of Object.keys(TABLES)) {
      if (!TABLES[tableName].syncEnabled) continue;
      try {
        const row = this.db!.prepare(`SELECT COUNT(*) as count FROM ${tableName} WHERE sync_status = 'pending_push'`).get() as { count: number };
        result[tableName] = row.count;
      } catch {
        result[tableName] = 0;
      }
    }
    return result;
  }

  // ============ Serialization Helpers ============

  private serializeValue(columnName: string, value: unknown, tableDef: TableDef): unknown {
    if (value === null || value === undefined) return null;

    const colDef = tableDef.columns.find(c => c.name === columnName);
    if (!colDef) return value;

    // JSONB / vector -> JSON.stringify
    if (colDef.isJsonb || colDef.isVector) {
      return JSON.stringify(value);
    }

    // Boolean -> 0/1
    if (colDef.pgType === 'BOOLEAN' && typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    // Object/Array that's not JSONB (shouldn't happen, but safety)
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return value;
  }

  private deserializeRow(row: Record<string, unknown>, tableDef: TableDef): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const colDef = tableDef.columns.find(c => c.name === key);
      if (!colDef) {
        result[key] = value;
        continue;
      }

      // JSONB / vector -> JSON.parse
      if ((colDef.isJsonb || colDef.isVector) && typeof value === 'string') {
        try {
          result[key] = JSON.parse(value);
        } catch {
          result[key] = value;
        }
        continue;
      }

      // INTEGER -> Boolean
      if (colDef.pgType === 'BOOLEAN' && typeof value === 'number') {
        result[key] = value === 1;
        continue;
      }

      result[key] = value;
    }
    return result;
  }

  private getTableDef(tableName: string): TableDef {
    const def = TABLES[tableName];
    if (!def) throw new Error(`Unknown table: ${tableName}`);
    return def;
  }

  private ensureReady(): void {
    if (!this.isInitialized || !this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
  }
}
