import { app, BrowserWindow, shell, crashReporter, ipcMain, Menu, session } from "electron";
import * as path from "path";
import { fileURLToPath } from "url";
import * as http from "http";
import * as fs from "fs";
import dotenv from "dotenv";
import { DatabaseManager } from "./db/database";
import { registerDbIpcHandlers } from "./ipc/dbHandlers";
import { registerAppHandlers } from "./ipc/appHandlers";
import { registerWindowHandlers } from "./ipc/windowHandlers";
import { registerShellHandlers } from "./ipc/shellHandlers";
import {
  registerUpdateHandlers,
  configureAutoUpdater,
} from "./ipc/updateHandlers";
import { registerConfigHandlers } from "./ipc/configHandlers";
import { registerSyncHandlers } from "./ipc/syncHandlers";
import { SyncEngine } from "./sync/syncEngine";
import { windowManager } from "./utils/windowManager";
import { trayManager } from "./utils/trayManager";
import { logger } from "./utils/logger";
import { buildAppMenu, MenuAction } from "./utils/appMenu";
import { loadWindowState, trackWindowState } from "./utils/windowStateManager";
import { emitDeepLink, emitFileOpen, parseArgv } from "./ipc/deepLinkHandlers";
import { registerPowerHandlers } from "./ipc/powerHandlers";
import { registerDialogHandlers } from "./ipc/dialogHandlers";
import { resetAllBlockers } from "./utils/powerManager";

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

// IPC channel whitelist for security validation.
// Keep in sync with the per-domain register*Handlers() calls below and with
// preload.ts (the renderer's view of the same channels).
const IPC_HANDLE_CHANNELS = new Set([
  // app domain
  "app:getVersion",
  "app:getPlatform",
  "app:quit",
  "api:getPort",
  // window domain
  "window:minimize",
  "window:maximize",
  "window:close",
  // update domain (Task 7 added confirm-download / install-confirmed)
  "update:check",
  "update:install",
  "update:confirm-download",
  "update:install-confirmed",
  // config domain
  "config:read",
  "config:write",
  // db domain (registered by dbHandlers.ts)
  "db:query",
  "db:batch",
  "db:getStatus",
  // sync domain
  "sync:getStatus",
  "sync:trigger",
  "sync:pause",
  "sync:resume",
  "sync:setAuthToken",
  "sync:fullSync",
  // shell domain
  "shell:openExternal",
  // power domain
  "power:startBlocker",
  "power:stopBlocker",
  "power:getActiveReasons",
  // dialog domain
  "dialog:showSaveDialog",
  "dialog:showOpenDialog",
  "dialog:showMessageBox",
  "dialog:showErrorBox",
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

    // Initialize sync engine (IPC handlers are registered centrally in
    // app.whenReady via registerSyncHandlers, not here).
    syncEngine = new SyncEngine(dbManager, mainWindow);

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
  // Task 6.2: delegate BrowserWindow construction to windowManager.
  // url/file are intentionally omitted so that the dev-server / packaged
  // load logic below stays in main.ts (it has richer error handling).
  // Task 9: restore persisted window bounds (position/size/maximized).
  const savedState = loadWindowState();
  const window = windowManager.createWindow({
    id: "main",
    options: {
      width: savedState?.width ?? 1400,
      height: savedState?.height ?? 900,
      x: savedState?.x,
      y: savedState?.y,
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
    },
  });

  if (savedState?.isMaximized) {
    window.maximize();
  }

  trackWindowState(window);

  mainWindow = window;

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

  // Task 15: 拦截非允许源的导航，防止 renderer 跳转到外部页面
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowedOrigins = [VITE_DEV_SERVER_URL, "file://"].filter(
      (origin): origin is string => typeof origin === "string" && origin.length > 0,
    );
    const isAllowed = allowedOrigins.some((origin) => url.startsWith(origin));
    if (!isAllowed) {
      logger.warn("[Security] Blocked navigation to", url);
      event.preventDefault();
    }
  });

  // Task 14: 右键上下文菜单（中文标签 + 编辑能力位）
  mainWindow.webContents.on("context-menu", (_event, params) => {
    const menu = Menu.buildFromTemplate([
      { label: "撤销", role: "undo", enabled: params.editFlags.canUndo },
      { label: "重做", role: "redo", enabled: params.editFlags.canRedo },
      { type: "separator" },
      { label: "剪切", role: "cut", enabled: params.editFlags.canCut },
      { label: "复制", role: "copy", enabled: params.editFlags.canCopy },
      { label: "粘贴", role: "paste", enabled: params.editFlags.canPaste },
      { type: "separator" },
      { label: "全选", role: "selectAll", enabled: params.editFlags.canSelectAll },
    ]);
    menu.popup({ window: mainWindow ?? undefined });
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

// 单实例锁：防止多实例并发写本地数据库
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  // macOS: open-url 事件必须在 app.whenReady() 之前注册
  app.on("open-url", (event, url) => {
    event.preventDefault();
    emitDeepLink({ getMainWindow: () => mainWindow }, url);
  });

  // macOS: open-file 事件必须在 app.whenReady() 之前注册
  app.on("open-file", (event, filePath) => {
    event.preventDefault();
    emitFileOpen({ getMainWindow: () => mainWindow }, filePath);
  });

  // Win/Linux: 第二实例启动时聚焦主窗口并转发 argv
  app.on("second-instance", (_event, argv, _workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    const { url, filePath } = parseArgv(argv);
    if (url) emitDeepLink({ getMainWindow: () => mainWindow }, url);
    if (filePath) emitFileOpen({ getMainWindow: () => mainWindow }, filePath);
  });

  app.whenReady().then(async () => {
    // Task 2: 注册深度链接协议
    app.setAsDefaultProtocolClient("knowledgemap");

    configureCrashReporter();

    // Task 7: About 面板
    app.setAboutPanelOptions({
      applicationName: "KnowledgeMap",
      applicationVersion: app.getVersion(),
      copyright: "Copyright © 2025 KnowledgeMap",
      credits: "Built with Electron, React, TypeScript",
      authors: ["KnowledgeMap Team"],
      website: "https://github.com/knowledgemap/knowledgemap-app",
      iconPath: getResourcePath("public", "favicon.svg"),
    });

    // Task 16: permission request handler — 仅允许剪贴板，其余拒绝
    session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
      const allowed = new Set(["clipboard-read", "clipboard-sanitized-write"]);
      if (allowed.has(permission)) {
        callback(true);
      } else {
        logger.warn(`[Security] Denied permission request: ${permission}`);
        callback(false);
      }
    });

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

    // Task 8.3: register per-domain IPC handlers centrally.
    // (db:* handlers are registered inside initializeLocalDatabase because
    // they require the DatabaseManager instance.)
    registerAppHandlers({ getPort: () => apiPort });
    registerWindowHandlers({ getMainWindow: () => mainWindow });
    registerShellHandlers();
    registerUpdateHandlers({ getMainWindow: () => mainWindow });
    registerConfigHandlers();
    registerSyncHandlers({ getSyncEngine: () => syncEngine });
    registerPowerHandlers();
    registerDialogHandlers({ getMainWindow: () => mainWindow });

    await createWindow();

    // Task 6.3: enable system tray. Wrapped in try/catch because the tray icon
    // (public/favicon.svg) may be missing or in a format Tray cannot load —
    // failure must not block app startup.
    if (mainWindow) {
      try {
        trayManager.initialize(mainWindow);
        logger.info("[Main] 系统托盘已初始化");
      } catch (error) {
        logger.warn("[Main] 系统托盘初始化失败（图标可能缺失或格式不支持）", error);
      }
    }

    // Task 6: 注册应用菜单
    const onMenuAction = (action: MenuAction): void => {
      switch (action) {
        case "preferences":
          mainWindow?.webContents.send("menu:action", { action: "preferences" });
          break;
        case "about":
          app.showAboutPanel();
          break;
        case "documentation":
          shell.openExternal("https://github.com/knowledgemap/knowledgemap-app#readme");
          break;
        case "reportIssue":
          shell.openExternal("https://github.com/knowledgemap/knowledgemap-app/issues/new");
          break;
        case "checkUpdates":
          // 触发自动更新检查（autoUpdater 由 updateHandlers 管理，这里通过 IPC 调用）
          mainWindow?.webContents.send("menu:action", { action: "checkUpdates" });
          break;
      }
    };

    Menu.setApplicationMenu(
      buildAppMenu({
        getMainWindow: () => mainWindow,
        onMenuAction,
      }),
    );

    // Task 7: auto-updater UX (autoDownload disabled; renderer confirms download
    // and install via update:confirm-download / update:install-confirmed).
    configureAutoUpdater({ getMainWindow: () => mainWindow });

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
    resetAllBlockers();
    logger.info("[Main] 所有电源阻塞器已清理");
    await stopApiServer();
    if (dbManager) {
      dbManager.close();
      logger.info('[Main] 本地数据库已关闭');
    }
  });
}
