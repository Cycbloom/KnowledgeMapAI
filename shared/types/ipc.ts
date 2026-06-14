export interface IpcDbRequest {
  resource: string;
  method: string;
  params: Record<string, unknown>;
}

export interface IpcDbResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface IpcDbBatchRequest {
  operations: IpcDbRequest[];
}

export interface DbStatus {
  isReady: boolean;
  pendingPushCounts: Record<string, number>;
  totalPendingPush: number;
}

export interface SyncStatus {
  isRunning: boolean;
  isOnline: boolean;
  lastSyncAt: string | null;
  pendingPush: number;
  pendingPull: number;
  conflicts: number;
  error?: string;
}
