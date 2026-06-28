import { BrowserWindow, ipcMain } from 'electron';

export interface WindowHandlerDeps {
  /** Returns the current main window (may be null after close). */
  getMainWindow: () => BrowserWindow | null;
}

export function registerWindowHandlers(deps: WindowHandlerDeps): void {
  ipcMain.handle('window:minimize', () => {
    deps.getMainWindow()?.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    const mainWindow = deps.getMainWindow();
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle('window:close', () => {
    deps.getMainWindow()?.close();
  });
}
