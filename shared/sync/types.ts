/**
 * 同步模块统一类型定义
 * 兼容 Electron 端和移动端的同步需求
 */

/** 同步操作类型 */
export interface SyncOperation {
  id: string;
  action: "create" | "update" | "delete";
  table: string;
  recordId: string;
  data: Record<string, unknown>;
  timestamp: string;
  userId: string;
  /** 客户端生成的操作唯一 ID（UUID），用于幂等性检查 */
  clientOpId?: string;
}

/** 同步批次 */
export interface SyncBatch {
  batchId: string;
  timestamp: string;
  operations: SyncOperation[];
  deviceId: string;
  userId: string;
}

/** 同步冲突 */
export interface SyncConflict {
  id: string;
  table: string;
  recordId: string;
  localVersion: SyncOperation;
  remoteVersion: SyncOperation;
  resolved: boolean;
  resolution?: "local" | "remote" | "merge";
}

/** 同步设备 */
export interface SyncDevice {
  id: string;
  name: string;
  ipAddress: string;
  lastSeen: string;
  status: "online" | "offline";
}

/** 同步配置 */
export interface SyncConfig {
  enabled: boolean;
  autoSync: boolean;
  syncInterval: number;
  syncMode: "lan" | "cloud";
  lanPort: number;
  deviceName: string;
  deviceId: string;
}

/** Electron 端 push API 使用的操作格式 */
export interface PushOperation {
  table: string;
  action: "create" | "update" | "delete";
  id: string;
  data?: Record<string, unknown>;
  clientUpdatedAt: string;
}

/** 同步状态 */
export interface SyncStatus {
  isRunning: boolean;
  lastSync?: string;
  lastSyncStatus?: "success" | "error";
  pendingOperations: number;
  conflicts: SyncConflict[];
  devices: SyncDevice[];
}
