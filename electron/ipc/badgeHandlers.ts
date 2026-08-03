import { app, ipcMain } from 'electron';
import { logger } from '../utils/logger';

export function registerBadgeHandlers(): void {
  ipcMain.handle('badge:set', async (_event, { count }: { count: number }) => {
    const badgeCount = Math.max(0, Math.floor(count));
    const success = app.setBadgeCount(badgeCount);
    if (process.platform === 'darwin') {
      app.dock?.setBadge(badgeCount > 0 ? String(badgeCount) : '');
    }
    logger.info('[Badge] 徽标已更新', { count: badgeCount, platform: process.platform, success });
    return { success: true, count: badgeCount };
  });
}