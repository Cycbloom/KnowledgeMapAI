import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface WindowConfig {
  id: string;
  options: BrowserWindowConstructorOptions;
  url?: string;
  file?: string;
}

class WindowManager {
  private windows: Map<string, BrowserWindow> = new Map();

  createWindow(config: WindowConfig): BrowserWindow {
    const existingWindow = this.windows.get(config.id);
    if (existingWindow && !existingWindow.isDestroyed()) {
      existingWindow.focus();
      return existingWindow;
    }

    const window = new BrowserWindow({
      ...config.options,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../preload.js'),
        ...config.options.webPreferences,
      },
    });

    this.windows.set(config.id, window);

    window.on('closed', () => {
      this.windows.delete(config.id);
    });

    if (config.url) {
      window.loadURL(config.url);
    } else if (config.file) {
      window.loadFile(config.file);
    }

    return window;
  }

  getWindow(id: string): BrowserWindow | undefined {
    return this.windows.get(id);
  }

  closeWindow(id: string): void {
    const window = this.windows.get(id);
    if (window) {
      window.close();
    }
  }

  closeAllWindows(): void {
    for (const window of this.windows.values()) {
      if (!window.isDestroyed()) {
        window.close();
      }
    }
    this.windows.clear();
  }

  getAllWindows(): BrowserWindow[] {
    return Array.from(this.windows.values());
  }
}

export const windowManager = new WindowManager();
