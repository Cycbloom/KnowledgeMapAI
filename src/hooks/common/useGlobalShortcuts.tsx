import { useEffect } from 'react';
import { useShortcutStore } from '../../store/useShortcutStore';
import { 
  DEFAULT_SHORTCUTS, 
  matchesShortcut,
  ShortcutDefinition,
  ShortcutKey
} from '../../config/shortcuts';

type ActionHandler = () => void;

interface UseGlobalShortcutsProps {
  handlers: Record<string, ActionHandler>;
  enabled?: boolean;
  context?: Record<string, boolean>;
}

export function useGlobalShortcuts({
  handlers,
  enabled = true,
  context = {}
}: UseGlobalShortcutsProps) {
  const { bindings, enabled: globalEnabled } = useShortcutStore();
  
  useEffect(() => {
    if (!enabled || !globalEnabled) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA' || 
                      target.isContentEditable;
      
      for (const shortcut of DEFAULT_SHORTCUTS) {
        const binding = bindings[shortcut.id];
        if (!binding || !binding.enabled) continue;
        
        if (shortcut.when && !context[shortcut.when]) continue;
        
        if (isInput && !isGlobalShortcut(shortcut)) continue;
        
        if (matchesShortcut(e, binding.keys)) {
          const handler = handlers[shortcut.action];
          if (handler) {
            e.preventDefault();
            e.stopImmediatePropagation();
            handler();
            return;
          }
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers, bindings, enabled, globalEnabled, context]);
}

// 模块级常量：将 isGlobalShortcut 内每次调用的数组 includes 扫描提取为预构建 Set（O(1) 查找）
const INPUT_BLOCKED_ACTIONS = new Set([
  'navigateBack',
  'navigateForward',
  'goHome',
  'openSettings',
  'openCommandPalette',
  'openSearch',
]);
const GLOBAL_ACTIONS = new Set(['undo', 'redo', 'save', 'openConsole']);

function isGlobalShortcut(shortcut: ShortcutDefinition): boolean {
  // 输入框内不触发的 action：
  // - 导航类（navigateBack / navigateForward / goHome / openSettings）：避免在输入时误触跳转
  // - openCommandPalette / openSearch：输入框内按 Ctrl+K 不弹出全局命令面板（符合 spec，避免与浏览器原生行为冲突）
  if (INPUT_BLOCKED_ACTIONS.has(shortcut.action)) return false;
  return GLOBAL_ACTIONS.has(shortcut.action) ||
         !!(shortcut.defaultKeys.ctrl || shortcut.defaultKeys.meta);
}

export function useShortcutAction(actionId: string): {
  key: ShortcutKey | undefined;
  formattedKey: string;
  execute: () => void;
} {
  const { bindings } = useShortcutStore();
  const binding = bindings[actionId];
  
  const formattedKey = binding?.enabled 
    ? formatKey(binding.keys) 
    : '';
    
  return {
    key: binding?.enabled ? binding.keys : undefined,
    formattedKey,
    execute: () => {}
  };
}

function formatKey(shortcut: ShortcutKey): string {
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

export function useKeyboardHint(actionId: string): string {
  const { bindings } = useShortcutStore();
  const shortcut = bindings[actionId];
  const binding = bindings[actionId];
  
  if (!shortcut || !binding || !binding.enabled) {
    return '';
  }
  
  return formatKey(binding.keys);
}
