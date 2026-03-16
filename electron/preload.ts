import { contextBridge, ipcRenderer } from "electron";

const electronAPI = {
  app: {
    getVersion: () => ipcRenderer.invoke("app:getVersion"),
    getPlatform: () => ipcRenderer.invoke("app:getPlatform"),
    quit: () => ipcRenderer.invoke("app:quit"),
  },
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximize: () => ipcRenderer.invoke("window:maximize"),
    close: () => ipcRenderer.invoke("window:close"),
  },
  update: {
    check: () => ipcRenderer.invoke("update:check"),
    install: () => ipcRenderer.invoke("update:install"),
    onChecking: (callback: () => void) => {
      const subscription = () => callback();
      ipcRenderer.on("update:checking", subscription);
      return () => ipcRenderer.removeListener("update:checking", subscription);
    },
    onAvailable: (callback: (info: any) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, info: any) =>
        callback(info);
      ipcRenderer.on("update:available", subscription);
      return () => ipcRenderer.removeListener("update:available", subscription);
    },
    onNotAvailable: (callback: () => void) => {
      const subscription = () => callback();
      ipcRenderer.on("update:not-available", subscription);
      return () =>
        ipcRenderer.removeListener("update:not-available", subscription);
    },
    onError: (callback: (data: { error: string }) => void) => {
      const subscription = (
        _event: Electron.IpcRendererEvent,
        data: { error: string },
      ) => callback(data);
      ipcRenderer.on("update:error", subscription);
      return () => ipcRenderer.removeListener("update:error", subscription);
    },
    onDownloadProgress: (
      callback: (progress: {
        percent: number;
        speed: number;
        transferred: number;
        total: number;
      }) => void,
    ) => {
      const subscription = (
        _event: Electron.IpcRendererEvent,
        progress: {
          percent: number;
          speed: number;
          transferred: number;
          total: number;
        },
      ) => callback(progress);
      ipcRenderer.on("update:download-progress", subscription);
      return () =>
        ipcRenderer.removeListener("update:download-progress", subscription);
    },
    onDownloaded: (callback: (info: any) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, info: any) =>
        callback(info);
      ipcRenderer.on("update:downloaded", subscription);
      return () =>
        ipcRenderer.removeListener("update:downloaded", subscription);
    },
  },
  ipc: {
    on: (channel: string, callback: (...args: unknown[]) => void) => {
      const subscription = (
        _event: Electron.IpcRendererEvent,
        ...args: unknown[]
      ) => callback(...args);
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

contextBridge.exposeInMainWorld("electronAPI", electronAPI);

export type ElectronAPI = typeof electronAPI;
