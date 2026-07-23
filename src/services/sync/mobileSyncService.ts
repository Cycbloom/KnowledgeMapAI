import { deviceDiscoveryService } from "./deviceDiscoveryService";
import { syncAuthService, PairedDevice } from "./syncAuthService";
import {
  getOfflineQueue,
  addToOfflineQueue,
  clearOfflineQueue,
} from "../../utils/offlineStorage";
import {
  autoResolveConflicts,
  type SyncOperation,
  type SyncBatch,
  type SyncDevice,
  type SyncConflict,
  type SyncStatus,
} from "../../../shared/sync";
import { getSupabaseClient } from "../../lib/supabase";
import { withRetry } from "../../../shared/utils/retry";
import { AppError, SharedErrorCodes } from "@/utils/errors";
import { logger } from "@/utils/logger";

export class MobileSyncService {
  private isRunning = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private pendingOperations: SyncOperation[] = [];
  private conflicts: SyncConflict[] = [];
  private lastSync?: string;
  private lastSyncStatus?: "success" | "error";
  private deviceId: string;
  private deviceName: string;
  private userId: string = "unknown";
  private retryAttempts: Map<string, { count: number; lastFailure: number }> = new Map();
  private onlineStatus: boolean = true;

  constructor() {
    this.deviceId = `mobile-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    this.deviceName = `Mobile-${Math.random().toString(36).substring(2, 11)}`;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    // 获取当前用户 ID
    await this.refreshUserId();

    this.isRunning = true;
    await deviceDiscoveryService.start(this.deviceId, this.deviceName);
    this.startAutoSync();
  }

  async stop(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    await deviceDiscoveryService.stop();
    this.isRunning = false;
  }

  /**
   * 设置网络在线状态。
   * - 从离线恢复到在线时：若服务未启动则 start()，并立即触发一次 sync()
   * - 从在线变为离线时：仅记录状态（不停止定时器，保留以备恢复）
   */
  setOnlineStatus(isOnline: boolean): void {
    const wasOffline = !this.onlineStatus;
    this.onlineStatus = isOnline;

    if (isOnline && wasOffline) {
      // 网络恢复，立即触发同步
      if (!this.syncInterval) {
        void this.start();
      }
      // 异步触发 sync，不阻塞
      void this.sync().catch((error) => {
        console.warn("Failed to sync after network recovery:", error);
      });
    }
  }

  private startAutoSync(): void {
    this.syncInterval = setInterval(
      async () => {
        await this.sync();
      },
      15 * 60 * 1000,
    ); // 15 minutes
  }

  /** 刷新当前用户 ID */
  private async refreshUserId(): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession();
        this.userId = session?.user?.id ?? "unknown";
      }
    } catch (error) {
      logger.warn("Operation failed", {
        operation: "refreshUserId",
        error: error instanceof Error ? error.message : String(error),
      });
      this.userId = "unknown";
    }
  }

  async sync(): Promise<boolean> {
    if (!this.isRunning) {
      return false;
    }

    try {
      await this.processPendingOperations();
      await this.discoverDevices();
      const onlineDevices = deviceDiscoveryService.getOnlineDevices();
      for (const device of onlineDevices) {
        await this.syncWithDevice(device);
      }
      await this.processConflicts();

      this.lastSync = new Date().toISOString();
      this.lastSyncStatus = "success";
      return true;
    } catch (error) {
      console.warn("Mobile sync failed:", error);
      this.lastSync = new Date().toISOString();
      this.lastSyncStatus = "error";
      return false;
    }
  }

  private async processPendingOperations(): Promise<void> {
    const pendingOps = await getOfflineQueue();
    if (pendingOps.length === 0) {
      return;
    }

    this.pendingOperations = pendingOps.map((op) => ({
      id: op.id,
      action: op.type,
      table: op.entityType,
      data: (op.data || {}) as Record<string, unknown>,
      recordId: op.entityId,
      timestamp: new Date(op.timestamp).toISOString(),
      userId: this.userId,
      clientOpId: crypto.randomUUID(),
    }));
  }

  private async discoverDevices(): Promise<void> {
    await deviceDiscoveryService.discoverDevices();
  }

  private async syncWithDevice(device: SyncDevice): Promise<void> {
    if (!syncAuthService.isDevicePaired(device.id)) {
      return;
    }

    // 检查设备失败次数，跳过连续失败过多的设备
    const attempts = this.retryAttempts.get(device.id);
    if (attempts && attempts.count >= 5) {
      return;
    }

    const token = await syncAuthService.generateSyncToken(device.id);
    if (!token) {
      return;
    }

    try {
      await withRetry(
        async () => {
          // Send pending operations to device
          if (this.pendingOperations.length > 0) {
            const batch: SyncBatch = {
              batchId: `batch-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
              timestamp: new Date().toISOString(),
              operations: this.pendingOperations,
              deviceId: this.deviceId,
              userId: this.userId,
            };

            const response = await fetch(
              `http://${device.ipAddress}:3001/api/sync/receive`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "X-Sync-Token": token,
                  "X-Device-Id": this.deviceId,
                },
                body: JSON.stringify(batch),
              },
            );

            if (response.ok) {
              // Get remote operations
              const remoteBatch = await response.json();
              await this.applyRemoteOperations(remoteBatch.operations);

              // Clear pending operations
              await clearOfflineQueue();
              this.pendingOperations = [];
            }
          } else {
            // No pending operations, just get remote changes
            const response = await fetch(
              `http://${device.ipAddress}:3001/api/sync/send`,
              {
                method: "GET",
                headers: {
                  "X-Sync-Token": token,
                  "X-Device-Id": this.deviceId,
                },
              },
            );

            if (response.ok) {
              const remoteBatch = await response.json();
              await this.applyRemoteOperations(remoteBatch.operations);
            }
          }

          // Update last sync time
          syncAuthService.updateLastSync(device.id);
        },
        {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 10000,
          onRetry: (attempt, error) => {
            console.warn(`Retry ${attempt} for device ${device.id}:`, error);
          },
        },
      );
      // 成功后重置失败计数
      this.retryAttempts.delete(device.id);
    } catch (error) {
      // 失败后更新计数
      const current = this.retryAttempts.get(device.id) ?? { count: 0, lastFailure: Date.now() };
      current.count += 1;
      current.lastFailure = Date.now();
      this.retryAttempts.set(device.id, current);
      console.warn(`Failed to sync with device ${device.id} after retries:`, error);
    }
  }

  private async applyRemoteOperations(
    operations: SyncOperation[],
  ): Promise<void> {
    for (const operation of operations) {
      try {
        await this.applyOperation(operation);
      } catch (error) {
        console.error(`Failed to apply operation ${operation.id}:`, error);
        // Create conflict
        const conflict: SyncConflict = {
          id: `conflict-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          table: operation.table,
          recordId: operation.recordId,
          localVersion: await this.getLocalVersion(
            operation.table,
            operation.recordId,
          ),
          remoteVersion: operation,
          resolved: false,
        };
        this.conflicts.push(conflict);
      }
    }
  }

  private async applyOperation(operation: SyncOperation): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new AppError("Supabase client not initialized", SharedErrorCodes.SYSTEM_CONFIGURATION_ERROR, 500);
    }

    // 幂等性检查：若 operation 有 clientOpId，先查询是否已应用
    if (operation.clientOpId) {
      const { data: existing } = await supabase
        .from("sync_operations")
        .select("id")
        .eq("client_op_id", operation.clientOpId)
        .eq("user_id", operation.userId)
        .maybeSingle();
      if (existing) {
        // 已应用过，跳过
        return;
      }
    }

    switch (operation.action) {
      case "create": {
        const { error } = await supabase
          .from(operation.table)
          .insert(operation.data);
        if (error) throw error;
        break;
      }
      case "update": {
        const { error } = await supabase
          .from(operation.table)
          .update(operation.data)
          .eq("id", operation.recordId);
        if (error) throw error;
        break;
      }
      case "delete": {
        // 尝试软删除，如果表没有 deleted_at 列则硬删除
        const { error: softDeleteError } = await supabase
          .from(operation.table)
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", operation.recordId);
        if (softDeleteError) {
          // 软删除失败，尝试硬删除
          const { error: hardDeleteError } = await supabase
            .from(operation.table)
            .delete()
            .eq("id", operation.recordId);
          if (hardDeleteError) throw hardDeleteError;
        }
        break;
      }
    }

    // 记录已应用（若有 clientOpId）
    if (operation.clientOpId) {
      const { error: recordError } = await supabase
        .from("sync_operations")
        .insert({
          client_op_id: operation.clientOpId,
          user_id: operation.userId,
          device_id: this.deviceId,
          table_name: operation.table,
          record_id: operation.recordId,
          action: operation.action,
        });
      if (recordError) throw recordError;
    }
  }

  private async getLocalVersion(
    table: string,
    recordId: string,
  ): Promise<SyncOperation> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        action: "update",
        table,
        data: {},
        recordId,
        timestamp: new Date().toISOString(),
        userId: this.userId,
      };
    }

    const { data } = await supabase
      .from(table)
      .select("*")
      .eq("id", recordId)
      .maybeSingle();

    return {
      id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      action: "update",
      table,
      data: data ? data as Record<string, unknown> : {},
      recordId,
      timestamp: (data as Record<string, unknown>)?.updated_at as string ?? (data as Record<string, unknown>)?.created_at as string ?? new Date().toISOString(),
      userId: this.userId,
    };
  }

  private async processConflicts(): Promise<void> {
    if (this.conflicts.length === 0) {
      return;
    }

    // 使用共享冲突解决器
    const { resolved, unresolved } = autoResolveConflicts(this.conflicts);

    // 应用已解决的操作
    for (const op of resolved) {
      await this.applyOperation(op);
    }

    // 更新冲突列表：标记已解决的，保留未解决的
    const resolvedIds = new Set(resolved.map((op) => op.id));
    this.conflicts = this.conflicts.map((c) => {
      if (resolvedIds.has(c.localVersion.id) || resolvedIds.has(c.remoteVersion.id)) {
        return { ...c, resolved: true, resolution: "remote" as const };
      }
      return c;
    }).filter((c) => !c.resolved);

    // 同时保留共享模块返回的未解决冲突
    if (unresolved.length > 0) {
      const existingIds = new Set(this.conflicts.map((c) => c.id));
      for (const uc of unresolved) {
        if (!existingIds.has(uc.id)) {
          this.conflicts.push(uc);
        }
      }
    }
  }

  async addOperation(operation: SyncOperation): Promise<void> {
    this.pendingOperations.push(operation);
    await addToOfflineQueue({
      type: operation.action,
      entityType: operation.table as 'node' | 'edge' | 'graph' | 'settings',
      entityId: operation.recordId,
      graphId: "default",
      data: operation.data,
    });
  }

  async getStatus(): Promise<SyncStatus> {
    return {
      isRunning: this.isRunning,
      lastSync: this.lastSync,
      lastSyncStatus: this.lastSyncStatus,
      pendingOperations: this.pendingOperations.length,
      conflicts: this.conflicts,
      devices: deviceDiscoveryService.getDevices(),
    };
  }

  getDevices(): SyncDevice[] {
    return deviceDiscoveryService.getDevices();
  }

  generatePairingCode(): string {
    return syncAuthService.generatePairingCode();
  }

  async pairDevice(
    deviceId: string,
    deviceName: string,
    pairingCode: string,
  ): Promise<boolean> {
    return syncAuthService.pairDevice(deviceId, deviceName, pairingCode);
  }

  unpairDevice(deviceId: string): boolean {
    return syncAuthService.unpairDevice(deviceId);
  }

  getPairedDevices(): PairedDevice[] {
    return syncAuthService.getPairedDevices();
  }

  isDevicePaired(deviceId: string): boolean {
    return syncAuthService.isDevicePaired(deviceId);
  }
}

export const mobileSyncService = new MobileSyncService();
