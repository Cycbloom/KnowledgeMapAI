import { app, BrowserWindow, ipcMain } from 'electron';
import pkg from 'electron-updater';
import { logger } from '../utils/logger';

const { autoUpdater } = pkg;

export interface UpdateHandlerDeps {
  /** Returns the current main window used to push update events to renderer. */
  getMainWindow: () => BrowserWindow | null;
}

/**
 * Registers IPC handlers for the update flow.
 *
 * Channels:
 * - update:check            — trigger an update check
 * - update:install          — legacy: quit and install immediately
 * - update:confirm-download — user accepted the update-available prompt; start downloading
 * - update:install-confirmed — user accepted the update-downloaded prompt; quit and install
 */
export function registerUpdateHandlers(_deps: UpdateHandlerDeps): void {
  ipcMain.handle('update:check', () => {
    if (app.isPackaged) {
      autoUpdater.checkForUpdates();
      return { success: true, message: '开始检查更新' };
    }
    return { success: false, message: '开发模式下不检查更新' };
  });

  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall();
    return { success: true };
  });

  ipcMain.handle('update:confirm-download', () => {
    try {
      autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      const err = error as Error;
      logger.error('[AutoUpdater] downloadUpdate failed', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('update:install-confirmed', () => {
    try {
      autoUpdater.quitAndInstall();
      return { success: true };
    } catch (error) {
      const err = error as Error;
      logger.error('[AutoUpdater] quitAndInstall failed', err);
      return { success: false, error: err.message };
    }
  });
}

/**
 * Configures auto-updater event listeners.
 *
 * UX flow (Task 7):
 * - autoDownload is disabled; the renderer must confirm via update:confirm-download
 * - update-downloaded no longer force-installs; the renderer must confirm via update:install-confirmed
 */
export function configureAutoUpdater(deps: UpdateHandlerDeps): void {
  if (!app.isPackaged) {
    logger.info(
      '[AutoUpdater] Skipping auto updater configuration in development mode',
    );
    return;
  }

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'knowledgemap',
    repo: 'knowledgemap-app',
    releaseType: 'release',
  });

  // Task 7.1: disable auto-download — renderer must confirm before downloading
  autoUpdater.autoDownload = false;

  autoUpdater.on('checking-for-update', () => {
    logger.info('[AutoUpdater] 检查更新中...');
    deps.getMainWindow()?.webContents.send('update:checking');
  });

  // Task 7.2: notify renderer only; do not auto-download
  autoUpdater.on('update-available', (info) => {
    logger.info('[AutoUpdater] 发现新版本', info);
    deps.getMainWindow()?.webContents.send('update:available', info);
  });

  autoUpdater.on('update-not-available', () => {
    logger.info('[AutoUpdater] 当前已是最新版本');
    deps.getMainWindow()?.webContents.send('update:not-available');
  });

  autoUpdater.on('error', (error) => {
    logger.error('[AutoUpdater] 更新错误', error);
    deps
      .getMainWindow()
      ?.webContents.send('update:error', { error: error.message });
  });

  autoUpdater.on('download-progress', (progress) => {
    const progressInfo = {
      percent: Math.round(progress.percent),
      speed: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    };
    logger.info('[AutoUpdater] 下载进度', progressInfo);
    deps
      .getMainWindow()
      ?.webContents.send('update:download-progress', progressInfo);
  });

  // Task 7.4: notify renderer only; do NOT force quitAndInstall
  autoUpdater.on('update-downloaded', (info) => {
    logger.info('[AutoUpdater] 更新已下载完成', info);
    deps.getMainWindow()?.webContents.send('update:downloaded', info);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 5000);
}
