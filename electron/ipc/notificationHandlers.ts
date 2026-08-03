import { BrowserWindow, ipcMain, Notification } from 'electron';
import { logger } from '../utils/logger';

// Channels registered (must be added to IPC_HANDLE_CHANNELS in main.ts):
// - notification:show

export interface NotificationHandlerDeps {
  /** Returns the current main window (may be null). */
  getMainWindow: () => BrowserWindow | null;
}

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  actionUrl?: string;
}

export function registerNotificationHandlers(deps: NotificationHandlerDeps): void {
  ipcMain.handle(
    'notification:show',
    async (_event, options: NotificationOptions) => {
      try {
        const { title, body, icon, actionUrl } = options;

        if (!title || !body) {
          logger.warn('[Notification] 缺少必要参数 title 或 body');
          return { success: false, error: 'Missing required parameters: title and body' };
        }

        const notification = new Notification({
          title,
          body,
          icon,
        });

        notification.on('click', () => {
          logger.info('[Notification] 通知被点击', { title, actionUrl });

          const mainWindow = deps.getMainWindow();
          if (mainWindow) {
            if (mainWindow.isMinimized()) {
              mainWindow.restore();
            }
            mainWindow.show();
            mainWindow.focus();

            if (actionUrl) {
              mainWindow.webContents.send('notification:clicked', { url: actionUrl });
            }
          }
        });

        notification.show();

        logger.info('[Notification] 通知已显示', { title, body, icon: icon ?? undefined });
        return { success: true };
      } catch (error) {
        logger.error('[Notification] 显示通知失败', error);
        return { success: false, error: String(error) };
      }
    },
  );
}