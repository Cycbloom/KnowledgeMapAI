import {
  SyncOperation,
  SyncBatch,
  SyncDevice,
  SyncConflict,
  SyncStatus,
} from "./syncTypes";
import { deviceDiscoveryService } from "./deviceDiscoveryService";
import { syncAuthService, PairedDevice } from "./syncAuthService";
import {
  getOfflineQueue,
  addToOfflineQueue,
  clearOfflineQueue,
} from "../../utils/offlineStorage";
import { autoResolveConflicts } from "../../../shared/sync/conflictResolver";
import type { SyncOperation as SharedSyncOperation, SyncConflict as SharedSyncConflict } from "../../../shared/sync/types";
import { getSupabaseClient } from "../../lib/supabase";

/** 将移动端 SyncOperation 转换为共享模块 SyncOperation */
function toSharedOperation(op: SyncOperation): SharedSyncOperation {
  return {
    id: op.id,
    action: op.type,
    table: op.table,
    recordId: op.recordId,
    data: op.record,
    timestamp: op.timestamp,
    userId: op.userId,
  };
}

/** 将共享模块 SyncOperation 转换为移动端 SyncOperation */
function fromSharedOperation(op: SharedSyncOperation): SyncOperation {
  return {
    id: op.id,
    type: op.action,
    table: op.table,
    record: op.data,
    recordId: op.recordId,
    timestamp: op.timestamp,
    userId: op.userId,
  };
}

/** 将移动端 SyncConflict 转换为共享模块 SyncConflict */
function toSharedConflict(conflict: SyncConflict): SharedSyncConflict {
  return {
    id: conflict.id,
    table: conflict.table,
    recordId: conflict.recordId,
    localVersion: toSharedOperation(conflict.localVersion),
    remoteVersion: toSharedOperation(conflict.remoteVersion),
    resolved: conflict.resolved,
    resolution: conflict.resolution,
  };
}

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
    } catch {
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
      type: op.type,
      table: op.entityType,
      record: (op.data || {}) as Record<string, unknown>,
      recordId: op.entityId,
      timestamp: new Date(op.timestamp).toISOString(),
      userId: this.userId,
    }));
  }

  private async discoverDevices(): Promise<void> {
    await deviceDiscoveryService.discoverDevices();
  }

  private async syncWithDevice(device: SyncDevice): Promise<void> {
    if (!syncAuthService.isDevicePaired(device.id)) {
      return;
    }

    const token = await syncAuthService.generateSyncToken(device.id);
    if (!token) {
      return;
    }

    try {
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
    } catch (error) {
      console.warn(`Failed to sync with device ${device.id}:`, error);
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
      throw new Error("Supabase client not initialized");
    }

    switch (operation.type) {
      case "create": {
        const { error } = await supabase
          .from(operation.table)
          .insert(operation.record);
        if (error) throw error;
        break;
      }
      case "update": {
        const { error } = await supabase
          .from(operation.table)
          .update(operation.record)
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
  }

  private async getLocalVersion(
    table: string,
    recordId: string,
  ): Promise<SyncOperation> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return {
        id: `local-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
        type: "update",
        table,
        record: {},
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
      type: "update",
      table,
      record: data ? data as Record<string, unknown> : {},
      recordId,
      timestamp: (data as Record<string, unknown>)?.updated_at as string ?? (data as Record<string, unknown>)?.created_at as string ?? new Date().toISOString(),
      userId: this.userId,
    };
  }

  private async processConflicts(): Promise<void> {
    if (this.conflicts.length === 0) {
      return;
    }

    // 转换为共享模块格式并使用共享冲突解决器
    const sharedConflicts = this.conflicts.map(toSharedConflict);
    const { resolved, unresolved } = autoResolveConflicts(sharedConflicts);

    // 将已解决的操作转换回移动端格式并应用
    for (const sharedOp of resolved) {
      const op = fromSharedOperation(sharedOp);
      await this.applyOperation(op);
    }

    // 更新冲突列表：标记已解决的，保留未解决的
    const resolvedIds = new Set(resolved.map((op) => op.id));
    this.conflicts = this.conflicts.map((c) => {
      const sharedC = toSharedConflict(c);
      if (resolvedIds.has(sharedC.localVersion.id) || resolvedIds.has(sharedC.remoteVersion.id)) {
        return { ...c, resolved: true, resolution: "remote" as const };
      }
      return c;
    }).filter((c) => !c.resolved);

    // 同时保留共享模块返回的未解决冲突
    if (unresolved.length > 0) {
      const existingIds = new Set(this.conflicts.map((c) => c.id));
      for (const uc of unresolved) {
        if (!existingIds.has(uc.id)) {
          this.conflicts.push({
            id: uc.id,
            table: uc.table,
            recordId: uc.recordId,
            localVersion: fromSharedOperation(uc.localVersion),
            remoteVersion: fromSharedOperation(uc.remoteVersion),
            resolved: false,
          });
        }
      }
    }
  }

  async addOperation(operation: SyncOperation): Promise<void> {
    this.pendingOperations.push(operation);
    await addToOfflineQueue({
      type: operation.type,
      entityType: operation.table as 'node' | 'edge' | 'graph' | 'settings',
      entityId: operation.recordId,
      graphId: "default",
      data: operation.record,
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
