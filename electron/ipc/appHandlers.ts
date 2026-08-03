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

  ipcMain.handle('app:getAutoLaunch', () => {
    return app.getLoginItemSettings().openAtLogin;
  });

  ipcMain.handle('app:setAutoLaunch', (_event, { enabled }: { enabled: boolean }) => {
    app.setLoginItemSettings({ openAtLogin: enabled });
  });

  ipcMain.handle('app:setupJumpList', async () => {
    const jumpList: Electron.JumpListCategory[] = [
      {
        type: 'tasks',
        name: 'Tasks',
        items: [
          {
            type: 'task',
            title: '新建图谱',
            program: process.execPath,
            args: '--new-graph',
            iconPath: process.execPath,
            iconIndex: 0,
            description: '创建一个新的知识图谱',
          },
        ],
      },
    ];
    app.setJumpList(jumpList);
    return { success: true };
  });

  ipcMain.handle('app:addRecentDocument', async (_event, { path: filePath }: { path: string }) => {
    app.addRecentDocument(filePath);
    return { success: true };
  });

  ipcMain.handle('app:clearRecentDocuments', async () => {
    app.clearRecentDocuments();
    return { success: true };
  });
}
