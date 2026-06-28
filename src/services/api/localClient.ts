import type { IpcDbRequest, IpcDbResponse, DbStatus } from '@shared/types/ipc';

// Cloud-only resources that should never use local IPC
const CLOUD_ONLY_RESOURCES = new Set([
  'ai', 'rag', 'embeddings', 'search', 'agent',
  'literature', 'auto_graph', 'story', 'podcast',
]);

let localDbAvailable: boolean | null = null;

/**
 * Check if local SQLite database is available via IPC
 */
export async function isLocalDbAvailable(): Promise<boolean> {
  if (localDbAvailable !== null) return localDbAvailable;

  try {
    const electronAPI = window.electronAPI;
    if (!electronAPI?.db?.getStatus) {
      localDbAvailable = false;
      return false;
    }

    const response = await electronAPI.db.getStatus() as IpcDbResponse<DbStatus>;
    localDbAvailable = response.success && response.data?.isReady === true;
    return localDbAvailable;
  } catch {
    localDbAvailable = false;
    return false;
  }
}

/**
 * Reset the cached availability (e.g., after error)
 */
export function resetLocalDbAvailability(): void {
  localDbAvailable = null;
}

/**
 * Check if a resource should use cloud-only path
 */
export function isCloudOnlyResource(resource: string): boolean {
  return CLOUD_ONLY_RESOURCES.has(resource);
}

/**
 * Execute a query via local IPC → SQLite
 * Returns null if local DB is not available or resource is cloud-only
 */
export async function localQuery<T = unknown>(request: IpcDbRequest): Promise<T | null> {
  // Skip cloud-only resources
  if (isCloudOnlyResource(request.resource)) {
    return null;
  }

  // Check availability
  const available = await isLocalDbAvailable();
  if (!available) return null;

  const electronAPI = window.electronAPI;
  if (!electronAPI) return null;

  try {
    const response = await electronAPI.db.query(request) as IpcDbResponse<T>;
    if (!response.success) {
      console.warn(`[LocalClient] IPC query failed: ${response.error}`);
      return null;
    }
    return response.data as T;
  } catch (error) {
    console.warn('[LocalClient] IPC query error:', error);
    resetLocalDbAvailability();
    return null;
  }
}

/**
 * Execute a batch of operations via local IPC → SQLite
 * Returns null if local DB is not available
 */
export async function localBatch<T = unknown>(operations: IpcDbRequest[]): Promise<T[] | null> {
  // Skip if any operation is cloud-only
  if (operations.some(op => isCloudOnlyResource(op.resource))) {
    return null;
  }

  const available = await isLocalDbAvailable();
  if (!available) return null;

  const electronAPI = window.electronAPI;
  if (!electronAPI) return null;

  try {
    const response = await electronAPI.db.batch(operations) as IpcDbResponse<T[]>;
    if (!response.success) {
      console.warn(`[LocalClient] IPC batch failed: ${response.error}`);
      return null;
    }
    return response.data as T[];
  } catch (error) {
    console.warn('[LocalClient] IPC batch error:', error);
    resetLocalDbAvailability();
    return null;
  }
}

/**
 * Get local database status
 */
export async function getLocalDbStatus(): Promise<DbStatus | null> {
  try {
    const available = await isLocalDbAvailable();
    if (!available) return null;

    const electronAPI = window.electronAPI;
    if (!electronAPI) return null;

    const response = await electronAPI.db.getStatus() as IpcDbResponse<DbStatus>;
    if (!response.success) return null;
    return response.data as DbStatus;
  } catch {
    return null;
  }
}

/**
 * Get sync status via IPC
 */
export async function getSyncStatus(): Promise<unknown | null> {
  try {
    if (!window.electronAPI?.sync?.getStatus) return null;
    const response = await window.electronAPI.sync.getStatus() as IpcDbResponse;
    return response.success ? response.data : null;
  } catch {
    return null;
  }
}

/**
 * Trigger sync via IPC
 */
export async function triggerSync(): Promise<boolean> {
  try {
    if (!window.electronAPI?.sync?.trigger) return false;
    const response = await window.electronAPI.sync.trigger() as IpcDbResponse;
    return response.success;
  } catch {
    return false;
  }
}

/**
 * Subscribe to sync status changes
 */
export function onSyncStatusChanged(callback: (status: unknown) => void): () => void {
  if (!window.electronAPI?.sync?.onStatusChanged) {
    return () => {};
  }
  return window.electronAPI.sync.onStatusChanged(callback);
}
