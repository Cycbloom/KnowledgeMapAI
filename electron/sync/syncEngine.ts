import { BrowserWindow } from 'electron';
import { DatabaseManager } from '../db/database';
import { TABLES } from '../db/schema';
import type { SyncStatus } from '../../shared/types/ipc';
import { mergeOperations as sharedMergeOperations } from '../../shared/sync/operationMerger';
import { withRetry } from '../../shared/utils/retry';
import { logger } from '../utils/logger';

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

    logger.warn(`[SyncEngine] 启动同步引擎，间隔: ${this.config.syncInterval}ms`);
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
    logger.warn('[SyncEngine] 同步引擎已停止');
  }

  // Set online status (called when network status changes)
  setOnlineStatus(online: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = online;

    if (online && wasOffline) {
      logger.warn('[SyncEngine] 网络恢复，触发同步');
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
      logger.error('[SyncEngine] 同步失败', error);
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

      const response = await withRetry(async () => {
        const resp = await fetch(`http://localhost:${port}/api/sync/pull`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.authToken ?? ''}`,
          },
          body: JSON.stringify({ tables }),
        });

        if (!resp.ok) {
          // Attach status so isRetryableError can distinguish 4xx (no retry) from 5xx (retry)
          const err = new Error(`Pull failed: ${resp.status} ${resp.statusText}`) as Error & { status?: number };
          err.status = resp.status;
          throw err;
        }

        return resp;
      }, {
        maxRetries: this.config.maxRetries,
        initialDelay: 1000,
        maxDelay: 10000,
        shouldRetry: (err) => this.isRetryableError(err),
        onRetry: (attempt, err) => {
          logger.warn(`[SyncEngine] 重试 ${attempt}/${this.config.maxRetries}：${err.message}`);
        },
      });

      const result = (await response.json()) as { data: Record<string, { records: unknown[]; timestamp: string }> };
      const data = result.data;

      // Merge pulled data into local SQLite
      for (const [tableName, tableData] of Object.entries(data)) {
        if (!tableData.records || tableData.records.length === 0) continue;

        // Batch upsert records
        for (const record of tableData.records) {
          const recordId = (record as Record<string, unknown>).id as string | undefined;
          // Protect local unpushed changes: if local record is pending_push, record conflict and skip upsert
          if (recordId) {
            const localRecord = this.dbManager.findById<Record<string, unknown>>(tableName, recordId);
            if (localRecord?.sync_status === 'pending_push') {
              this.dbManager.addSyncConflict(tableName, recordId, localRecord, record);
              logger.warn(`[SyncEngine] Pull 跳过 pending_push 记录，记录冲突: ${tableName}/${recordId}`);
              continue;
            }
          }
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

      logger.warn('[SyncEngine] Pull 完成');
    } catch (error) {
      logger.error('[SyncEngine] Pull 失败', error);
      throw error;
    }
  }

  // Push local changes to cloud
  private async pushToCloud(): Promise<void> {
    try {
      // Get pending operations from sync_operations table
      const pendingOps = this.dbManager.getPendingOperations();

      if (pendingOps.length === 0) return;

      // Convert pending operations to shared SyncOperation format
      const sharedOps = pendingOps.map(op => ({
        id: op.id,
        action: op.action as "create" | "update" | "delete",
        table: op.table_name,
        recordId: op.record_id,
        data: (op.data ?? {}) as Record<string, unknown>,
        timestamp: op.created_at,
        userId: '', // Electron 端不需要 userId
      }));

      // Use shared merge logic
      const mergedSharedOps = sharedMergeOperations(sharedOps);

      // 预构建 mergedSharedOps 的 table+recordId 索引，替代每个批次内 find 的 O(batch*totalOps) 扫描
      const mergedOpIndex = new Map<string, (typeof mergedSharedOps)[number]>();
      for (const m of mergedSharedOps) {
        const key = `${m.table}:${m.recordId}`;
        if (!mergedOpIndex.has(key)) {
          mergedOpIndex.set(key, m);
        }
      }

      // Convert back to push format
      const operations: Array<{
        table: string;
        action: 'create' | 'update' | 'delete';
        id: string;
        data?: Record<string, unknown>;
        clientUpdatedAt: string;
      }> = mergedSharedOps.map(op => ({
        table: op.table,
        action: op.action,
        id: op.recordId,
        data: Object.keys(op.data).length > 0 ? op.data : undefined,
        clientUpdatedAt: op.timestamp,
      }));

      // Push in batches
      const port = this.apiPort;
      if (!port) return;

      for (let i = 0; i < operations.length; i += this.config.batchSize) {
        const batch = operations.slice(i, i + this.config.batchSize);
        // 预构建批次 id 索引，替代 results 循环内 batch.find/batch.indexOf 的 O(batch²) 扫描
        const opById = new Map<string, (typeof batch)[number]>();
        const opIndexById = new Map<string, number>();
        batch.forEach((op, idx) => {
          opById.set(op.id, op);
          opIndexById.set(op.id, idx);
        });
        const batchOpIds = batch.map(op => {
          const mergedOp = mergedOpIndex.get(`${op.table}:${op.id}`);
          return mergedOp?.id ?? op.id;
        });

        const response = await withRetry(async () => {
          const resp = await fetch(`http://localhost:${port}/api/sync/push`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.authToken ?? ''}`,
            },
            body: JSON.stringify({ operations: batch }),
          });

          if (!resp.ok) {
            // Attach status so isRetryableError can distinguish 4xx (no retry) from 5xx (retry)
            const err = new Error(`Push failed: ${resp.status} ${resp.statusText}`) as Error & { status?: number };
            err.status = resp.status;
            throw err;
          }

          return resp;
        }, {
          maxRetries: this.config.maxRetries,
          initialDelay: 1000,
          maxDelay: 10000,
          shouldRetry: (err) => this.isRetryableError(err),
          onRetry: (attempt, err) => {
            logger.warn(`[SyncEngine] 重试 ${attempt}/${this.config.maxRetries}：${err.message}`);
          },
        });

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
          const op = opById.get(pushResult.id);
          if (!op) continue;

          if (pushResult.success) {
            syncedOpIds.push(batchOpIds[opIndexById.get(op.id) ?? -1] ?? op.id);
            syncedRecordIds.push({ table: op.table, id: op.id });
          } else if (pushResult.conflict) {
            // Conflict: cloud wins, update local with server data
            const localRecord = this.dbManager.findById(op.table, op.id);
            this.dbManager.addSyncConflict(op.table, op.id, localRecord, pushResult.serverData);
            logger.warn(`[SyncEngine] Push 冲突: ${op.table}/${op.id}（Cloud Wins 策略，用云端数据覆盖本地）`);
            // Notify renderer via IPC so the UI can surface the conflict
            this.notifyConflict(op.table, op.id, localRecord, pushResult.serverData);
            if (pushResult.serverData) {
              this.dbManager.upsert(op.table, {
                ...(pushResult.serverData as Record<string, unknown>),
                sync_status: 'synced',
              });
            }
            // Mark operation as synced since we've resolved it (cloud wins)
            syncedOpIds.push(batchOpIds[opIndexById.get(op.id) ?? -1] ?? op.id);
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

      logger.warn('[SyncEngine] Push 完成');
    } catch (error) {
      logger.error('[SyncEngine] Push 失败', error);
      throw error;
    }
  }

  // Full sync for first-time setup (pull all data)
  async fullSync(): Promise<void> {
    logger.warn('[SyncEngine] 开始全量同步...');

    // Reset all sync timestamps to epoch
    for (const tableName of Object.keys(TABLES)) {
      this.lastSyncAt[tableName] = new Date(0).toISOString();
    }

    await this.pullFromCloud();
    logger.warn('[SyncEngine] 全量同步完成');
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
        logger.warn(`[SyncEngine] 清理了 ${deletedCount} 条旧操作日志`);
      }
    } catch (error) {
      logger.error('[SyncEngine] 清理操作日志失败', error);
    }
  }

  // Determine if an error is retryable. Network/timeout/5xx are retryable; 4xx are not.
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('timeout') || msg.includes('network') || msg.includes('econnreset')) {
        return true;
      }
      const fetchError = error as Error & { status?: number };
      if (fetchError.status && fetchError.status >= 500) {
        return true;
      }
      if (fetchError.status && fetchError.status >= 400 && fetchError.status < 500) {
        return false;
      }
    }
    return true; // Default: retry unknown errors
  }

  // Notify the renderer of a sync conflict via IPC (used by Push conflict handling)
  private notifyConflict(table: string, id: string, local: unknown, remote: unknown): void {
    const payload = { table, id, local, remote };
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('sync:conflict', payload);
      return;
    }
    const fallbackWindow = BrowserWindow.getAllWindows()[0];
    if (fallbackWindow && !fallbackWindow.isDestroyed()) {
      fallbackWindow.webContents.send('sync:conflict', payload);
    }
  }
}
