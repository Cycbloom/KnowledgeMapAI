export interface ShortcutKey {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export interface ShortcutDefinition {
  id: string;
  /** i18n key for the shortcut name, e.g. "shortcuts.actions.undo.name" */
  name: string;
  /** i18n key for the shortcut description, e.g. "shortcuts.actions.undo.description" */
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
    name: 'shortcuts.actions.undo.name',
    description: 'shortcuts.actions.undo.description',
    category: 'editing',
    defaultKeys: { key: 'z', ctrl: true },
    action: 'undo',
    icon: 'Undo2'
  },
  {
    id: 'redo',
    name: 'shortcuts.actions.redo.name',
    description: 'shortcuts.actions.redo.description',
    category: 'editing',
    defaultKeys: { key: 'z', ctrl: true, shift: true },
    action: 'redo',
    icon: 'Redo2'
  },
  {
    id: 'redo-alt',
    name: 'shortcuts.actions.redo-alt.name',
    description: 'shortcuts.actions.redo-alt.description',
    category: 'editing',
    defaultKeys: { key: 'y', ctrl: true },
    action: 'redo',
    icon: 'Redo2'
  },
  {
    id: 'save',
    name: 'shortcuts.actions.save.name',
    description: 'shortcuts.actions.save.description',
    category: 'editing',
    defaultKeys: { key: 's', ctrl: true },
    action: 'save',
    icon: 'Save'
  },
  {
    id: 'delete',
    name: 'shortcuts.actions.delete.name',
    description: 'shortcuts.actions.delete.description',
    category: 'editing',
    defaultKeys: { key: 'Delete' },
    action: 'delete',
    icon: 'Trash2'
  },
  {
    id: 'delete-backspace',
    name: 'shortcuts.actions.delete-backspace.name',
    description: 'shortcuts.actions.delete-backspace.description',
    category: 'editing',
    defaultKeys: { key: 'Backspace' },
    action: 'delete',
    icon: 'Trash2'
  },
  {
    id: 'create-child',
    name: 'shortcuts.actions.create-child.name',
    description: 'shortcuts.actions.create-child.description',
    category: 'editing',
    defaultKeys: { key: 'Tab' },
    action: 'createChild',
    icon: 'Plus'
  },
  {
    id: 'create-sibling',
    name: 'shortcuts.actions.create-sibling.name',
    description: 'shortcuts.actions.create-sibling.description',
    category: 'editing',
    defaultKeys: { key: 'Enter' },
    action: 'createSibling',
    icon: 'PlusCircle'
  },
  {
    id: 'edit-node',
    name: 'shortcuts.actions.edit-node.name',
    description: 'shortcuts.actions.edit-node.description',
    category: 'editing',
    defaultKeys: { key: 'e' },
    action: 'editNode',
    icon: 'Edit3'
  },
  {
    id: 'copy',
    name: 'shortcuts.actions.copy.name',
    description: 'shortcuts.actions.copy.description',
    category: 'editing',
    defaultKeys: { key: 'c', ctrl: true },
    action: 'copy',
    icon: 'Copy'
  },
  {
    id: 'cut',
    name: 'shortcuts.actions.cut.name',
    description: 'shortcuts.actions.cut.description',
    category: 'editing',
    defaultKeys: { key: 'x', ctrl: true },
    action: 'cut',
    icon: 'Scissors'
  },
  {
    id: 'paste',
    name: 'shortcuts.actions.paste.name',
    description: 'shortcuts.actions.paste.description',
    category: 'editing',
    defaultKeys: { key: 'v', ctrl: true },
    action: 'paste',
    icon: 'Clipboard'
  },
  {
    id: 'select-all',
    name: 'shortcuts.actions.select-all.name',
    description: 'shortcuts.actions.select-all.description',
    category: 'selection',
    defaultKeys: { key: 'a', ctrl: true },
    action: 'selectAll',
    icon: 'CheckSquare'
  },
  {
    id: 'deselect-all',
    name: 'shortcuts.actions.deselect-all.name',
    description: 'shortcuts.actions.deselect-all.description',
    category: 'selection',
    defaultKeys: { key: 'Escape' },
    action: 'deselectAll',
    icon: 'XSquare'
  },
  {
    id: 'select-parent',
    name: 'shortcuts.actions.select-parent.name',
    description: 'shortcuts.actions.select-parent.description',
    category: 'selection',
    defaultKeys: { key: 'ArrowUp' },
    action: 'selectParent',
    icon: 'ArrowUp'
  },
  {
    id: 'select-first-child',
    name: 'shortcuts.actions.select-first-child.name',
    description: 'shortcuts.actions.select-first-child.description',
    category: 'selection',
    defaultKeys: { key: 'ArrowDown' },
    action: 'selectFirstChild',
    icon: 'ArrowDown'
  },
  {
    id: 'select-prev-sibling',
    name: 'shortcuts.actions.select-prev-sibling.name',
    description: 'shortcuts.actions.select-prev-sibling.description',
    category: 'selection',
    defaultKeys: { key: 'ArrowLeft' },
    action: 'selectPrevSibling',
    icon: 'ArrowLeft'
  },
  {
    id: 'select-next-sibling',
    name: 'shortcuts.actions.select-next-sibling.name',
    description: 'shortcuts.actions.select-next-sibling.description',
    category: 'selection',
    defaultKeys: { key: 'ArrowRight' },
    action: 'selectNextSibling',
    icon: 'ArrowRight'
  },
  {
    id: 'view-mindmap',
    name: 'shortcuts.actions.view-mindmap.name',
    description: 'shortcuts.actions.view-mindmap.description',
    category: 'view',
    defaultKeys: { key: '1', ctrl: true },
    action: 'setViewMode:mindmap',
    icon: 'Network'
  },
  {
    id: 'view-timeline',
    name: 'shortcuts.actions.view-timeline.name',
    description: 'shortcuts.actions.view-timeline.description',
    category: 'view',
    defaultKeys: { key: '2', ctrl: true },
    action: 'setViewMode:timeline',
    icon: 'Clock'
  },
  {
    id: 'view-tree',
    name: 'shortcuts.actions.view-tree.name',
    description: 'shortcuts.actions.view-tree.description',
    category: 'view',
    defaultKeys: { key: '3', ctrl: true },
    action: 'setViewMode:tree',
    icon: 'GitBranch'
  },
  {
    id: 'view-planet',
    name: 'shortcuts.actions.view-planet.name',
    description: 'shortcuts.actions.view-planet.description',
    category: 'view',
    defaultKeys: { key: '4', ctrl: true },
    action: 'setViewMode:planet',
    icon: 'Globe'
  },
  {
    id: 'toggle-sidebar',
    name: 'shortcuts.actions.toggle-sidebar.name',
    description: 'shortcuts.actions.toggle-sidebar.description',
    category: 'view',
    defaultKeys: { key: 'b' },
    action: 'toggleSidebar',
    icon: 'Sidebar'
  },
  {
    id: 'toggle-grid',
    name: 'shortcuts.actions.toggle-grid.name',
    description: 'shortcuts.actions.toggle-grid.description',
    category: 'view',
    defaultKeys: { key: 'g' },
    action: 'toggleGrid',
    icon: 'Grid3X3'
  },
  {
    id: 'toggle-focus-mode',
    name: 'shortcuts.actions.toggle-focus-mode.name',
    description: 'shortcuts.actions.toggle-focus-mode.description',
    category: 'view',
    defaultKeys: { key: 'f' },
    action: 'toggleFocusMode',
    icon: 'Focus'
  },
  {
    id: 'toggle-delete-mode',
    name: 'shortcuts.actions.toggle-delete-mode.name',
    description: 'shortcuts.actions.toggle-delete-mode.description',
    category: 'tools',
    defaultKeys: { key: 'd' },
    action: 'toggleDeleteMode',
    icon: 'Trash'
  },
  {
    id: 'toggle-pathfinding-mode',
    name: 'shortcuts.actions.toggle-pathfinding-mode.name',
    description: 'shortcuts.actions.toggle-pathfinding-mode.description',
    category: 'tools',
    defaultKeys: { key: 'p' },
    action: 'togglePathfindingMode',
    icon: 'Route'
  },
  {
    id: 'toggle-exploration-mode',
    name: 'shortcuts.actions.toggle-exploration-mode.name',
    description: 'shortcuts.actions.toggle-exploration-mode.description',
    category: 'tools',
    defaultKeys: { key: 'e', shift: true },
    action: 'toggleExplorationMode',
    icon: 'Compass'
  },
  {
    id: 'zoom-in',
    name: 'shortcuts.actions.zoom-in.name',
    description: 'shortcuts.actions.zoom-in.description',
    category: 'view',
    defaultKeys: { key: '=', ctrl: true },
    action: 'zoomIn',
    icon: 'ZoomIn'
  },
  {
    id: 'zoom-out',
    name: 'shortcuts.actions.zoom-out.name',
    description: 'shortcuts.actions.zoom-out.description',
    category: 'view',
    defaultKeys: { key: '-', ctrl: true },
    action: 'zoomOut',
    icon: 'ZoomOut'
  },
  {
    id: 'zoom-reset',
    name: 'shortcuts.actions.zoom-reset.name',
    description: 'shortcuts.actions.zoom-reset.description',
    category: 'view',
    defaultKeys: { key: '0', ctrl: true },
    action: 'zoomReset',
    icon: 'Maximize2'
  },
  {
    id: 'fit-view',
    name: 'shortcuts.actions.fit-view.name',
    description: 'shortcuts.actions.fit-view.description',
    category: 'view',
    defaultKeys: { key: 'h' },
    action: 'fitView',
    icon: 'Expand'
  },
  {
    id: 'fit-selection',
    name: 'shortcuts.actions.fit-selection.name',
    description: 'shortcuts.actions.fit-selection.description',
    category: 'view',
    defaultKeys: { key: 'f', shift: true },
    action: 'fitSelection',
    icon: 'Focus'
  },
  {
    id: 'command-palette',
    name: 'shortcuts.actions.command-palette.name',
    description: 'shortcuts.actions.command-palette.description',
    category: 'general',
    defaultKeys: { key: 'k', ctrl: true },
    action: 'openCommandPalette',
    icon: 'Command'
  },
  {
    id: 'open-console',
    name: 'shortcuts.actions.open-console.name',
    description: 'shortcuts.actions.open-console.description',
    category: 'tools',
    defaultKeys: { key: 'p', ctrl: true, shift: true },
    action: 'openConsole',
    icon: 'Terminal'
  },
  {
    id: 'search',
    name: 'shortcuts.actions.search.name',
    description: 'shortcuts.actions.search.description',
    category: 'general',
    defaultKeys: { key: '/', ctrl: true },
    action: 'openSearch',
    icon: 'Search'
  },
  {
    id: 'help',
    name: 'shortcuts.actions.help.name',
    description: 'shortcuts.actions.help.description',
    category: 'general',
    defaultKeys: { key: '?' },
    action: 'showHelp',
    icon: 'HelpCircle'
  },
  {
    id: 'ai-expand',
    name: 'shortcuts.actions.ai-expand.name',
    description: 'shortcuts.actions.ai-expand.description',
    category: 'ai',
    defaultKeys: { key: 'a', ctrl: true, shift: true },
    action: 'aiExpand',
    icon: 'Wand2'
  },
  {
    id: 'ai-generate-cards',
    name: 'shortcuts.actions.ai-generate-cards.name',
    description: 'shortcuts.actions.ai-generate-cards.description',
    category: 'ai',
    defaultKeys: { key: 'g', ctrl: true, shift: true },
    action: 'aiGenerateCards',
    icon: 'Layers'
  },
  {
    id: 'ai-chat',
    name: 'shortcuts.actions.ai-chat.name',
    description: 'shortcuts.actions.ai-chat.description',
    category: 'ai',
    defaultKeys: { key: 'c', ctrl: true, shift: true },
    action: 'aiChat',
    icon: 'MessageSquare'
  },
  {
    id: 'navigate-back',
    name: 'shortcuts.actions.navigate-back.name',
    description: 'shortcuts.actions.navigate-back.description',
    category: 'navigation',
    defaultKeys: { key: 'ArrowLeft', alt: true },
    action: 'navigateBack',
    icon: 'ArrowLeft'
  },
  {
    id: 'navigate-forward',
    name: 'shortcuts.actions.navigate-forward.name',
    description: 'shortcuts.actions.navigate-forward.description',
    category: 'navigation',
    defaultKeys: { key: 'ArrowRight', alt: true },
    action: 'navigateForward',
    icon: 'ArrowRight'
  },
  {
    id: 'go-home',
    name: 'shortcuts.actions.go-home.name',
    description: 'shortcuts.actions.go-home.description',
    category: 'navigation',
    defaultKeys: { key: 'Home', ctrl: true },
    action: 'goHome',
    icon: 'Home'
  },
  {
    id: 'presentation-next',
    name: 'shortcuts.actions.presentation-next.name',
    description: 'shortcuts.actions.presentation-next.description',
    category: 'view',
    defaultKeys: { key: 'ArrowRight', shift: true },
    action: 'presentationNext',
    icon: 'ChevronRight',
    when: 'presentationMode'
  },
  {
    id: 'presentation-prev',
    name: 'shortcuts.actions.presentation-prev.name',
    description: 'shortcuts.actions.presentation-prev.description',
    category: 'view',
    defaultKeys: { key: 'ArrowLeft', shift: true },
    action: 'presentationPrev',
    icon: 'ChevronLeft',
    when: 'presentationMode'
  },
  {
    id: 'toggle-theme',
    name: 'shortcuts.actions.toggle-theme.name',
    description: 'shortcuts.actions.toggle-theme.description',
    category: 'general',
    defaultKeys: { key: 't', ctrl: true, shift: true },
    action: 'toggleTheme',
    icon: 'Sun'
  },
  {
    id: 'export',
    name: 'shortcuts.actions.export.name',
    description: 'shortcuts.actions.export.description',
    category: 'general',
    defaultKeys: { key: 'e', ctrl: true, shift: true },
    action: 'openExport',
    icon: 'Download'
  },
  {
    id: 'settings',
    name: 'shortcuts.actions.settings.name',
    description: 'shortcuts.actions.settings.description',
    category: 'general',
    defaultKeys: { key: ',', ctrl: true },
    action: 'openSettings',
    icon: 'Settings'
  }
];

/**
 * i18n keys for shortcut categories. Consumers should translate via `t(CATEGORY_LABELS[category])`.
 */
export const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: 'shortcuts.categories.navigation',
  view: 'shortcuts.categories.view',
  editing: 'shortcuts.categories.editing',
  selection: 'shortcuts.categories.selection',
  ai: 'shortcuts.categories.ai',
  tools: 'shortcuts.categories.tools',
  general: 'shortcuts.categories.general'
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
