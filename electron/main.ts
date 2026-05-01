import { app, BrowserWindow, shell, crashReporter, ipcMain } from "electron";
import * as path from "path";
import { fileURLToPath } from "url";
import * as http from "http";
import * as fs from "fs";
import pkg from "electron-updater";
const { autoUpdater } = pkg;
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvVariables() {
  try {
    let envPath;
    if (app.isPackaged) {
      envPath = path.join(process.resourcesPath, ".env.production");
    } else {
      const devEnvPath = path.join(__dirname, "..", "..", ".env.development");
      const defaultEnvPath = path.join(__dirname, "..", "..", ".env");
      
      if (fs.existsSync(devEnvPath)) {
        envPath = devEnvPath;
      } else if (fs.existsSync(defaultEnvPath)) {
        envPath = defaultEnvPath;
      } else {
        envPath = devEnvPath;
      }
    }
    console.log("[Main] 尝试加载环境变量文件:", envPath);
    dotenv.config({ path: envPath });

    const configPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (userConfig.database) {
          if (userConfig.database.url) process.env.VITE_SUPABASE_URL = userConfig.database.url;
          if (userConfig.database.anonKey) process.env.VITE_SUPABASE_ANON_KEY = userConfig.database.anonKey;
          if (userConfig.database.serviceRoleKey) process.env.SUPABASE_SERVICE_ROLE_KEY = userConfig.database.serviceRoleKey;
          if (userConfig.database.databaseUrl) process.env.DATABASE_URL = userConfig.database.databaseUrl;
          console.log("[Main] 从用户配置文件加载数据库配置");
        }
      } catch (e) {
        console.warn("[Main] 读取用户配置文件失败:", e);
      }
    }
    
    console.log("[Main] 环境变量加载结果:");
    console.log(`  VITE_SUPABASE_URL: ${process.env.VITE_SUPABASE_URL ? '已加载' : '未找到'}`);
    console.log(`  SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '已加载' : '未找到'}`);
  } catch (err) {
    console.warn("[Main] 加载环境变量文件失败:", err);
  }
}

loadEnvVariables();

let apiApp: any = null;

async function loadApiApp() {
  if (app.isPackaged) {
    try {
      const module = await import(path.join(process.resourcesPath, "api", "app.js"));
      apiApp = module.default || module;
    } catch (error) {
      try {
        const module = await import(path.join(__dirname, "api", "app.js"));
        apiApp = module.default || module;
      } catch (error2) {
        try {
          const module = await import("../api/app.js");
          apiApp = module.default || module;
        } catch (error3) {
          console.error("[Main] 所有 API 应用加载路径都失败:", error, error2, error3);
          throw error3;
        }
      }
    }
  } else {
    const module = await import("../api/app.js");
    apiApp = module.default || module;
  }
  console.log("[Main] API 应用加载成功");

  try {
    const isPackaged = app.isPackaged;
    const migrationServicePath = isPackaged
      ? path.join(process.resourcesPath, "api", "services", "migration", "migrationService.js")
      : "../api/services/migration/migrationService.js";
    const { migrationService } = await import(migrationServicePath);
    const migrationsPath = isPackaged
      ? path.join(process.resourcesPath, "migrations")
      : path.join(__dirname, "..", "supabase", "migrations");
    migrationService.setMigrationsPath(migrationsPath);
    console.log(`[Main] 迁移服务已配置，路径: ${migrationsPath}`);
  } catch (error) {
    console.warn("[Main] 迁移服务配置失败:", error);
  }
}

let mainWindow: BrowserWindow | null = null;
let apiServer: http.Server | null = null;
let apiPort: number = 0;

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

async function startApiServer(): Promise<number> {
  if (!apiApp) {
    await loadApiApp();
  }
  
  return new Promise((resolve, reject) => {
    const server = http.createServer(apiApp);
    
    const getRandomPort = (): number => {
      return 30000 + Math.floor(Math.random() * 30000);
    };
    
    let attempts = 0;
    const maxAttempts = 100;
    
    const tryPort = (port: number): void => {
      attempts++;
      if (attempts > maxAttempts) {
        reject(new Error(`尝试了 ${maxAttempts} 个端口都无法启动 API 服务器`));
        return;
      }
      
      server.once("error", (err: NodeJS.ErrnoException) => {
        if (err.code === "EADDRINUSE") {
          console.log(`[API] 端口 ${port} 已被占用，尝试另一个随机端口`);
          tryPort(getRandomPort());
        } else {
          reject(err);
        }
      });
      
      server.once("listening", () => {
        apiServer = server;
        apiPort = port;
        console.log(`[API] 服务器已启动，端口: ${port}`);
        resolve(port);
      });
      
      server.listen(port);
    };
    
    tryPort(getRandomPort());
  });
}

async function stopApiServer(): Promise<void> {
  return new Promise((resolve) => {
    if (apiServer) {
      apiServer.close(() => {
        console.log("[API] 服务器已关闭");
        apiServer = null;
        apiPort = 0;
        resolve();
      });
    } else {
      resolve();
    }
  });
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
  
  if (app.isPackaged && !VITE_DEV_SERVER_URL) {
    try {
      const port = await startApiServer();
      console.log(`[Main] API 服务器已启动，端口: ${port}`);
    } catch (error) {
      console.error("[Main] 启动 API 服务器失败:", error);
    }
  }
  
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

app.on("will-quit", async () => {
  await stopApiServer();
});

ipcMain.handle("app:getVersion", () => {
  return app.getVersion();
});

ipcMain.handle("app:getPlatform", () => {
  return process.platform;
});

ipcMain.handle("api:getPort", () => {
  return apiPort;
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

ipcMain.handle("config:read", async () => {
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

ipcMain.handle("config:write", async (_event, data: Record<string, unknown>) => {
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
