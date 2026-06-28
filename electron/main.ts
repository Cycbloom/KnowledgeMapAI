import { app, BrowserWindow, shell, crashReporter, ipcMain } from "electron";
import * as path from "path";
import { fileURLToPath } from "url";
import * as http from "http";
import * as fs from "fs";
import pkg from "electron-updater";
const { autoUpdater } = pkg;
import dotenv from "dotenv";
import { DatabaseManager } from "./db/database";
import { registerDbIpcHandlers } from "./ipc/dbHandlers";
import { SyncEngine } from "./sync/syncEngine";
import { logger } from "./utils/logger";

/** Minimal contract for the loaded API Express application. */
interface ApiApp {
  (req: unknown, res: unknown): void;
}

/** Minimal contract for the API kernel (lifecycle management). */
interface ApiKernel {
  activateAll(): Promise<void>;
  deactivateAll(): Promise<void>;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// IPC channel whitelist for security validation
const IPC_HANDLE_CHANNELS = new Set([
  "app:getVersion",
  "app:getPlatform",
  "app:quit",
  "window:minimize",
  "window:maximize",
  "window:close",
  "api:getPort",
  "update:check",
  "update:install",
  "config:read",
  "config:write",
  "db:query",
  "db:batch",
  "db:getStatus",
  "sync:getStatus",
  "sync:trigger",
  "sync:pause",
  "sync:resume",
  "sync:setAuthToken",
  "sync:fullSync",
  "shell:openExternal",
]);

// Wrap ipcMain.handle to validate channels against whitelist
const originalHandle = ipcMain.handle.bind(ipcMain);
type IpcHandleListener = (
  event: Electron.IpcMainInvokeEvent,
  ...args: unknown[]
) => unknown | Promise<unknown>;
ipcMain.handle = ((channel: string, handler: IpcHandleListener) => {
  return originalHandle(channel, (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => {
    if (!IPC_HANDLE_CHANNELS.has(channel)) {
      logger.warn(`[Security] Rejected IPC handle call to unregistered channel: ${channel}`);
      throw new Error(`IPC channel not allowed: ${channel}`);
    }
    return handler(event, ...args);
  });
}) as typeof ipcMain.handle;

// Note: ipcMain.on wrapper is intentionally omitted because all current IPC
// communication uses ipcMain.handle (request-response). Main→Renderer events
// use webContents.send() which is not interceptable via ipcMain wrappers.
// If ipcMain.on is needed in the future, add a similar whitelist wrapper.

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
    logger.info("[Main] 尝试加载环境变量文件", envPath);
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
          logger.info("[Main] 从用户配置文件加载数据库配置");
        }
      } catch (e) {
        logger.warn("[Main] 读取用户配置文件失败", e);
      }
    }

    logger.info("[Main] 环境变量加载结果");
    logger.info(`  VITE_SUPABASE_URL: ${process.env.VITE_SUPABASE_URL ? '已加载' : '未找到'}`);
    logger.info(`  SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '已加载' : '未找到'}`);
  } catch (err) {
    logger.warn("[Main] 加载环境变量文件失败", err);
  }
}

loadEnvVariables();

let apiApp: ApiApp | null = null;
let apiKernel: ApiKernel | null = null;
let dbManager: DatabaseManager | null = null;
let syncEngine: SyncEngine | null = null;

async function loadApiApp() {
  if (app.isPackaged) {
    try {
      const module = await import(path.join(process.resourcesPath, "api", "app.js")) as {
        default?: ApiApp;
        kernel?: ApiKernel;
      };
      apiApp = module.default ?? (module as unknown as ApiApp);
      apiKernel = module.kernel ?? null;
    } catch (error) {
      try {
        const module = await import(path.join(__dirname, "api", "app.js")) as {
          default?: ApiApp;
          kernel?: ApiKernel;
        };
        apiApp = module.default ?? (module as unknown as ApiApp);
        apiKernel = module.kernel ?? null;
      } catch (error2) {
        try {
          const module = await import("../api/app.js") as {
            default?: ApiApp;
            kernel?: ApiKernel;
          };
          apiApp = module.default ?? (module as unknown as ApiApp);
          apiKernel = module.kernel ?? null;
        } catch (error3) {
          logger.error("[Main] 所有 API 应用加载路径都失败", {
            errors: [error, error2, error3].map((e) =>
              e instanceof Error ? { message: e.message, stack: e.stack } : e,
            ),
          });
          throw error3;
        }
      }
    }
  } else {
    const module = await import("../api/app.js") as {
      default?: ApiApp;
      kernel?: ApiKernel;
    };
    apiApp = module.default ?? (module as unknown as ApiApp);
    apiKernel = module.kernel ?? null;
  }
  logger.info("[Main] API 应用加载成功");

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
    logger.info(`[Main] 迁移服务已配置，路径: ${migrationsPath}`);
  } catch (error) {
    logger.warn("[Main] 迁移服务配置失败", error);
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

  const appInstance = apiApp;
  if (!appInstance) {
    throw new Error("[Main] API 应用加载失败，无法启动服务器");
  }

  return new Promise((resolve, reject) => {
    const server = http.createServer(appInstance as Parameters<typeof http.createServer>[0]);
    
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
          logger.info(`[API] 端口 ${port} 已被占用，尝试另一个随机端口`);
          tryPort(getRandomPort());
        } else {
          reject(err);
        }
      });

      server.once("listening", () => {
        apiServer = server;
        apiPort = port;
        logger.info(`[API] 服务器已启动，端口: ${port}`);
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
        logger.info("[API] 服务器已关闭");
        apiServer = null;
        apiPort = 0;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

async function initializeLocalDatabase(): Promise<DatabaseManager | null> {
  try {
    const dbPath = path.join(app.getPath('userData'), 'knowledgemap.db');
    logger.info('[Main] 初始化本地 SQLite 数据库', dbPath);

    dbManager = new DatabaseManager(dbPath);
    dbManager.initialize();

    // Register IPC handlers for database access
    registerDbIpcHandlers(dbManager);

    // Initialize sync engine
    syncEngine = new SyncEngine(dbManager, mainWindow);
    syncEngine.registerIpcHandlers();

    logger.info('[Main] 本地数据库和同步引擎初始化成功');
    return dbManager;
  } catch (error) {
    logger.error('[Main] 本地数据库初始化失败，将降级到 HTTP 模式', error);
    dbManager = null;
    syncEngine = null;
    return null;
  }
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
      sandbox: true,
      webSecurity: true,
    },
    title: "KnowledgeMap",
    show: false,
    backgroundColor: "#1a1a2e",
    icon: getResourcePath("public", "favicon.svg"),
  });

  if (syncEngine) {
    syncEngine.setMainWindow(mainWindow);
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (VITE_DEV_SERVER_URL) {
    logger.info(`[Main] 加载开发服务器: ${VITE_DEV_SERVER_URL}`);
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    let indexPath: string;
    if (app.isPackaged) {
      indexPath = path.join(app.getAppPath(), "dist", "index.html");
    } else {
      indexPath = path.join(__dirname, "..", "dist", "index.html");
    }

    logger.info(`[Main] 尝试加载文件: ${indexPath}`);
    logger.info(`[Main] app.getAppPath(): ${app.getAppPath()}`);
    logger.info(`[Main] process.resourcesPath: ${process.resourcesPath}`);
    logger.info(`[Main] __dirname: ${__dirname}`);
    logger.info(`[Main] app.isPackaged: ${app.isPackaged}`);

    mainWindow?.loadFile(indexPath).catch((err) => {
      logger.error("Failed to load index.html", err);
      logger.error("Error details", {
        indexPath,
        appPath: app.getAppPath(),
        resourcesPath: process.resourcesPath,
        dirname: __dirname,
      });
    });
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (syncEngine) {
      syncEngine.setMainWindow(null);
    }
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

  (
    app as unknown as {
      on(
        event: "render-process-crashed",
        listener: (
          event: Electron.Event,
          webContents: Electron.WebContents,
          killed: boolean,
        ) => void,
      ): void;
    }
  ).on(
    "render-process-crashed",
    (
      _event: Electron.Event,
      webContents: Electron.WebContents,
      killed: boolean,
    ) => {
      logger.error("[Main] 渲染进程崩溃", {
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
    logger.error("[Main] 未捕获的异常", error);
  });

  process.on("unhandledRejection", (reason, promise) => {
    logger.error("[Main] 未处理的 Promise 拒绝", {
      reason,
      promise,
    });
  });
}

app.whenReady().then(async () => {
  configureCrashReporter();

  // Initialize local SQLite database (before API server)
  await initializeLocalDatabase();

  if (app.isPackaged && !VITE_DEV_SERVER_URL) {
    try {
      const port = await startApiServer();
      logger.info(`[Main] API 服务器已启动，端口: ${port}`);
      // Set API port for sync engine
      if (syncEngine) {
        syncEngine.setApiPort(port);
      }
      // Activate all plugins after server starts
      if (apiKernel) {
        try {
          await apiKernel.activateAll();
          logger.info("[Main] 所有插件已激活");
        } catch (error) {
          logger.error("[Main] 插件激活失败", error);
        }
      }
    } catch (error) {
      logger.error("[Main] 启动 API 服务器失败", error);
    }
  }

  await createWindow();
  configureAutoUpdater();

  // Start sync engine in packaged mode
  if (app.isPackaged && syncEngine) {
    syncEngine.start();
  }

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
  if (apiKernel) {
    try {
      await apiKernel.deactivateAll();
      logger.info('[Main] 所有插件已停用');
    } catch (error) {
      logger.error('[Main] 插件停用失败', error);
    }
  }
  if (syncEngine) {
    syncEngine.stop();
    logger.info('[Main] 同步引擎已停止');
  }
  await stopApiServer();
  if (dbManager) {
    dbManager.close();
    logger.info('[Main] 本地数据库已关闭');
  }
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

ipcMain.handle("shell:openExternal", async (_event, url: string) => {
  if (typeof url !== "string") {
    return { success: false, error: "Invalid URL type" };
  }
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return { success: false, error: "Only http:// and https:// URLs are allowed" };
  }
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    const err = error as Error;
    return { success: false, error: err.message };
  }
});

function configureAutoUpdater(): void {
  if (!app.isPackaged) {
    logger.info(
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
    logger.info("[AutoUpdater] 检查更新中...");
    mainWindow?.webContents.send("update:checking");
  });

  autoUpdater.on("update-available", (info) => {
    logger.info("[AutoUpdater] 发现新版本", info);
    mainWindow?.webContents.send("update:available", info);
  });

  autoUpdater.on("update-not-available", () => {
    logger.info("[AutoUpdater] 当前已是最新版本");
    mainWindow?.webContents.send("update:not-available");
  });

  autoUpdater.on("error", (error) => {
    logger.error("[AutoUpdater] 更新错误", error);
    mainWindow?.webContents.send("update:error", { error: error.message });
  });

  autoUpdater.on("download-progress", (progress) => {
    const progressInfo = {
      percent: Math.round(progress.percent),
      speed: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    };
    logger.info("[AutoUpdater] 下载进度", progressInfo);
    mainWindow?.webContents.send("update:download-progress", progressInfo);
  });

  autoUpdater.on("update-downloaded", (info) => {
    logger.info("[AutoUpdater] 更新已下载完成", info);
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
