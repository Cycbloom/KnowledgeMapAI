import Database from 'better-sqlite3';
import { SyncOperation, SyncBatch } from './syncTypes.js';

export class SyncStateManager {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_state (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_name TEXT UNIQUE NOT NULL,
        last_sync_timestamp TEXT NOT NULL,
        last_sync_batch_id TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sync_operations (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        record TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        user_id TEXT NOT NULL,
        synced INTEGER DEFAULT 0,
        device_id TEXT NOT NULL,
        batch_id TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sync_operations_synced ON sync_operations(synced);
      CREATE INDEX IF NOT EXISTS idx_sync_operations_table ON sync_operations(table_name);
      CREATE INDEX IF NOT EXISTS idx_sync_operations_timestamp ON sync_operations(timestamp);
    `);
  }

  async getLastSyncTime(tableName: string): Promise<string> {
    const result = this.db.prepare(
      'SELECT last_sync_timestamp FROM sync_state WHERE table_name = ?'
    ).get(tableName) as { last_sync_timestamp: string } | undefined;
    return result?.last_sync_timestamp || '1970-01-01T00:00:00Z';
  }

  async updateSyncTime(tableName: string, timestamp: string, batchId?: string): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO sync_state (table_name, last_sync_timestamp, last_sync_batch_id, updated_at)
      VALUES (?, ?, ?, datetime('now'))
    `).run(tableName, timestamp, batchId);
  }

  async addOperation(operation: SyncOperation, deviceId: string): Promise<void> {
    this.db.prepare(`
      INSERT INTO sync_operations (id, type, table_name, record_id, record, timestamp, user_id, device_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      operation.id,
      operation.type,
      operation.table,
      operation.recordId,
      JSON.stringify(operation.record),
      operation.timestamp,
      operation.userId,
      deviceId
    );
  }

  async getPendingOperations(): Promise<SyncOperation[]> {
    const operations = this.db.prepare(
      'SELECT * FROM sync_operations WHERE synced = 0 ORDER BY timestamp ASC'
    ).all() as Array<{
      id: string;
      type: string;
      table_name: string;
      record_id: string;
      record: string;
      timestamp: string;
      user_id: string;
    }>;

    return operations.map(op => ({
      id: op.id,
      type: op.type as 'create' | 'update' | 'delete',
      table: op.table_name,
      record: JSON.parse(op.record),
      recordId: op.record_id,
      timestamp: op.timestamp,
      userId: op.user_id
    }));
  }

  async markOperationsAsSynced(operationIds: string[]): Promise<void> {
    if (operationIds.length === 0) return;

    const placeholders = operationIds.map(() => '?').join(',');
    this.db.prepare(
      `UPDATE sync_operations SET synced = 1 WHERE id IN (${placeholders})`
    ).run(...operationIds);
  }

  async getOperationsSince(timestamp: string): Promise<SyncOperation[]> {
    const operations = this.db.prepare(
      'SELECT * FROM sync_operations WHERE timestamp > ? ORDER BY timestamp ASC'
    ).all(timestamp) as Array<{
      id: string;
      type: string;
      table_name: string;
      record_id: string;
      record: string;
      timestamp: string;
      user_id: string;
    }>;

    return operations.map(op => ({
      id: op.id,
      type: op.type as 'create' | 'update' | 'delete',
      table: op.table_name,
      record: JSON.parse(op.record),
      recordId: op.record_id,
      timestamp: op.timestamp,
      userId: op.user_id
    }));
  }

  async createSyncBatch(operations: SyncOperation[], deviceId: string, userId: string): Promise<SyncBatch> {
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Update operations with batch ID
    for (const operation of operations) {
      this.db.prepare(
        'UPDATE sync_operations SET batch_id = ? WHERE id = ?'
      ).run(batchId, operation.id);
    }

    return {
      batchId,
      timestamp: new Date().toISOString(),
      operations,
      deviceId,
      userId
    };
  }

  async applySyncBatch(batch: SyncBatch): Promise<void> {
    const tx = this.db.transaction(() => {
      for (const operation of batch.operations) {
        this.applyOperation(operation);
      }
    });

    tx();
  }

  private applyOperation(operation: SyncOperation): void {
    switch (operation.type) {
      case 'create':
        this.insertRecord(operation.table, operation.record);
        break;
      case 'update':
        this.updateRecord(operation.table, operation.recordId, operation.record);
        break;
      case 'delete':
        this.deleteRecord(operation.table, operation.recordId);
        break;
    }
  }

  private insertRecord(table: string, record: Record<string, any>): void {
    const keys = Object.keys(record);
    const values = Object.values(record);
    const placeholders = values.map(() => '?').join(',');

    const sql = `
      INSERT OR IGNORE INTO ${table} (${keys.join(', ')})
      VALUES (${placeholders})
    `;

    try {
      this.db.prepare(sql).run(...values);
    } catch (error) {
      console.error(`Failed to insert record into ${table}:`, error);
    }
  }

  private updateRecord(table: string, recordId: string, record: Record<string, any>): void {
    const updates = Object.entries(record)
      .filter(([key]) => key !== 'id')
      .map(([key]) => `${key} = ?`)
      .join(', ');

    const values = Object.values(record).filter((_, index) => index > 0);

    const sql = `
      UPDATE ${table} SET ${updates}
      WHERE id = ?
    `;

    try {
      this.db.prepare(sql).run(...values, recordId);
    } catch (error) {
      console.error(`Failed to update record in ${table}:`, error);
    }
  }

  private deleteRecord(table: string, recordId: string): void {
    const sql = `DELETE FROM ${table} WHERE id = ?`;
    try {
      this.db.prepare(sql).run(recordId);
    } catch (error) {
      console.error(`Failed to delete record from ${table}:`, error);
    }
  }

  async cleanupOldOperations(days: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    this.db.prepare(
      'DELETE FROM sync_operations WHERE timestamp < ? AND synced = 1'
    ).run(cutoffDate.toISOString());
  }

  async getSyncStats(): Promise<{
    pendingOperations: number;
    syncedOperations: number;
    totalOperations: number;
  }> {
    const pending = this.db.prepare('SELECT COUNT(*) as count FROM sync_operations WHERE synced = 0').get() as { count: number };
    const synced = this.db.prepare('SELECT COUNT(*) as count FROM sync_operations WHERE synced = 1').get() as { count: number };
    const total = this.db.prepare('SELECT COUNT(*) as count FROM sync_operations').get() as { count: number };

    return {
      pendingOperations: pending.count,
      syncedOperations: synced.count,
      totalOperations: total.count
    };
  }
}
