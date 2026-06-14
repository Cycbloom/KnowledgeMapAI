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
      const operations: Array<{ table: string; action: string; id: string; data?: Record<string, unknown>; clientUpdatedAt: string }> = [];

      // Collect all pending push records
      for (const [tableName, tableDef] of Object.entries(TABLES)) {
        if (!tableDef.syncEnabled) continue;

        const pendingRecords = this.dbManager.getPendingPush(tableName);
        for (const record of pendingRecords) {
          const data = { ...record } as Record<string, unknown>;
          // Remove sync tracking columns before pushing
          delete data.sync_status;
          delete data.local_updated_at;

          // Determine action based on whether this is a soft delete
          let action = 'update';
          if (tableDef.hasDeletedAt && data.deleted_at) {
            action = 'delete';
          } else if (data.created_at === data.updated_at || !data.updated_at) {
            // Heuristic: if created_at equals updated_at, it's likely a create
            // This is imperfect; a better approach would track the original action
            action = 'update'; // Default to update for safety
          }

          operations.push({
            table: tableName,
            action,
            id: data.id as string,
            data,
            clientUpdatedAt: (data.local_updated_at as string) || (data.updated_at as string) || new Date().toISOString(),
          });
        }
      }

      if (operations.length === 0) return;

      // Push in batches
      const port = this.apiPort;
      if (!port) return;

      for (let i = 0; i < operations.length; i += this.config.batchSize) {
        const batch = operations.slice(i, i + this.config.batchSize);

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

        const result = (await response.json()) as { results: Array<{ id: string; success: boolean; conflict?: boolean; serverData?: unknown; error?: string }> };
        const results = result.results;

        // Process results
        const syncedIds: string[] = [];
        for (const pushResult of results) {
          if (pushResult.success) {
            syncedIds.push(pushResult.id);
          } else if (pushResult.conflict) {
            // Find the table for this record
            const op = batch.find(o => o.id === pushResult.id);
            if (op) {
              // Get local data for conflict record
              const localRecord = this.dbManager.findById(op.table, op.id);
              this.dbManager.addSyncConflict(op.table, op.id, localRecord, pushResult.serverData);
              // Cloud wins: update local with server data
              if (pushResult.serverData) {
                this.dbManager.upsert(op.table, {
                  ...(pushResult.serverData as Record<string, unknown>),
                  sync_status: 'synced',
                });
              }
              syncedIds.push(pushResult.id);
            }
          }
        }

        // Mark synced records
        for (const id of syncedIds) {
          // We need to find which table this ID belongs to
          // For simplicity, try to mark in all tables that had this operation
          for (const op of batch) {
            if (op.id === id) {
              try {
                this.dbManager.markAsSynced(op.table, [id]);
              } catch {
                // Ignore if table doesn't exist
              }
              break;
            }
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
}
