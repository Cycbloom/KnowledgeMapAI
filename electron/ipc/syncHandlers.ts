import { ipcMain } from 'electron';
import type { SyncEngine } from '../sync/syncEngine';

export interface SyncHandlerDeps {
  /** Returns the SyncEngine instance (null when local DB unavailable). */
  getSyncEngine: () => SyncEngine | null;
}

/**
 * Registers sync control IPC handlers.
 *
 * Migrated from syncEngine.ts registerIpcHandlers() (lines 357-394).
 * The handlers delegate to the SyncEngine instance injected via deps to avoid
 * reaching into the engine's internals from main.ts.
 */
export function registerSyncHandlers(deps: SyncHandlerDeps): void {
  ipcMain.handle('sync:getStatus', async () => {
    const engine = deps.getSyncEngine();
    if (!engine) {
      return { success: false, error: 'Sync engine not initialized' };
    }
    return { success: true, data: engine.getStatus() };
  });

  ipcMain.handle('sync:trigger', async () => {
    const engine = deps.getSyncEngine();
    if (!engine) {
      return { success: false, error: 'Sync engine not initialized' };
    }
    try {
      await engine.sync();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('sync:pause', async () => {
    const engine = deps.getSyncEngine();
    if (!engine) {
      return { success: false, error: 'Sync engine not initialized' };
    }
    engine.stop();
    return { success: true };
  });

  ipcMain.handle('sync:resume', async () => {
    const engine = deps.getSyncEngine();
    if (!engine) {
      return { success: false, error: 'Sync engine not initialized' };
    }
    engine.start();
    return { success: true };
  });

  ipcMain.handle('sync:setAuthToken', async (_event, token: string) => {
    const engine = deps.getSyncEngine();
    if (!engine) {
      return { success: false, error: 'Sync engine not initialized' };
    }
    engine.setAuthToken(token);
    return { success: true };
  });

  ipcMain.handle('sync:fullSync', async () => {
    const engine = deps.getSyncEngine();
    if (!engine) {
      return { success: false, error: 'Sync engine not initialized' };
    }
    try {
      await engine.fullSync();
      return { success: true };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });
}
