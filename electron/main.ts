import { app, BrowserWindow, ipcMain, shell, crashReporter } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { autoUpdater } from 'electron-updater';
import { serverService } from './services/serverService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;
let serverPort: number = 3001;

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function getResourcePath(...paths: string[]): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...paths);
  }
  return path.join(__dirname, '..', ...paths);
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      webSecurity: true,
    },
    title: 'KnowledgeMap',
    show: false,
    backgroundColor: '#1a1a2e',
    icon: getResourcePath('public', 'favicon.svg'),
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    const serverUrl = `http://localhost:${serverPort}`;
    mainWindow.loadURL(serverUrl).catch(() => {
      const distPath = getResourcePath('dist', 'index.html');
      mainWindow?.loadFile(distPath).catch((err) => {
        console.error('Failed to load index.html:', err);
      });
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function startServer(): Promise<void> {
  console.log('[Main] Starting local server...');
  
  const status = await serverService.start();
  
  if (status.isRunning && status.port) {
    serverPort = status.port;
    console.log(`[Main] Local server started on port ${serverPort}`);
    
    if (mainWindow) {
      mainWindow.webContents.send('server:started', { port: serverPort });
    }
  } else {
    console.error('[Main] Failed to start local server:', status.error);
    
    if (mainWindow) {
      mainWindow.webContents.send('server:error', { error: status.error });
    }
  }
}

async function stopServer(): Promise<void> {
  console.log('[Main] Stopping local server...');
  await serverService.stop();
  console.log('[Main] Local server stopped');
}

function configureCrashReporter(): void {
  // 配置崩溃报告
  crashReporter.start({
    productName: 'KnowledgeMap',
    companyName: 'KnowledgeMap Team',
    submitURL: 'https://crash-reports.knowledgemap.app/submit', // 实际使用时需要替换为真实的 URL
    uploadToServer: true,
    extra: {
      appVersion: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version
    }
  });

  // 监听崩溃事件
  (app as any).on('render-process-crashed', (event: any, webContents: any, killed: boolean) => {
    console.error('[Main] 渲染进程崩溃:', {
      killed,
      url: webContents.getURL()
    });
    
    // 可以在这里添加额外的处理逻辑，如显示错误提示等
    if (mainWindow) {
      mainWindow.webContents.send('crash:renderer', {
        killed,
        url: webContents.getURL()
      });
    }
  });

  // 监听未捕获的异常
  process.on('uncaughtException', (error) => {
    console.error('[Main] 未捕获的异常:', error);
    // 可以在这里添加额外的处理逻辑
  });

  // 监听未处理的 Promise 拒绝
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Main] 未处理的 Promise 拒绝:', {
      reason,
      promise
    });
    // 可以在这里添加额外的处理逻辑
  });
}

app.whenReady().then(async () => {
  // 配置崩溃报告
  configureCrashReporter();

  if (!VITE_DEV_SERVER_URL) {
    await startServer();
  }
  
  await createWindow();

  // 配置自动更新
  configureAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  await stopServer();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await stopServer();
});

ipcMain.handle('app:getVersion', () => {
  return app.getVersion();
});

ipcMain.handle('app:getPlatform', () => {
  return process.platform;
});

ipcMain.handle('app:quit', () => {
  app.quit();
});

ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.close();
});

ipcMain.handle('server:start', async () => {
  const status = await serverService.start();
  if (status.port) {
    serverPort = status.port;
  }
  return status;
});

ipcMain.handle('server:stop', async () => {
  await serverService.stop();
  return { success: true };
});

ipcMain.handle('server:getStatus', () => {
  return serverService.getStatus();
});

ipcMain.handle('server:getPort', () => {
  return serverPort;
});

function configureAutoUpdater(): void {
  // 配置更新源
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'knowledgemap',
    repo: 'knowledgemap-app',
    releaseType: 'release'
  });

  // 启用自动下载更新
  autoUpdater.autoDownload = true;

  // 监听更新事件
  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] 检查更新中...');
    mainWindow?.webContents.send('update:checking');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[AutoUpdater] 发现新版本:', info.version);
    mainWindow?.webContents.send('update:available', info);
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] 当前已是最新版本');
    mainWindow?.webContents.send('update:not-available');
  });

  autoUpdater.on('error', (error) => {
    console.error('[AutoUpdater] 更新错误:', error);
    mainWindow?.webContents.send('update:error', { error: error.message });
  });

  autoUpdater.on('download-progress', (progress) => {
    const progressInfo = {
      percent: Math.round(progress.percent),
      speed: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total
    };
    console.log('[AutoUpdater] 下载进度:', progressInfo);
    mainWindow?.webContents.send('update:download-progress', progressInfo);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[AutoUpdater] 更新已下载完成:', info.version);
    mainWindow?.webContents.send('update:downloaded', info);

    // 提示用户安装更新
    setTimeout(() => {
      autoUpdater.quitAndInstall();
    }, 2000);
  });

  // 应用启动时检查更新
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, 5000);
  }
}

// 手动检查更新
ipcMain.handle('update:check', () => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdates();
    return { success: true, message: '开始检查更新' };
  } else {
    return { success: false, message: '开发模式下不检查更新' };
  }
});

// 手动安装更新
ipcMain.handle('update:install', () => {
  autoUpdater.quitAndInstall();
  return { success: true };
});
