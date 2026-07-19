import { BrowserWindow, dialog, ipcMain } from 'electron';
import { logger } from '../utils/logger';

// Channels registered (must be added to IPC_HANDLE_CHANNELS in main.ts):
// - dialog:showSaveDialog
// - dialog:showOpenDialog
// - dialog:showMessageBox
// - dialog:showErrorBox

export interface DialogHandlerDeps {
  /** Returns the current main window (may be null). */
  getMainWindow: () => BrowserWindow | null;
}

/**
 * Returns the parent window for dialog calls. Electron's dialog APIs accept
 * `undefined` as the parent (no modal attachment), so we normalize null → undefined.
 */
function getParentWindow(deps: DialogHandlerDeps): BrowserWindow | undefined {
  return deps.getMainWindow() ?? undefined;
}

export function registerDialogHandlers(deps: DialogHandlerDeps): void {
  ipcMain.handle(
    'dialog:showSaveDialog',
    async (_event, options: Electron.SaveDialogOptions) => {
      try {
        const parent = getParentWindow(deps);
        const result = parent
          ? await dialog.showSaveDialog(parent, options)
          : await dialog.showSaveDialog(options);
        return { canceled: result.canceled, filePath: result.filePath ?? null };
      } catch (error) {
        logger.error('[Dialog] showSaveDialog 失败', error);
        return { canceled: true, filePath: null };
      }
    },
  );

  ipcMain.handle(
    'dialog:showOpenDialog',
    async (_event, options: Electron.OpenDialogOptions) => {
      try {
        const parent = getParentWindow(deps);
        const result = parent
          ? await dialog.showOpenDialog(parent, options)
          : await dialog.showOpenDialog(options);
        return { canceled: result.canceled, filePaths: result.filePaths };
      } catch (error) {
        logger.error('[Dialog] showOpenDialog 失败', error);
        return { canceled: true, filePaths: [] };
      }
    },
  );

  ipcMain.handle(
    'dialog:showMessageBox',
    async (_event, options: Electron.MessageBoxOptions) => {
      try {
        const parent = getParentWindow(deps);
        const result = parent
          ? await dialog.showMessageBox(parent, options)
          : await dialog.showMessageBox(options);
        return { response: result.response, checkboxChecked: result.checkboxChecked };
      } catch (error) {
        logger.error('[Dialog] showMessageBox 失败', error);
        return { response: -1, checkboxChecked: false };
      }
    },
  );

  ipcMain.handle(
    'dialog:showErrorBox',
    (_event, title: string, content: string) => {
      if (typeof title !== 'string' || typeof content !== 'string') {
        return { success: false };
      }
      try {
        dialog.showErrorBox(title, content);
        return { success: true };
      } catch (error) {
        logger.error('[Dialog] showErrorBox 失败', error);
        return { success: false };
      }
    },
  );
}
