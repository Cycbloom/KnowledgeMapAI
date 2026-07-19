import { ipcMain } from 'electron';
import { logger } from '../utils/logger';
import {
  startBlocker,
  stopBlocker,
  getActiveReasons,
} from '../utils/powerManager';

// Channels registered (must be added to IPC_HANDLE_CHANNELS in main.ts):
// - power:startBlocker
// - power:stopBlocker
// - power:getActiveReasons

/**
 * 注册电源管理 IPC handlers。
 *
 * powerManager 内部已记录正常路径日志，handler 仅在异常路径记录 error，
 * 避免重复日志。
 */
export function registerPowerHandlers(): void {
  ipcMain.handle('power:startBlocker', (_event, reason: string) => {
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      return { success: false, error: 'reason must be a non-empty string' };
    }
    try {
      startBlocker(reason);
      return { success: true };
    } catch (error) {
      const err = error as Error;
      logger.error(
        `[PowerHandlers] Failed to start blocker for reason: ${reason}`,
        error,
      );
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('power:stopBlocker', (_event, reason: string) => {
    if (typeof reason !== 'string' || reason.trim().length === 0) {
      return { success: false, error: 'reason must be a non-empty string' };
    }
    try {
      stopBlocker(reason);
      return { success: true };
    } catch (error) {
      const err = error as Error;
      logger.error(
        `[PowerHandlers] Failed to stop blocker for reason: ${reason}`,
        error,
      );
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('power:getActiveReasons', () => {
    return { reasons: getActiveReasons() };
  });
}
