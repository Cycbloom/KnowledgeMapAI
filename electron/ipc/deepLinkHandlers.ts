import { BrowserWindow } from 'electron';
import { logger } from '../utils/logger';

export interface DeepLinkDeps {
  /** Returns the current main window (may be null before window created). */
  getMainWindow: () => BrowserWindow | null;
}

/**
 * 推送一个 deep link URL 到 renderer。
 * Renderer 监听 "deepLink:open-url" channel。
 */
export function emitDeepLink(deps: DeepLinkDeps, url: string): void {
  if (typeof url !== 'string' || !url.startsWith('knowledgemap://')) {
    logger.warn('emitDeepLink: invalid url', { url });
    return;
  }
  const mainWindow = deps.getMainWindow();
  if (!mainWindow) {
    logger.warn('emitDeepLink: mainWindow not yet ready');
    return;
  }
  mainWindow.webContents.send('deepLink:open-url', { url, timestamp: Date.now() });
  logger.info('emitDeepLink: forwarded', { url });
}

/**
 * 推送一个文件路径（来自文件关联）到 renderer。
 * Renderer 监听 "fileAssociation:open-file" channel。
 */
export function emitFileOpen(deps: DeepLinkDeps, filePath: string): void {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    logger.warn('emitFileOpen: invalid filePath', { filePath });
    return;
  }
  const mainWindow = deps.getMainWindow();
  if (!mainWindow) {
    logger.warn('emitFileOpen: mainWindow not yet ready');
    return;
  }
  mainWindow.webContents.send('fileAssociation:open-file', {
    path: filePath,
    timestamp: Date.now(),
  });
  logger.info('emitFileOpen: forwarded', { path: filePath });
}

/**
 * 从 argv 中解析 knowledgemap:// URL 和 .km 文件路径。
 * 返回找到的第一个 URL 和第一个文件路径（可能都为 undefined）。
 */
export function parseArgv(argv: string[]): { url?: string; filePath?: string } {
  let url: string | undefined;
  let filePath: string | undefined;

  for (const item of argv) {
    if (typeof item !== 'string') {
      continue;
    }
    // 解析 knowledgemap:// URL（兼容 Windows argv 中 --knowledgemap:// 前缀）
    if (
      !url &&
      (item.startsWith('knowledgemap://') || item.startsWith('--knowledgemap://'))
    ) {
      url = item.startsWith('--') ? item.slice(2) : item;
      continue;
    }
    // 解析 .km 文件路径（忽略大小写）
    if (!filePath && item.toLowerCase().endsWith('.km')) {
      filePath = item;
      continue;
    }
  }

  return { url, filePath };
}
