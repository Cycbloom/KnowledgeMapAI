import { app, ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export function registerConfigHandlers(): void {
  ipcMain.handle('config:read', async () => {
    try {
      const configPath = path.join(app.getPath('userData'), 'config.json');
      if (!fs.existsSync(configPath)) {
        return {};
      }
      const content = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  });

  ipcMain.handle('config:write', async (_event, data: Record<string, unknown>) => {
    try {
      const userDataPath = app.getPath('userData');
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
      const configPath = path.join(userDataPath, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true };
    } catch (error) {
      const err = error as Error;
      return { success: false, error: err.message };
    }
  });
}
