import { app, BrowserWindow, shell, crashReporter, ipcMain } from "electron";
import * as path from "path";
import { fileURLToPath } from "url";
import pkg from "electron-updater";
const { autoUpdater } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function getResourcePath(...paths: string[]): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...paths);
  }
  return path.join(__dirname, "..", ...paths);
}

function getDistPath(...paths: string[]): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, ...paths);
  }
  return path.join(__dirname, "..", ...paths);
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
      preload: path.join(__dirname, "preload.js"),
      sandbox: false,
      webSecurity: true,
    },
    title: "KnowledgeMap",
    show: false,
    backgroundColor: "#1a1a2e",
    icon: getResourcePath("public", "favicon.svg"),
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (VITE_DEV_SERVER_URL) {
    console.log(`[Main] 加载开发服务器: ${VITE_DEV_SERVER_URL}`);
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    let indexPath: string;
    if (app.isPackaged) {
      indexPath = path.join(app.getAppPath(), "dist", "index.html");
    } else {
      indexPath = path.join(__dirname, "..", "dist", "index.html");
    }

    console.log(`[Main] 尝试加载文件: ${indexPath}`);
    console.log(`[Main] app.getAppPath(): ${app.getAppPath()}`);
    console.log(`[Main] process.resourcesPath: ${process.resourcesPath}`);
    console.log(`[Main] __dirname: ${__dirname}`);
    console.log(`[Main] app.isPackaged: ${app.isPackaged}`);

    mainWindow?.loadFile(indexPath).catch((err) => {
      console.error("Failed to load index.html:", err);
      console.error("Error details:", {
        indexPath,
        appPath: app.getAppPath(),
        resourcesPath: process.resourcesPath,
        dirname: __dirname,
      });
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function configureCrashReporter(): void {
  crashReporter.start({
    productName: "KnowledgeMap",
    companyName: "KnowledgeMap Team",
    submitURL: "https://crash-reports.knowledgemap.app/submit",
    uploadToServer: true,
    extra: {
      appVersion: app.getVersion(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
    },
  });

  (app as any).on(
    "render-process-crashed",
    (event: any, webContents: any, killed: boolean) => {
      console.error("[Main] 渲染进程崩溃:", {
        killed,
        url: webContents.getURL(),
      });

      if (mainWindow) {
        mainWindow.webContents.send("crash:renderer", {
          killed,
          url: webContents.getURL(),
        });
      }
    },
  );

  process.on("uncaughtException", (error) => {
    console.error("[Main] 未捕获的异常:", error);
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("[Main] 未处理的 Promise 拒绝:", {
      reason,
      promise,
    });
  });
}

app.whenReady().then(async () => {
  configureCrashReporter();
  await createWindow();
  configureAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("app:getVersion", () => {
  return app.getVersion();
});

ipcMain.handle("app:getPlatform", () => {
  return process.platform;
});

ipcMain.handle("app:quit", () => {
  app.quit();
});

ipcMain.handle("window:minimize", () => {
  mainWindow?.minimize();
});

ipcMain.handle("window:maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle("window:close", () => {
  mainWindow?.close();
});

function configureAutoUpdater(): void {
  if (!app.isPackaged) {
    console.log(
      "[AutoUpdater] Skipping auto updater configuration in development mode",
    );
    return;
  }

  autoUpdater.setFeedURL({
    provider: "github",
    owner: "knowledgemap",
    repo: "knowledgemap-app",
    releaseType: "release",
  });

  autoUpdater.autoDownload = true;

  autoUpdater.on("checking-for-update", () => {
    console.log("[AutoUpdater] 检查更新中...");
    mainWindow?.webContents.send("update:checking");
  });

  autoUpdater.on("update-available", (info) => {
    console.log("[AutoUpdater] 发现新版本:", info.version);
    mainWindow?.webContents.send("update:available", info);
  });

  autoUpdater.on("update-not-available", () => {
    console.log("[AutoUpdater] 当前已是最新版本");
    mainWindow?.webContents.send("update:not-available");
  });

  autoUpdater.on("error", (error) => {
    console.error("[AutoUpdater] 更新错误:", error);
    mainWindow?.webContents.send("update:error", { error: error.message });
  });

  autoUpdater.on("download-progress", (progress) => {
    const progressInfo = {
      percent: Math.round(progress.percent),
      speed: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    };
    console.log("[AutoUpdater] 下载进度:", progressInfo);
    mainWindow?.webContents.send("update:download-progress", progressInfo);
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log("[AutoUpdater] 更新已下载完成:", info.version);
    mainWindow?.webContents.send("update:downloaded", info);

    setTimeout(() => {
      autoUpdater.quitAndInstall();
    }, 2000);
  });

  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, 5000);
  }
}

ipcMain.handle("update:check", () => {
  if (app.isPackaged) {
    autoUpdater.checkForUpdates();
    return { success: true, message: "开始检查更新" };
  } else {
    return { success: false, message: "开发模式下不检查更新" };
  }
});

ipcMain.handle("update:install", () => {
  autoUpdater.quitAndInstall();
  return { success: true };
});
