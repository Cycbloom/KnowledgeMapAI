import { GraphViewMode } from '../types';

export interface ShortcutKey {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export interface ShortcutDefinition {
  id: string;
  name: string;
  description: string;
  category: ShortcutCategory;
  defaultKeys: ShortcutKey;
  action: string;
  icon?: string;
  when?: string;
}

export type ShortcutCategory = 
  | 'navigation' 
  | 'view' 
  | 'editing' 
  | 'selection' 
  | 'ai' 
  | 'tools' 
  | 'general';

export interface ShortcutBinding {
  id: string;
  keys: ShortcutKey;
  enabled: boolean;
}

export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: 'undo',
    name: '撤销',
    description: '撤销上一步操作',
    category: 'editing',
    defaultKeys: { key: 'z', ctrl: true },
    action: 'undo',
    icon: 'Undo2'
  },
  {
    id: 'redo',
    name: '重做',
    description: '重做已撤销的操作',
    category: 'editing',
    defaultKeys: { key: 'z', ctrl: true, shift: true },
    action: 'redo',
    icon: 'Redo2'
  },
  {
    id: 'redo-alt',
    name: '重做 (备选)',
    description: '重做已撤销的操作（备选快捷键）',
    category: 'editing',
    defaultKeys: { key: 'y', ctrl: true },
    action: 'redo',
    icon: 'Redo2'
  },
  {
    id: 'save',
    name: '保存',
    description: '保存当前编辑的节点',
    category: 'editing',
    defaultKeys: { key: 's', ctrl: true },
    action: 'save',
    icon: 'Save'
  },
  {
    id: 'delete',
    name: '删除',
    description: '删除选中的节点',
    category: 'editing',
    defaultKeys: { key: 'Delete' },
    action: 'delete',
    icon: 'Trash2'
  },
  {
    id: 'delete-backspace',
    name: '删除 (退格键)',
    description: '删除选中的节点（退格键）',
    category: 'editing',
    defaultKeys: { key: 'Backspace' },
    action: 'delete',
    icon: 'Trash2'
  },
  {
    id: 'create-child',
    name: '创建子节点',
    description: '为选中节点创建子节点',
    category: 'editing',
    defaultKeys: { key: 'Tab' },
    action: 'createChild',
    icon: 'Plus'
  },
  {
    id: 'create-sibling',
    name: '创建同级节点',
    description: '创建与选中节点同级的节点',
    category: 'editing',
    defaultKeys: { key: 'Enter' },
    action: 'createSibling',
    icon: 'PlusCircle'
  },
  {
    id: 'edit-node',
    name: '编辑节点',
    description: '进入节点编辑模式',
    category: 'editing',
    defaultKeys: { key: 'e' },
    action: 'editNode',
    icon: 'Edit3'
  },
  {
    id: 'copy',
    name: '复制',
    description: '复制选中的节点',
    category: 'editing',
    defaultKeys: { key: 'c', ctrl: true },
    action: 'copy',
    icon: 'Copy'
  },
  {
    id: 'cut',
    name: '剪切',
    description: '剪切选中的节点',
    category: 'editing',
    defaultKeys: { key: 'x', ctrl: true },
    action: 'cut',
    icon: 'Scissors'
  },
  {
    id: 'paste',
    name: '粘贴',
    description: '粘贴节点',
    category: 'editing',
    defaultKeys: { key: 'v', ctrl: true },
    action: 'paste',
    icon: 'Clipboard'
  },
  {
    id: 'select-all',
    name: '全选',
    description: '选择所有节点',
    category: 'selection',
    defaultKeys: { key: 'a', ctrl: true },
    action: 'selectAll',
    icon: 'CheckSquare'
  },
  {
    id: 'deselect-all',
    name: '取消全选',
    description: '取消选择所有节点',
    category: 'selection',
    defaultKeys: { key: 'Escape' },
    action: 'deselectAll',
    icon: 'XSquare'
  },
  {
    id: 'select-parent',
    name: '选择父节点',
    description: '选择当前节点的父节点',
    category: 'selection',
    defaultKeys: { key: 'ArrowUp' },
    action: 'selectParent',
    icon: 'ArrowUp'
  },
  {
    id: 'select-first-child',
    name: '选择第一个子节点',
    description: '选择当前节点的第一个子节点',
    category: 'selection',
    defaultKeys: { key: 'ArrowDown' },
    action: 'selectFirstChild',
    icon: 'ArrowDown'
  },
  {
    id: 'select-prev-sibling',
    name: '选择上一个同级节点',
    description: '选择当前节点的前一个同级节点',
    category: 'selection',
    defaultKeys: { key: 'ArrowLeft' },
    action: 'selectPrevSibling',
    icon: 'ArrowLeft'
  },
  {
    id: 'select-next-sibling',
    name: '选择下一个同级节点',
    description: '选择当前节点的下一个同级节点',
    category: 'selection',
    defaultKeys: { key: 'ArrowRight' },
    action: 'selectNextSibling',
    icon: 'ArrowRight'
  },
  {
    id: 'view-mindmap',
    name: '思维导图视图',
    description: '切换到思维导图视图',
    category: 'view',
    defaultKeys: { key: '1', ctrl: true },
    action: 'setViewMode:mindmap',
    icon: 'Network'
  },
  {
    id: 'view-timeline',
    name: '时间轴视图',
    description: '切换到时间轴视图',
    category: 'view',
    defaultKeys: { key: '2', ctrl: true },
    action: 'setViewMode:timeline',
    icon: 'Clock'
  },
  {
    id: 'view-tree',
    name: '树形视图',
    description: '切换到树形视图',
    category: 'view',
    defaultKeys: { key: '3', ctrl: true },
    action: 'setViewMode:tree',
    icon: 'GitBranch'
  },
  {
    id: 'view-planet',
    name: '3D星球视图',
    description: '切换到3D星球视图',
    category: 'view',
    defaultKeys: { key: '4', ctrl: true },
    action: 'setViewMode:planet',
    icon: 'Globe'
  },
  {
    id: 'toggle-sidebar',
    name: '切换侧边栏',
    description: '显示或隐藏侧边栏',
    category: 'view',
    defaultKeys: { key: 'b' },
    action: 'toggleSidebar',
    icon: 'Sidebar'
  },
  {
    id: 'toggle-grid',
    name: '切换网格',
    description: '显示或隐藏网格',
    category: 'view',
    defaultKeys: { key: 'g' },
    action: 'toggleGrid',
    icon: 'Grid3X3'
  },
  {
    id: 'toggle-focus-mode',
    name: '切换专注模式',
    description: '进入或退出专注模式',
    category: 'view',
    defaultKeys: { key: 'f' },
    action: 'toggleFocusMode',
    icon: 'Focus'
  },
  {
    id: 'toggle-delete-mode',
    name: '切换删除模式',
    description: '进入或退出删除模式',
    category: 'tools',
    defaultKeys: { key: 'd' },
    action: 'toggleDeleteMode',
    icon: 'Trash'
  },
  {
    id: 'toggle-pathfinding-mode',
    name: '切换路径查找模式',
    description: '进入或退出路径查找模式',
    category: 'tools',
    defaultKeys: { key: 'p' },
    action: 'togglePathfindingMode',
    icon: 'Route'
  },
  {
    id: 'toggle-exploration-mode',
    name: '切换探索模式',
    description: '进入或退出探索模式',
    category: 'tools',
    defaultKeys: { key: 'e' },
    action: 'toggleExplorationMode',
    icon: 'Compass'
  },
  {
    id: 'zoom-in',
    name: '放大',
    description: '放大画布',
    category: 'view',
    defaultKeys: { key: '=', ctrl: true },
    action: 'zoomIn',
    icon: 'ZoomIn'
  },
  {
    id: 'zoom-out',
    name: '缩小',
    description: '缩小画布',
    category: 'view',
    defaultKeys: { key: '-', ctrl: true },
    action: 'zoomOut',
    icon: 'ZoomOut'
  },
  {
    id: 'zoom-reset',
    name: '重置缩放',
    description: '重置画布缩放到默认值',
    category: 'view',
    defaultKeys: { key: '0', ctrl: true },
    action: 'zoomReset',
    icon: 'Maximize2'
  },
  {
    id: 'fit-view',
    name: '适应视图',
    description: '自动调整视图以显示所有节点',
    category: 'view',
    defaultKeys: { key: 'h' },
    action: 'fitView',
    icon: 'Expand'
  },
  {
    id: 'command-palette',
    name: '命令面板',
    description: '打开命令面板',
    category: 'general',
    defaultKeys: { key: 'k', ctrl: true },
    action: 'openCommandPalette',
    icon: 'Command'
  },
  {
    id: 'search',
    name: '搜索',
    description: '打开搜索面板',
    category: 'general',
    defaultKeys: { key: '/', ctrl: true },
    action: 'openSearch',
    icon: 'Search'
  },
  {
    id: 'help',
    name: '帮助',
    description: '显示快捷键帮助',
    category: 'general',
    defaultKeys: { key: '?' },
    action: 'showHelp',
    icon: 'HelpCircle'
  },
  {
    id: 'ai-expand',
    name: 'AI扩展',
    description: '使用AI扩展当前节点',
    category: 'ai',
    defaultKeys: { key: 'a', ctrl: true, shift: true },
    action: 'aiExpand',
    icon: 'Wand2'
  },
  {
    id: 'ai-generate-cards',
    name: 'AI生成卡片',
    description: '使用AI生成学习卡片',
    category: 'ai',
    defaultKeys: { key: 'g', ctrl: true, shift: true },
    action: 'aiGenerateCards',
    icon: 'Layers'
  },
  {
    id: 'ai-chat',
    name: 'AI对话',
    description: '打开AI对话面板',
    category: 'ai',
    defaultKeys: { key: 'c', ctrl: true, shift: true },
    action: 'aiChat',
    icon: 'MessageSquare'
  },
  {
    id: 'navigate-back',
    name: '返回',
    description: '返回上一页',
    category: 'navigation',
    defaultKeys: { key: 'ArrowLeft', alt: true },
    action: 'navigateBack',
    icon: 'ArrowLeft'
  },
  {
    id: 'navigate-forward',
    name: '前进',
    description: '前进到下一页',
    category: 'navigation',
    defaultKeys: { key: 'ArrowRight', alt: true },
    action: 'navigateForward',
    icon: 'ArrowRight'
  },
  {
    id: 'go-home',
    name: '返回首页',
    description: '返回首页仪表盘',
    category: 'navigation',
    defaultKeys: { key: 'Home', ctrl: true },
    action: 'goHome',
    icon: 'Home'
  },
  {
    id: 'presentation-next',
    name: '演示下一页',
    description: '在演示模式下显示下一页',
    category: 'view',
    defaultKeys: { key: 'ArrowRight', shift: true },
    action: 'presentationNext',
    icon: 'ChevronRight',
    when: 'presentationMode'
  },
  {
    id: 'presentation-prev',
    name: '演示上一页',
    description: '在演示模式下显示上一页',
    category: 'view',
    defaultKeys: { key: 'ArrowLeft', shift: true },
    action: 'presentationPrev',
    icon: 'ChevronLeft',
    when: 'presentationMode'
  },
  {
    id: 'toggle-theme',
    name: '切换主题',
    description: '切换亮色/暗色主题',
    category: 'general',
    defaultKeys: { key: 't', ctrl: true, shift: true },
    action: 'toggleTheme',
    icon: 'Sun'
  },
  {
    id: 'export',
    name: '导出',
    description: '打开导出对话框',
    category: 'general',
    defaultKeys: { key: 'e', ctrl: true, shift: true },
    action: 'openExport',
    icon: 'Download'
  },
  {
    id: 'settings',
    name: '设置',
    description: '打开设置面板',
    category: 'general',
    defaultKeys: { key: ',', ctrl: true },
    action: 'openSettings',
    icon: 'Settings'
  }
];

export const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: '导航',
  view: '视图',
  editing: '编辑',
  selection: '选择',
  ai: 'AI助手',
  tools: '工具',
  general: '通用'
};

export const CATEGORY_ORDER: ShortcutCategory[] = [
  'general',
  'navigation',
  'view',
  'editing',
  'selection',
  'tools',
  'ai'
];

export function formatShortcutKey(shortcut: ShortcutKey): string {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const parts: string[] = [];
  
  if (shortcut.ctrl || shortcut.meta) {
    parts.push(isMac ? '⌘' : 'Ctrl');
  }
  if (shortcut.alt) {
    parts.push(isMac ? '⌥' : 'Alt');
  }
  if (shortcut.shift) {
    parts.push(isMac ? '⇧' : 'Shift');
  }
  
  let keyDisplay = shortcut.key;
  if (shortcut.key === ' ') keyDisplay = 'Space';
  else if (shortcut.key === 'ArrowUp') keyDisplay = '↑';
  else if (shortcut.key === 'ArrowDown') keyDisplay = '↓';
  else if (shortcut.key === 'ArrowLeft') keyDisplay = '←';
  else if (shortcut.key === 'ArrowRight') keyDisplay = '→';
  else if (shortcut.key === 'Enter') keyDisplay = '↵';
  else if (shortcut.key === 'Escape') keyDisplay = 'Esc';
  else if (shortcut.key === 'Delete') keyDisplay = 'Del';
  else if (shortcut.key === 'Backspace') keyDisplay = '⌫';
  else if (shortcut.key === 'Tab') keyDisplay = '⇥';
  else if (shortcut.key.length === 1) keyDisplay = shortcut.key.toUpperCase();
  
  parts.push(keyDisplay);
  
  return parts.join(isMac ? '' : '+');
}

export function shortcutKeyToString(shortcut: ShortcutKey): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push('ctrl');
  if (shortcut.meta) parts.push('meta');
  if (shortcut.shift) parts.push('shift');
  if (shortcut.alt) parts.push('alt');
  parts.push(shortcut.key.toLowerCase());
  return parts.join('+');
}

export function parseShortcutKey(str: string): ShortcutKey {
  const parts = str.toLowerCase().split('+');
  const key = parts.pop() || '';
  return {
    key: key.length === 1 ? key.toUpperCase() : key,
    ctrl: parts.includes('ctrl'),
    meta: parts.includes('meta'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt')
  };
}

export function matchesShortcut(event: KeyboardEvent, shortcut: ShortcutKey): boolean {
  const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;
  
  const expectedCmdOrCtrl = shortcut.ctrl || shortcut.meta;
  
  return (
    event.key.toLowerCase() === shortcut.key.toLowerCase() &&
    cmdOrCtrl === expectedCmdOrCtrl &&
    event.shiftKey === (shortcut.shift || false) &&
    event.altKey === (shortcut.alt || false)
  );
}
