import { BrowserWindow, Menu, MenuItemConstructorOptions } from 'electron';

export type MenuAction =
  | 'preferences'
  | 'about'
  | 'documentation'
  | 'reportIssue'
  | 'checkUpdates';

export interface AppMenuDeps {
  getMainWindow: () => BrowserWindow | null;
  onMenuAction: (action: MenuAction) => void;
}

export function buildAppMenu(deps: AppMenuDeps): Menu {
  const isMac = process.platform === 'darwin';
  const template = isMac ? buildMacTemplate(deps) : buildWinLinuxTemplate(deps);
  return Menu.buildFromTemplate(template);
}

function buildMacTemplate(deps: AppMenuDeps): MenuItemConstructorOptions[] {
  return [
    {
      label: 'KnowledgeMap',
      submenu: [
        { role: 'about', label: 'About KnowledgeMap' },
        { type: 'separator' },
        {
          label: 'Preferences…',
          accelerator: 'CmdOrCtrl+,',
          click: () => deps.onMenuAction('preferences'),
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide', label: 'Hide KnowledgeMap' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit', label: 'Quit KnowledgeMap' },
      ],
    },
    {
      label: 'File',
      submenu: [
        { label: 'New Window', enabled: false },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => deps.onMenuAction('documentation'),
        },
        {
          label: 'Report Issue',
          click: () => deps.onMenuAction('reportIssue'),
        },
        { type: 'separator' },
        {
          label: 'Check for Updates',
          click: () => deps.onMenuAction('checkUpdates'),
        },
      ],
    },
  ];
}

function buildWinLinuxTemplate(deps: AppMenuDeps): MenuItemConstructorOptions[] {
  return [
    {
      label: 'File',
      submenu: [
        { label: 'New Window', enabled: false },
        { type: 'separator' },
        { role: 'close' },
        { type: 'separator' },
        {
          label: 'Preferences…',
          accelerator: 'CmdOrCtrl+,',
          click: () => deps.onMenuAction('preferences'),
        },
        { role: 'quit', label: 'Quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => deps.onMenuAction('documentation'),
        },
        {
          label: 'Report Issue',
          click: () => deps.onMenuAction('reportIssue'),
        },
        { type: 'separator' },
        {
          label: 'Check for Updates',
          click: () => deps.onMenuAction('checkUpdates'),
        },
        { type: 'separator' },
        {
          label: 'About KnowledgeMap',
          click: () => deps.onMenuAction('about'),
        },
      ],
    },
  ];
}
