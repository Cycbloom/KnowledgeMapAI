import {
  SyncOperation,
  SyncBatch,
  SyncDevice,
  SyncConflict,
} from "./syncTypes";
import { deviceDiscoveryService } from "./deviceDiscoveryService";
import { syncAuthService } from "./syncAuthService";
import { conflictService } from "./conflictService";
import {
  getOfflineQueue,
  addToOfflineQueue,
  clearOfflineQueue,
} from "../../utils/offlineStorage";

export class MobileSyncService {
  private isRunning = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private pendingOperations: SyncOperation[] = [];
  private conflicts: SyncConflict[] = [];
  private lastSync?: string;
  private lastSyncStatus?: "success" | "error";
  private deviceId: string;
  private deviceName: string;

  constructor() {
    this.deviceId = `mobile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.deviceName = `Mobile-${Math.random().toString(36).substr(2, 9)}`;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

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
      console.error("Mobile sync failed:", error);
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
      record: op.data || {},
      recordId: op.entityId,
      timestamp: new Date(op.timestamp).toISOString(),
      userId: "user-placeholder",
    }));
  }

  private async discoverDevices(): Promise<void> {
    await deviceDiscoveryService.discoverDevices();
  }

  private async syncWithDevice(device: SyncDevice): Promise<void> {
    if (!syncAuthService.isDevicePaired(device.id)) {
      return;
    }

    const token = syncAuthService.generateSyncToken(device.id);
    if (!token) {
      return;
    }

    try {
      // Send pending operations to device
      if (this.pendingOperations.length > 0) {
        const batch: SyncBatch = {
          batchId: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
          operations: this.pendingOperations,
          deviceId: this.deviceId,
          userId: "user-placeholder", // TODO: Get actual user ID
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
      console.error(`Failed to sync with device ${device.id}:`, error);
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
          id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

  private async applyOperation(_operation: SyncOperation): Promise<void> {
  }

  private async getLocalVersion(
    table: string,
    recordId: string,
  ): Promise<SyncOperation> {
    // 模拟获取本地版本，实际实现需要根据具体的存储机制来处理
    return {
      id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: "update",
      table,
      record: {},
      recordId,
      timestamp: new Date().toISOString(),
      userId: "user-placeholder",
    };
  }

  private async processConflicts(): Promise<void> {
    if (this.conflicts.length === 0) {
      return;
    }

    const resolvedOperations = conflictService.autoResolveConflicts(
      this.conflicts,
    );

    for (const op of resolvedOperations) {
      await this.applyOperation(op);
    }

    this.conflicts = this.conflicts.filter((c) => !c.resolved);
  }

  async addOperation(operation: SyncOperation): Promise<void> {
    this.pendingOperations.push(operation);
    await addToOfflineQueue({
      type: operation.type,
      entityType: operation.table as any,
      entityId: operation.recordId,
      graphId: "default",
      data: operation.record,
    });
  }

  async getStatus(): Promise<any> {
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

  getPairedDevices(): any[] {
    return syncAuthService.getPairedDevices();
  }

  isDevicePaired(deviceId: string): boolean {
    return syncAuthService.isDevicePaired(deviceId);
  }
}

export const mobileSyncService = new MobileSyncService();
