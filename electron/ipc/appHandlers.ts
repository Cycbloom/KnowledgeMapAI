import { app, ipcMain } from 'electron';

export interface AppHandlerDeps {
  /** Returns the port the API server is listening on (0 when not started). */
  getPort: () => number;
}

export function registerAppHandlers(deps: AppHandlerDeps): void {
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:getPlatform', () => {
    return process.platform;
  });

  ipcMain.handle('api:getPort', () => {
    return deps.getPort();
  });

  ipcMain.handle('app:quit', () => {
    app.quit();
  });
}
