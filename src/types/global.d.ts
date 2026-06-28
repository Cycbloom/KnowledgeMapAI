// Electron preload 注入的全局对象类型声明
// 来源: electron/preload.ts 通过 contextBridge.exposeInMainWorld("electronAPI", ...) 注入
import type { ElectronAPI } from "../../electron/preload";

/**
 * Capacitor 注入的全局对象
 * 字段按 src/config/mobileApiConfig.ts 实际访问情况声明
 */
interface CapacitorGlobal {
  isNative?: boolean;
  isNativePlatform?: (() => boolean) | boolean;
  getPlatform?: () => string;
}

declare global {
  interface Window {
    // Electron preload 注入；非 Electron 环境下不存在
    electronAPI?: ElectronAPI;
    // 旧版 Electron 全局对象别名（仅用于存在性检测）
    electron?: unknown;
    // Capacitor 注入；非 Capacitor 环境下不存在
    Capacitor?: CapacitorGlobal;
  }
}

export {};
