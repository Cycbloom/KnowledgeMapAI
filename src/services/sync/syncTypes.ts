export interface SyncOperation {
  id: string;
  type: "create" | "update" | "delete";
  table: string;
  record: Record<string, any>;
  recordId: string;
  timestamp: string;
  userId: string;
}

export interface SyncBatch {
  batchId: string;
  timestamp: string;
  operations: SyncOperation[];
  deviceId: string;
  userId: string;
}

export interface SyncStatus {
  isRunning: boolean;
  lastSync?: string;
  lastSyncStatus?: "success" | "error";
  pendingOperations: number;
  conflicts: SyncConflict[];
  devices: SyncDevice[];
}

export interface SyncConflict {
  id: string;
  table: string;
  recordId: string;
  localVersion: SyncOperation;
  remoteVersion: SyncOperation;
  resolved: boolean;
  resolution?: "local" | "remote" | "merge";
}

export interface SyncDevice {
  id: string;
  name: string;
  ipAddress: string;
  lastSeen: string;
  status: "online" | "offline";
}

export interface SyncConfig {
  enabled: boolean;
  autoSync: boolean;
  syncInterval: number; // in minutes
  syncMode: "lan" | "cloud";
  lanPort: number;
  deviceName: string;
  deviceId: string;
}
