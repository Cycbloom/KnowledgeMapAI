import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { SyncOperation, SyncBatch, SyncStatus, SyncConflict, SyncDevice, SyncConfig } from './syncTypes.js';
import { SyncStateManager } from './syncStateManager.js';
import { DeviceDiscoveryService } from './deviceDiscoveryService.js';
import { SyncAuthService } from './syncAuthService.js';
import { ConflictService } from './conflictService.js';

export class SyncService {
  private isRunning = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private config: SyncConfig;
  private pendingOperations: SyncOperation[] = [];
  private conflicts: SyncConflict[] = [];
  private lastSync?: string;
  private lastSyncStatus?: 'success' | 'error';
  private dbPath: string;
  private configPath: string;
  private syncStateManager: SyncStateManager;
  private deviceDiscoveryService: DeviceDiscoveryService;
  private syncAuthService: SyncAuthService;
  private conflictService: ConflictService;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.configPath = path.join(path.dirname(dbPath), 'sync-config.json');
    this.config = this.loadConfig();
    
    const db = new Database(dbPath);
    this.syncStateManager = new SyncStateManager(db);
    
    this.deviceDiscoveryService = new DeviceDiscoveryService(
      this.config.deviceId,
      this.config.deviceName
    );
    
    this.syncAuthService = new SyncAuthService(
      this.config.deviceId,
      this.config.deviceName,
      path.dirname(dbPath)
    );
    
    this.conflictService = new ConflictService();
  }

  private loadConfig(): SyncConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Failed to load sync config:', error);
    }
    return this.getDefaultConfig();
  }

  private getDefaultConfig(): SyncConfig {
    return {
      enabled: false,
      autoSync: true,
      syncInterval: 15, // 15 minutes
      syncMode: 'lan',
      lanPort: 3001,
      deviceName: `Device-${Math.random().toString(36).substr(2, 9)}`,
      deviceId: `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  private saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Failed to save sync config:', error);
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    
    if (this.config.autoSync) {
      this.startAutoSync();
    }

    if (this.config.syncMode === 'lan') {
      this.startLanServer();
      await this.deviceDiscoveryService.start();
    }

    console.log('Sync service started');
  }

  async stop(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    if (this.config.syncMode === 'lan') {
      await this.deviceDiscoveryService.stop();
    }
    
    this.isRunning = false;
    console.log('Sync service stopped');
  }

  private startAutoSync(): void {
    this.syncInterval = setInterval(async () => {
      await this.sync();
    }, this.config.syncInterval * 60 * 1000);
  }

  private startLanServer(): void {
    // TODO: Implement LAN server for device discovery and sync
    console.log('LAN sync server started on port', this.config.lanPort);
  }

  async sync(): Promise<boolean> {
    if (!this.isRunning || !this.config.enabled) {
      return false;
    }

    try {
      console.log('Starting sync...');
      
      // 1. Process pending operations
      await this.processPendingOperations();
      
      // 2. Discover devices
      await this.discoverDevices();
      
      // 3. Sync with available devices
      for (const device of this.deviceDiscoveryService.getDevices().filter((d: SyncDevice) => d.status === 'online')) {
        await this.syncWithDevice(device);
      }
      
      // 4. Process conflicts
      await this.processConflicts();
      
      this.lastSync = new Date().toISOString();
      this.lastSyncStatus = 'success';
      console.log('Sync completed successfully');
      return true;
    } catch (error) {
      console.error('Sync failed:', error);
      this.lastSync = new Date().toISOString();
      this.lastSyncStatus = 'error';
      return false;
    }
  }

  private async processPendingOperations(): Promise<void> {
    const pendingOps = await this.syncStateManager.getPendingOperations();
    if (pendingOps.length === 0) {
      return;
    }
    console.log(`Processing ${pendingOps.length} pending operations`);
    
    // Create sync batch
    const batch = await this.syncStateManager.createSyncBatch(
      pendingOps,
      this.config.deviceId,
      'user-placeholder' // TODO: Get actual user ID
    );
    
    // Mark operations as synced after successful sync
    const operationIds = pendingOps.map(op => op.id);
    await this.syncStateManager.markOperationsAsSynced(operationIds);
  }

  private async discoverDevices(): Promise<void> {
    console.log('Discovering devices...');
    const devices = await this.deviceDiscoveryService.discoverDevices();
    console.log(`Found ${devices.length} devices`);
  }

  private async syncWithDevice(device: SyncDevice): Promise<void> {
    console.log(`Syncing with device: ${device.name} (${device.ipAddress})`);
    
    // 检查设备是否已配对
    if (!this.syncAuthService.isDevicePaired(device.id)) {
      console.log(`Device ${device.id} is not paired, skipping sync`);
      return;
    }
    
    // 生成同步令牌
    const token = this.syncAuthService.generateSyncToken(device.id);
    if (!token) {
      console.log(`Failed to generate sync token for device ${device.id}`);
      return;
    }
    
    // TODO: 实现与设备的同步逻辑，使用令牌进行认证
    console.log(`Generated sync token for device ${device.id}`);
    
    // 更新最后同步时间
    this.syncAuthService.updateLastSync(device.id);
  }

  private async processConflicts(): Promise<void> {
    if (this.conflicts.length === 0) {
      return;
    }
    console.log(`Processing ${this.conflicts.length} conflicts`);
    
    // Auto-resolve conflicts
    const resolvedOperations = this.conflictService.autoResolveConflicts(this.conflicts);
    
    // Apply resolved operations
    for (const op of resolvedOperations) {
      this.addOperation(op);
    }
    
    // Clear resolved conflicts
    this.conflicts = this.conflicts.filter(c => !c.resolved);
    
    console.log(`Auto-resolved ${resolvedOperations.length} conflicts`);
  }

  addOperation(operation: SyncOperation): void {
    this.syncStateManager.addOperation(operation, this.config.deviceId);
    console.log(`Added sync operation: ${operation.type} ${operation.table} ${operation.recordId}`);
  }

  async getStatus(): Promise<SyncStatus> {
    const stats = await this.syncStateManager.getSyncStats();
    return {
      isRunning: this.isRunning,
      lastSync: this.lastSync,
      lastSyncStatus: this.lastSyncStatus,
      pendingOperations: stats.pendingOperations,
      conflicts: this.conflicts,
    };
  }

  getDevices(): SyncDevice[] {
    return this.deviceDiscoveryService.getDevices();
  }

  getConfig(): SyncConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();
    
    if (this.config.autoSync && this.isRunning) {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
      }
      this.startAutoSync();
    }
  }

  resolveConflict(conflictId: string, resolution: 'local' | 'remote' | 'merge'): void {
    const conflict = this.conflicts.find(c => c.id === conflictId);
    if (conflict) {
      // Resolve the conflict using ConflictService
      const resolvedOperation = this.conflictService.resolveConflict(conflict, resolution);
      
      // Add the resolved operation
      this.addOperation(resolvedOperation);
      
      // Mark the conflict as resolved
      conflict.resolved = true;
      conflict.resolution = resolution;
      
      console.log(`Resolved conflict ${conflictId} with ${resolution} resolution`);
    }
  }

  // 设备配对相关方法
  generatePairingCode(): string {
    return this.syncAuthService.generatePairingCode();
  }

  pairDevice(deviceId: string, deviceName: string, sharedSecret: string): boolean {
    return this.syncAuthService.pairDevice(deviceId, deviceName, sharedSecret);
  }

  unpairDevice(deviceId: string): boolean {
    return this.syncAuthService.unpairDevice(deviceId);
  }

  getPairedDevices(): any[] {
    return this.syncAuthService.getPairedDevices();
  }

  isDevicePaired(deviceId: string): boolean {
    return this.syncAuthService.isDevicePaired(deviceId);
  }

  validateSyncToken(token: string, deviceId: string): boolean {
    return this.syncAuthService.validateSyncToken(token, deviceId);
  }

  async processSyncBatch(batch: any): Promise<any> {
    try {
      console.log(`Processing sync batch from device ${batch.deviceId}`);
      
      // Apply remote operations
      for (const operation of batch.operations) {
        try {
          await this.applyOperation(operation);
        } catch (error) {
          console.error(`Failed to apply operation ${operation.id}:`, error);
          // Create conflict
          const conflict: SyncConflict = {
            id: `conflict-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            table: operation.table,
            recordId: operation.recordId,
            localVersion: await this.getLocalVersion(operation.table, operation.recordId),
            remoteVersion: operation,
            resolved: false
          };
          this.conflicts.push(conflict);
        }
      }
      
      // Create response batch with pending operations
      const pendingOps = await this.syncStateManager.getPendingOperations();
      const responseBatch = {
        batchId: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        operations: pendingOps,
        deviceId: this.config.deviceId,
        userId: 'user-placeholder'
      };
      
      // Mark operations as synced
      const operationIds = pendingOps.map(op => op.id);
      await this.syncStateManager.markOperationsAsSynced(operationIds);
      
      return responseBatch;
    } catch (error) {
      console.error('Failed to process sync batch:', error);
      throw error;
    }
  }

  async createSyncBatch(deviceId: string): Promise<any> {
    try {
      console.log(`Creating sync batch for device ${deviceId}`);
      
      // Get pending operations
      const pendingOps = await this.syncStateManager.getPendingOperations();
      
      // Create sync batch
      const batch = {
        batchId: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        operations: pendingOps,
        deviceId: this.config.deviceId,
        userId: 'user-placeholder'
      };
      
      // Mark operations as synced
      const operationIds = pendingOps.map(op => op.id);
      await this.syncStateManager.markOperationsAsSynced(operationIds);
      
      return batch;
    } catch (error) {
      console.error('Failed to create sync batch:', error);
      throw error;
    }
  }

  private async applyOperation(operation: SyncOperation): Promise<void> {
    // TODO: Implement actual operation application
    // This would involve updating the local database
    console.log(`Applying operation: ${operation.type} ${operation.table} ${operation.recordId}`);
  }

  private async getLocalVersion(table: string, recordId: string): Promise<SyncOperation> {
    // TODO: Implement actual local version retrieval
    // This would involve querying the local database
    return {
      id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'update',
      table,
      record: {},
      recordId,
      timestamp: new Date().toISOString(),
      userId: 'user-placeholder'
    };
  }
}

export const syncService = new SyncService(path.join(process.env.APPDATA || '', 'KnowledgeMap', 'knowledgemap.db'));
