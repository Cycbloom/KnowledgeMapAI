import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
    quit: () => ipcRenderer.invoke('app:quit'),
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
    delete: (key: string) => ipcRenderer.invoke('store:delete', key),
  },
  database: {
    query: (sql: string, params?: unknown[]) => ipcRenderer.invoke('database:query', sql, params),
    execute: (sql: string, params?: unknown[]) => ipcRenderer.invoke('database:execute', sql, params),
  },
  sync: {
    start: () => ipcRenderer.invoke('sync:start'),
    stop: () => ipcRenderer.invoke('sync:stop'),
    getStatus: () => ipcRenderer.invoke('sync:getStatus'),
  },
  backup: {
    create: (options?: { path?: string }) => ipcRenderer.invoke('backup:create', options),
    restore: (backupPath: string) => ipcRenderer.invoke('backup:restore', backupPath),
    list: () => ipcRenderer.invoke('backup:list'),
  },
  server: {
    start: () => ipcRenderer.invoke('server:start'),
    stop: () => ipcRenderer.invoke('server:stop'),
    getStatus: () => ipcRenderer.invoke('server:getStatus'),
    getPort: () => ipcRenderer.invoke('server:getPort'),
    onStarted: (callback: (data: { port: number }) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, data: { port: number }) => callback(data);
      ipcRenderer.on('server:started', subscription);
      return () => ipcRenderer.removeListener('server:started', subscription);
    },
    onError: (callback: (data: { error?: string }) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, data: { error?: string }) => callback(data);
      ipcRenderer.on('server:error', subscription);
      return () => ipcRenderer.removeListener('server:error', subscription);
    },
  },
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
    onChecking: (callback: () => void) => {
      const subscription = () => callback();
      ipcRenderer.on('update:checking', subscription);
      return () => ipcRenderer.removeListener('update:checking', subscription);
    },
    onAvailable: (callback: (info: any) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, info: any) => callback(info);
      ipcRenderer.on('update:available', subscription);
      return () => ipcRenderer.removeListener('update:available', subscription);
    },
    onNotAvailable: (callback: () => void) => {
      const subscription = () => callback();
      ipcRenderer.on('update:not-available', subscription);
      return () => ipcRenderer.removeListener('update:not-available', subscription);
    },
    onError: (callback: (data: { error: string }) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, data: { error: string }) => callback(data);
      ipcRenderer.on('update:error', subscription);
      return () => ipcRenderer.removeListener('update:error', subscription);
    },
    onDownloadProgress: (callback: (progress: { percent: number; speed: number; transferred: number; total: number }) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, progress: { percent: number; speed: number; transferred: number; total: number }) => callback(progress);
      ipcRenderer.on('update:download-progress', subscription);
      return () => ipcRenderer.removeListener('update:download-progress', subscription);
    },
    onDownloaded: (callback: (info: any) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, info: any) => callback(info);
      ipcRenderer.on('update:downloaded', subscription);
      return () => ipcRenderer.removeListener('update:downloaded', subscription);
    },
  },
  ipc: {
    on: (channel: string, callback: (...args: unknown[]) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    },
    send: (channel: string, ...args: unknown[]) => {
      ipcRenderer.send(channel, ...args);
    },
    invoke: (channel: string, ...args: unknown[]) => {
      return ipcRenderer.invoke(channel, ...args);
    },
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
