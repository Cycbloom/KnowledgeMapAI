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
    console.log("Mobile sync service started");
  }

  async stop(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    await deviceDiscoveryService.stop();
    this.isRunning = false;
    console.log("Mobile sync service stopped");
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
      console.log("Starting mobile sync...");

      // 1. Process pending operations
      await this.processPendingOperations();

      // 2. Discover devices
      await this.discoverDevices();

      // 3. Sync with available devices
      const onlineDevices = deviceDiscoveryService.getOnlineDevices();
      for (const device of onlineDevices) {
        await this.syncWithDevice(device);
      }

      // 4. Process conflicts
      await this.processConflicts();

      this.lastSync = new Date().toISOString();
      this.lastSyncStatus = "success";
      console.log("Mobile sync completed successfully");
      return true;
    } catch (error) {
      console.error("Mobile sync failed:", error);
      this.lastSync = new Date().toISOString();
      this.lastSyncStatus = "error";
      return false;
    }
  }

  private async processPendingOperations(): Promise<void> {
    // Get pending operations from offline storage
    const pendingOps = await getOfflineQueue();
    if (pendingOps.length === 0) {
      return;
    }
    console.log(`Processing ${pendingOps.length} pending operations`);

    // Convert offline operations to sync operations
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
    console.log("Discovering devices...");
    await deviceDiscoveryService.discoverDevices();
    const devices = deviceDiscoveryService.getOnlineDevices();
    console.log(`Found ${devices.length} online devices`);
  }

  private async syncWithDevice(device: SyncDevice): Promise<void> {
    console.log(`Syncing with device: ${device.name} (${device.ipAddress})`);

    // Check if device is paired
    if (!syncAuthService.isDevicePaired(device.id)) {
      console.log(`Device ${device.id} is not paired, skipping sync`);
      return;
    }

    // Generate sync token
    const token = syncAuthService.generateSyncToken(device.id);
    if (!token) {
      console.log(`Failed to generate sync token for device ${device.id}`);
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

  private async applyOperation(operation: SyncOperation): Promise<void> {
    // 模拟应用操作，实际实现需要根据具体的存储机制来处理
    console.log(
      `Applying operation: ${operation.type} ${operation.table} ${operation.recordId}`,
    );
    // TODO: 实现实际的操作应用逻辑
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
    console.log(`Processing ${this.conflicts.length} conflicts`);

    // Auto-resolve conflicts
    const resolvedOperations = conflictService.autoResolveConflicts(
      this.conflicts,
    );

    // Apply resolved operations
    for (const op of resolvedOperations) {
      await this.applyOperation(op);
    }

    // Clear resolved conflicts
    this.conflicts = this.conflicts.filter((c) => !c.resolved);

    console.log(`Auto-resolved ${resolvedOperations.length} conflicts`);
  }

  async addOperation(operation: SyncOperation): Promise<void> {
    this.pendingOperations.push(operation);
    await addToOfflineQueue({
      type: operation.type,
      entityType: operation.table as any,
      entityId: operation.recordId,
      graphId: "default", // TODO: Get actual graph ID
      data: operation.record,
    });
    console.log(
      `Added sync operation: ${operation.type} ${operation.table} ${operation.recordId}`,
    );
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
