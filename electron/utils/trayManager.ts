import { Tray, Menu, nativeImage, app, BrowserWindow } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class TrayManager {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;

  initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
    
    const iconPath = path.join(__dirname, '../../public/favicon.svg');
    const icon = nativeImage.createFromPath(iconPath);
    
    this.tray = new Tray(icon.resize({ width: 16, height: 16 }));
    
    this.updateMenu();
    
    this.tray.on('double-click', () => {
      this.showMainWindow();
    });
  }

  private updateMenu(): void {
    if (!this.tray) return;

    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示主窗口',
        click: () => this.showMainWindow(),
      },
      {
        label: '最小化到托盘',
        click: () => this.hideMainWindow(),
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          this.destroy();
          app.quit();
        },
      },
    ]);

    this.tray.setToolTip('KnowledgeMap');
    this.tray.setContextMenu(contextMenu);
  }

  private showMainWindow(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  private hideMainWindow(): void {
    this.mainWindow?.hide();
  }

  destroy(): void {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }

  getTray(): Tray | null {
    return this.tray;
  }
}

export const trayManager = new TrayManager();
