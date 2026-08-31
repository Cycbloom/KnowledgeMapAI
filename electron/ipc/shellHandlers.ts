import { ipcMain, shell } from 'electron';
import { existsSync } from 'node:fs';
import { logger } from '../utils/logger';

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

  // 用系统默认应用打开本地文件（不同文件类型对应各自的默认打开软件）
  ipcMain.handle('shell:openPath', async (_event, rawPath: unknown) => {
    if (typeof rawPath !== 'string' || !rawPath) {
      return { success: false, error: 'Invalid path' };
    }
    // Windows 的 ShellExecuteEx 对带中文/正斜杠的路径可能失败，转回平台原生分隔符
    let filePath = rawPath;
    if (process.platform === 'win32') {
      filePath = rawPath.replace(/\//g, '\\');
      // 兜底：去掉 C:/ → \C:\ 前的多余前导斜杠，避免 /C:/... 找不到
      filePath = filePath.replace(/^\\(?=[A-Za-z]:\\)/, '');
    }
    if (!existsSync(filePath)) {
      return { success: false, error: `File not found: ${filePath}` };
    }
    try {
      const error = await shell.openPath(filePath);
      if (error) {
        logger.error('[shell:openPath] failed', { filePath, error });
        return { success: false, error };
      }
      return { success: true };
    } catch (error) {
      const err = error as Error;
      logger.error('[shell:openPath] threw', { filePath, error: err.message });
      return { success: false, error: err.message };
    }
  });
}