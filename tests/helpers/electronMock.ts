/**
 * Electron main process API mock for unit/integration tests.
 *
 * Provides a type-safe, comprehensive mock of the `electron` module so that
 * IPC handlers, window management, and other Electron-dependent code can be
 * tested in isolation without launching a real Electron process.
 *
 * Usage (in a test file):
 *   import { createElectronMock, mockElectron, callIpcHandler } from '../helpers/electronMock';
 *
 *   // Option A: apply globally via vi.mock (call before importing electron deps)
 *   const mock = mockElectron();
 *   import { registerAppHandlers } from '../../electron/ipc/appHandlers';
 *
 *   // Option B: create a mock object for manual injection
 *   const mock = createElectronMock();
 *
 *   // Test an IPC handler in isolation
 *   const handlers = new Map([['app:getVersion', (_e: unknown) => '1.0.0']]);
 *   const result = await callIpcHandler(handlers, 'app:getVersion', {});
 *
 * Discovered IPC channels (all use ipcMain.handle):
 *   app:getVersion, app:getPlatform, app:quit, api:getPort,
 *   window:minimize, window:maximize, window:close,
 *   update:check, update:install, update:confirm-download, update:install-confirmed,
 *   config:read, config:write,
 *   db:query, db:batch, db:getStatus,
 *   sync:getStatus, sync:trigger, sync:pause, sync:resume,
 *   sync:setAuthToken, sync:fullSync,
 *   shell:openExternal
 */
import { vi } from 'vitest';

/** IPC handler function signature. */
export type IpcHandler = (...args: unknown[]) => unknown | Promise<unknown>;

/**
 * Creates a comprehensive mock of the `electron` module.
 *
 * All methods are `vi.fn()` instances so tests can assert calls, override
 * return values, and inspect call arguments.
 *
 * @returns Mock object shaped like the `electron` module
 */
export function createElectronMock() {
  const ipcMain = {
    handle: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
    removeHandler: vi.fn(),
  };

  const ipcRenderer = {
    send: vi.fn(),
    invoke: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    removeListener: vi.fn(),
    removeAllListeners: vi.fn(),
    postMessage: vi.fn(),
  };

  const app = {
    getPath: vi.fn((name: string) => `/tmp/electron-mock/${name}`),
    getName: vi.fn(() => 'KnowledgeMap'),
    getVersion: vi.fn(() => '0.0.0-test'),
    isReady: vi.fn(() => true),
    whenReady: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    quit: vi.fn(),
    exit: vi.fn(),
    relaunch: vi.fn(),
    getAppPath: vi.fn(() => '/tmp/electron-mock/app'),
    getPathSafe: vi.fn((name: string) => `/tmp/electron-mock/${name}`),
    isPackaged: false as boolean,
    setAppUserModelId: vi.fn(),
    requestSingleInstanceLock: vi.fn(() => true),
    hasSingleInstanceLock: vi.fn(() => true),
    releaseSingleInstance: vi.fn(),
    allowRendererProcessReuse: vi.fn(),
  };

  // BrowserWindow is a constructor mock — `new BrowserWindow(opts)` returns
  // a fresh window object with its own set of vi.fn mocks.
  const BrowserWindow = Object.assign(
    vi.fn().mockImplementation(() => ({
      loadURL: vi.fn(() => Promise.resolve()),
      loadFile: vi.fn(() => Promise.resolve()),
      webContents: {
        send: vi.fn(),
        on: vi.fn(),
        once: vi.fn(),
        off: vi.fn(),
        openDevTools: vi.fn(),
        closeDevTools: vi.fn(),
        reload: vi.fn(),
        goBack: vi.fn(),
        goForward: vi.fn(),
        getURL: vi.fn(() => 'about:blank'),
        setWindowOpenHandler: vi.fn(),
        downloadURL: vi.fn(),
        executeJavaScript: vi.fn(() => Promise.resolve()),
        inspectElement: vi.fn(),
      },
      on: vi.fn(),
      once: vi.fn(),
      off: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      showInactive: vi.fn(),
      focus: vi.fn(),
      blur: vi.fn(),
      isFocused: vi.fn(() => true),
      isVisible: vi.fn(() => true),
      isDestroyed: vi.fn(() => false),
      isMaximized: vi.fn(() => false),
      isMinimized: vi.fn(() => false),
      isFullScreen: vi.fn(() => false),
      minimize: vi.fn(),
      maximize: vi.fn(),
      unmaximize: vi.fn(),
      setFullScreen: vi.fn(),
      close: vi.fn(),
      destroy: vi.fn(),
      setBounds: vi.fn(),
      getBounds: vi.fn(() => ({ x: 0, y: 0, width: 1400, height: 900 })),
      setSize: vi.fn(),
      getSize: vi.fn(() => [1400, 900]),
      setPosition: vi.fn(),
      getPosition: vi.fn(() => [0, 0]),
      setTitle: vi.fn(),
      getTitle: vi.fn(() => 'KnowledgeMap'),
      setMenuBarVisibility: vi.fn(),
      setAutoHideMenuBar: vi.fn(),
    })),
    {
      getAllWindows: vi.fn(() => []),
      fromWebContents: vi.fn(() => null),
      getFocusedWindow: vi.fn(() => null),
      addDevToolsExtension: vi.fn(),
      removeDevToolsExtension: vi.fn(),
    },
  );

  const dialog = {
    showOpenDialog: vi.fn(() => Promise.resolve({ canceled: true, filePaths: [] })),
    showOpenDialogSync: vi.fn(() => []),
    showSaveDialog: vi.fn(() => Promise.resolve({ canceled: true, filePath: '' })),
    showSaveDialogSync: vi.fn(() => ''),
    showMessageBox: vi.fn(() => Promise.resolve({ response: 0, checkboxChecked: false })),
    showMessageBoxSync: vi.fn(() => 0),
    showErrorBox: vi.fn(),
    showCertificateTrustDialog: vi.fn(() => Promise.resolve()),
  };

  const clipboard = {
    readText: vi.fn(() => ''),
    writeText: vi.fn(),
    readImage: vi.fn(() => ({ isEmpty: () => true })),
    writeImage: vi.fn(),
    readHTML: vi.fn(() => ''),
    writeHTML: vi.fn(),
    readRTF: vi.fn(() => ''),
    writeRTF: vi.fn(),
    readBookmark: vi.fn(() => null),
    writeBookmark: vi.fn(),
    clear: vi.fn(),
    availableFormats: vi.fn(() => []),
    has: vi.fn(() => false),
  };

  const shell = {
    openExternal: vi.fn(() => Promise.resolve()),
    openExternalSync: vi.fn(),
    showItemInFolder: vi.fn(),
    openPath: vi.fn(() => Promise.resolve('')),
    trashItem: vi.fn(() => Promise.resolve()),
    beep: vi.fn(),
    writeShortcutLink: vi.fn(),
    readShortcutLink: vi.fn(() => ({})),
  };

  const menu = {
    buildFromTemplate: vi.fn(() => ({})),
    setApplicationMenu: vi.fn(),
    getApplicationMenu: vi.fn(() => null),
    sendActionToFirstResponder: vi.fn(),
  };

  const contextBridge = {
    exposeInMainWorld: vi.fn(),
  };

  const crashReporter = {
    start: vi.fn(),
    getLastCrashReport: vi.fn(() => null),
    getUploadedReports: vi.fn(() => []),
    getCrashesDirectory: vi.fn(() => '/tmp/electron-mock/crashes'),
    uploadToServer: true as boolean,
    startRemoteCrashReporter: vi.fn(),
  };

  const nativeImage = {
    createEmpty: vi.fn(() => ({ isEmpty: () => true })),
    createFromPath: vi.fn(() => ({ isEmpty: () => true })),
    createFromBuffer: vi.fn(() => ({ isEmpty: () => true })),
    createFromDataURL: vi.fn(() => ({ isEmpty: () => true })),
  };

  const session = {
    defaultSession: {
      cookies: {
        get: vi.fn(() => Promise.resolve([])),
        set: vi.fn(() => Promise.resolve()),
        remove: vi.fn(() => Promise.resolve()),
      },
      webRequest: {
        onBeforeRequest: vi.fn(),
        onBeforeSendHeaders: vi.fn(),
        onHeadersReceived: vi.fn(),
      },
      setPermissionRequestHandler: vi.fn(),
      setPermissionCheckHandler: vi.fn(),
      clearCache: vi.fn(() => Promise.resolve()),
      clearStorageData: vi.fn(() => Promise.resolve()),
      flushStorageData: vi.fn(),
    },
    fromPartition: vi.fn(() => session.defaultSession),
  };

  const powerMonitor = {
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
    getSystemIdleTime: vi.fn(() => 0),
    getSystemIdleState: vi.fn(() => 'active'),
  };

  const screen = {
    getPrimaryDisplay: vi.fn(() => ({
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      scaleFactor: 1,
    })),
    getAllDisplays: vi.fn(() => []),
    getDisplayMatching: vi.fn(() => ({
      workArea: { x: 0, y: 0, width: 1920, height: 1080 },
      bounds: { x: 0, y: 0, width: 1920, height: 1080 },
      scaleFactor: 1,
    })),
    getCursorScreenPoint: vi.fn(() => ({ x: 0, y: 0 })),
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    removeAllListeners: vi.fn(),
  };

  return {
    app,
    BrowserWindow,
    ipcMain,
    ipcRenderer,
    dialog,
    clipboard,
    shell,
    Menu: menu,
    contextBridge,
    crashReporter,
    nativeImage,
    session,
    powerMonitor,
    screen,
  };
}

/** Type of the mock object returned by `createElectronMock`. */
export type ElectronMock = ReturnType<typeof createElectronMock>;

/**
 * Applies the Electron mock globally via `vi.mock('electron', ...)`.
 *
 * Call this at the top of a test file (before any imports that touch
 * `electron`) to replace the `electron` module with the mock.
 *
 * @returns The mock object (same shape as `createElectronMock()`)
 *
 * @example
 *   // test file top
 *   import { mockElectron } from '../helpers/electronMock';
 *   const electronMock = mockElectron();
 *
 *   // Now `import { app } from 'electron'` returns `electronMock.app`
 *   import { registerAppHandlers } from '../../electron/ipc/appHandlers';
 *
 * Note: vi.mock is hoisted by vitest. To make the mock instance available to
 * the hoisted factory, we store it in a vi.hoisted holder. The factory reads
 * from the holder, and mockElectron() populates it on first call.
 *
 * IMPORTANT: mockElectron() returns the SAME mock instance that the vi.mock
 * factory returns. This ensures that modules importing 'electron' reference
 * the same mock object as the test file. Use vi.clearAllMocks() in
 * beforeEach/afterEach to reset mock state between tests.
 */
const electronMockHolder = vi.hoisted<{ instance: ElectronMock | null }>(
  () => ({ instance: null }),
);

vi.mock('electron', () => {
  // Factory runs lazily when 'electron' is first imported.
  // Create a default mock if mockElectron() hasn't been called yet.
  if (!electronMockHolder.instance) {
    electronMockHolder.instance = createElectronMock();
  }
  return electronMockHolder.instance;
});

export function mockElectron(): ElectronMock {
  // Return the existing mock (same instance as the vi.mock factory returns).
  // Creating a new mock here would break references in modules that already
  // imported 'electron' before this function was called.
  if (!electronMockHolder.instance) {
    electronMockHolder.instance = createElectronMock();
  }
  return electronMockHolder.instance;
}

/**
 * Helper to test an IPC handler in isolation.
 *
 * Given a map of channel → handler, looks up the handler for the given
 * channel and invokes it with the provided event and arguments.
 *
 * @param handlerMap - Map of channel name to handler function
 * @param channel   - The IPC channel to call
 * @param event     - The mock IpcMainInvokeEvent (or any event-like object)
 * @param args      - Additional arguments to pass to the handler
 * @returns The handler's return value
 *
 * @throws Error if no handler is registered for the channel
 *
 * @example
 *   const handlers = new Map<string, IpcHandler>([
 *     ['app:getVersion', (_e: unknown) => '1.0.0'],
 *   ]);
 *   const version = await callIpcHandler(handlers, 'app:getVersion', {});
 *   expect(version).toBe('1.0.0');
 */
export async function callIpcHandler(
  handlerMap: Map<string, IpcHandler>,
  channel: string,
  event: unknown,
  ...args: unknown[]
): Promise<unknown> {
  const handler = handlerMap.get(channel);
  if (!handler) {
    throw new Error(`No handler registered for channel: ${channel}`);
  }
  return handler(event, ...args);
}
