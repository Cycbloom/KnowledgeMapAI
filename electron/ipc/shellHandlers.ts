import { ipcMain, shell } from 'electron';

export function registerShellHandlers(): void {
  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    if (typeof url !== 'string') {
      return { success: false, error: 'Invalid URL type' };
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { success: false, error: 'Only http:// and https:// URLs are allowed' };
    }
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      const err = error as Error;
      return { success: false, error: err.message };
    }
  });
}
