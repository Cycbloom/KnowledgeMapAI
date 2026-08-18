import { Tray, Menu, nativeImage, app, BrowserWindow, screen } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class TrayManager {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;

  initialize(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
    
    // nativeImage 不支持 SVG，托盘必须使用 PNG。
    // 按屏幕缩放比例直接加载预渲染位图（Lanczos 高质量降采样产物），
    // 避免运行时 resize + DPI 拉伸的双重缩放损失导致图标发糊。
    // 注意：esbuild 打包后本文件并入 dist-electron/electron/main.js，
    // 开发模式 __dirname 即 dist-electron/electron，只需回退两级到项目根目录
    const iconsDir = app.isPackaged
      ? path.join(process.resourcesPath, 'public', 'icons')
      : path.join(__dirname, '..', '..', 'public', 'icons');
    const factor = screen.getPrimaryDisplay().scaleFactor;
    const traySize = factor >= 1.75 ? 32 : factor >= 1.25 ? 24 : 16;
    const icon = nativeImage.createFromPath(path.join(iconsDir, `${traySize}x${traySize}.png`));

    this.tray = new Tray(icon);
    
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
