import { BrowserWindow, ipcMain } from 'electron';
import { DatabaseManager } from '../db/database';
import { TABLES } from '../db/schema';
import type { SyncStatus } from '../../shared/types/ipc';

interface SyncConfig {
  syncInterval: number; // ms, default 30000
  maxRetries: number; // default 3
  batchSize: number; // default 50
}

const DEFAULT_CONFIG: SyncConfig = {
  syncInterval: 30000,
  maxRetries: 3,
  batchSize: 50,
};

export class SyncEngine {
  private dbManager: DatabaseManager;
  private mainWindow: BrowserWindow | null;
  private config: SyncConfig;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private isOnline = true;
  private isSyncing = false;
  private lastSyncAt: Record<string, string> = {};
  private syncError: string | null = null;
  private apiPort: number | null = null;
  private authToken: string | null = null;

  constructor(dbManager: DatabaseManager, mainWindow: BrowserWindow | null, config: Partial<SyncConfig> = {}) {
    this.dbManager = dbManager;
    this.mainWindow = mainWindow;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Start the sync engine
  start(): void {
    if (this.isRunning) return;

    console.log('[SyncEngine] 启动同步引擎，间隔:', this.config.syncInterval, 'ms');
    this.isRunning = true;

    // Load last sync timestamps from database
    this.loadSyncMetadata();

    // Start periodic sync
    this.syncTimer = setInterval(() => {
      this.sync();
    }, this.config.syncInterval);

    // Do an initial sync
    this.sync();
  }

  // Stop the sync engine
  stop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.isRunning = false;
    console.log('[SyncEngine] 同步引擎已停止');
  }

  // Set online status (called when network status changes)
  setOnlineStatus(online: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = online;

    if (online && wasOffline) {
      console.log('[SyncEngine] 网络恢复，触发同步');
      this.sync();
    }

    this.notifyStatusChanged();
  }

  // Set the API port for communicating with the local API server
  setApiPort(port: number): void {
    this.apiPort = port;
  }

  // Set the auth token for API requests
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  // Update the main window reference
  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
  }

  // Get current sync status
  getStatus(): SyncStatus {
    const pendingCounts = this.dbManager.countPendingPush();
    const totalPending = Object.values(pendingCounts).reduce((sum, count) => sum + count, 0);

    const conflicts = this.dbManager.getSyncConflicts();

    return {
      isRunning: this.isRunning,
      isOnline: this.isOnline,
      lastSyncAt: this.getLastSyncAt(),
      pendingPush: totalPending,
      pendingPull: 0, // We don't track pending pull count
      conflicts: conflicts.length,
      error: this.syncError ?? undefined,
    };
  }

  // Perform a full sync cycle (pull then push)
  async sync(): Promise<void> {
    if (!this.isOnline || this.isSyncing) return;

    this.isSyncing = true;
    this.syncError = null;
    this.notifyStatusChanged();

    try {
      // Phase 1: Pull from cloud
      await this.pullFromCloud();

      // Phase 2: Push to cloud
      await this.pushToCloud();

      // Clean up old synced operations
      this.cleanupOldOperations();

      this.notifyStatusChanged();
    } catch (error) {
      this.syncError = (error as Error).message;
      console.error('[SyncEngine] 同步失败:', error);
      this.notifyStatusChanged();
    } finally {
      this.isSyncing = false;
    }
  }

  // Pull changes from cloud
  private async pullFromCloud(): Promise<void> {
    try {
      // Build the tables parameter with last sync timestamps
      const tables: Record<string, string> = {};
      for (const [tableName, tableDef] of Object.entries(TABLES)) {
        if (!tableDef.syncEnabled) continue;
        tables[tableName] = this.lastSyncAt[tableName] || new Date(0).toISOString();
      }

      // Call the sync/pull API
      const port = this.apiPort;
      if (!port) return;

      const response = await fetch(`http://localhost:${port}/api/sync/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authToken ?? ''}`,
        },
        body: JSON.stringify({ tables }),
      });

      if (!response.ok) {
        throw new Error(`Pull failed: ${response.status} ${response.statusText}`);
      }

      const result = (await response.json()) as { data: Record<string, { records: unknown[]; timestamp: string }> };
      const data = result.data;

      // Merge pulled data into local SQLite
      for (const [tableName, tableData] of Object.entries(data)) {
        if (!tableData.records || tableData.records.length === 0) continue;

        // Batch upsert records
        for (const record of tableData.records) {
          const enrichedRecord = {
            ...(record as Record<string, unknown>),
            sync_status: 'synced',
          };
          this.dbManager.upsert(tableName, enrichedRecord);
        }

        // Update last sync timestamp for this table
        this.lastSyncAt[tableName] = tableData.timestamp;
        this.dbManager.updateSyncMetadata(tableName, tableData.timestamp, 'pull', tableData.records.length);
      }

      console.log('[SyncEngine] Pull 完成');
    } catch (error) {
      console.error('[SyncEngine] Pull 失败:', error);
      throw error;
    }
  }

  // Push local changes to cloud
  private async pushToCloud(): Promise<void> {
    try {
      // Get pending operations from sync_operations table
      const pendingOps = this.dbManager.getPendingOperations();

      if (pendingOps.length === 0) return;

      // Merge operations for the same record: combine partial updates into complete data
      const mergedOpsMap = new Map<string, typeof pendingOps[0]>();
      for (const op of pendingOps) {
        const key = `${op.table_name}:${op.record_id}`;
        const existing = mergedOpsMap.get(key);

        if (!existing) {
          mergedOpsMap.set(key, op);
          continue;
        }

        // Merge based on operation sequence
        if (existing.action === 'create' && op.action === 'update') {
          // Merge update fields into create data to preserve complete record
          mergedOpsMap.set(key, {
            ...existing,
            data: { ...(existing.data ?? {}), ...(op.data ?? {}) },
            created_at: op.created_at,
          });
        } else if (existing.action === 'update' && op.action === 'update') {
          // Merge consecutive updates: later fields override earlier ones
          mergedOpsMap.set(key, {
            ...existing,
            data: { ...(existing.data ?? {}), ...(op.data ?? {}) },
            created_at: op.created_at,
          });
        } else if (op.action === 'delete') {
          // Delete overrides everything; if preceded by create, server never saw it so skip entirely
          if (existing.action === 'create') {
            mergedOpsMap.delete(key);
          } else {
            mergedOpsMap.set(key, op);
          }
        } else {
          // Default: keep the latest operation (e.g., create -> create shouldn't happen but handle gracefully)
          mergedOpsMap.set(key, op);
        }
      }
      const mergedOps = Array.from(mergedOpsMap.values());

      // Build operations array for the push API
      const operations: Array<{
        table: string;
        action: 'create' | 'update' | 'delete';
        id: string;
        data?: Record<string, unknown>;
        clientUpdatedAt: string;
      }> = mergedOps.map(op => ({
        table: op.table_name,
        action: op.action as 'create' | 'update' | 'delete',
        id: op.record_id,
        data: op.data ?? undefined,
        clientUpdatedAt: op.created_at,
      }));

      // Push in batches
      const port = this.apiPort;
      if (!port) return;

      for (let i = 0; i < operations.length; i += this.config.batchSize) {
        const batch = operations.slice(i, i + this.config.batchSize);
        const batchOpIds = batch.map(op => {
          const key = `${op.table}:${op.id}`;
          return mergedOpsMap.get(key)!.id;
        });

        const response = await fetch(`http://localhost:${port}/api/sync/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken ?? ''}`,
          },
          body: JSON.stringify({ operations: batch }),
        });

        if (!response.ok) {
          throw new Error(`Push failed: ${response.status} ${response.statusText}`);
        }

        const result = (await response.json()) as {
          results: Array<{
            id: string;
            success: boolean;
            conflict?: boolean;
            serverData?: unknown;
            error?: string;
          }>;
        };
        const results = result.results;

        // Process results
        const syncedOpIds: string[] = [];
        const syncedRecordIds: Array<{ table: string; id: string }> = [];

        for (const pushResult of results) {
          const op = batch.find(o => o.id === pushResult.id);
          if (!op) continue;

          if (pushResult.success) {
            syncedOpIds.push(batchOpIds[batch.indexOf(op)]!);
            syncedRecordIds.push({ table: op.table, id: op.id });
          } else if (pushResult.conflict) {
            // Conflict: cloud wins, update local with server data
            const localRecord = this.dbManager.findById(op.table, op.id);
            this.dbManager.addSyncConflict(op.table, op.id, localRecord, pushResult.serverData);
            if (pushResult.serverData) {
              this.dbManager.upsert(op.table, {
                ...(pushResult.serverData as Record<string, unknown>),
                sync_status: 'synced',
              });
            }
            // Mark operation as synced since we've resolved it (cloud wins)
            syncedOpIds.push(batchOpIds[batch.indexOf(op)]!);
            syncedRecordIds.push({ table: op.table, id: op.id });
          }
        }

        // Mark operations as synced
        this.dbManager.markOperationsSynced(syncedOpIds);

        // Mark records as synced
        for (const { table, id } of syncedRecordIds) {
          try {
            this.dbManager.markAsSynced(table, [id]);
          } catch {
            // Record may have been hard-deleted, ignore
          }
        }
      }

      console.log('[SyncEngine] Push 完成');
    } catch (error) {
      console.error('[SyncEngine] Push 失败:', error);
      throw error;
    }
  }

  // Full sync for first-time setup (pull all data)
  async fullSync(): Promise<void> {
    console.log('[SyncEngine] 开始全量同步...');

    // Reset all sync timestamps to epoch
    for (const tableName of Object.keys(TABLES)) {
      this.lastSyncAt[tableName] = new Date(0).toISOString();
    }

    await this.pullFromCloud();
    console.log('[SyncEngine] 全量同步完成');
  }

  // Register IPC handlers for sync control
  registerIpcHandlers(): void {
    ipcMain.handle('sync:getStatus', async () => {
      return { success: true, data: this.getStatus() };
    });

    ipcMain.handle('sync:trigger', async () => {
      try {
        await this.sync();
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    ipcMain.handle('sync:pause', async () => {
      this.stop();
      return { success: true };
    });

    ipcMain.handle('sync:resume', async () => {
      this.start();
      return { success: true };
    });

    ipcMain.handle('sync:setAuthToken', async (_event, token: string) => {
      this.setAuthToken(token);
      return { success: true };
    });

    ipcMain.handle('sync:fullSync', async () => {
      try {
        await this.fullSync();
        return { success: true };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });
  }

  // ============ Private Helpers ============

  private loadSyncMetadata(): void {
    for (const tableName of Object.keys(TABLES)) {
      const metadata = this.dbManager.getSyncMetadata(tableName);
      if (metadata) {
        this.lastSyncAt[tableName] = metadata.last_sync_at;
      }
    }
  }

  private getLastSyncAt(): string | null {
    const timestamps = Object.values(this.lastSyncAt).filter(Boolean);
    if (timestamps.length === 0) return null;
    return timestamps.sort()[timestamps.length - 1]; // Most recent
  }

  private notifyStatusChanged(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('sync:statusChanged', this.getStatus());
    }
  }

  // Clean up old synced operations to prevent unbounded growth
  private cleanupOldOperations(): void {
    try {
      const deletedCount = this.dbManager.cleanupSyncedOperations(7); // Clean up operations older than 7 days
      if (deletedCount > 0) {
        console.log(`[SyncEngine] 清理了 ${deletedCount} 条旧操作日志`);
      }
    } catch (error) {
      console.error('[SyncEngine] 清理操作日志失败:', error);
    }
  }
}
