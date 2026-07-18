// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_SHORTCUTS } from '../../config/shortcuts';
import { useShortcutStore } from '../useShortcutStore';

describe('useShortcutStore', () => {
  beforeEach(() => {
    // 重建默认 bindings
    const defaultBindings: Record<string, { id: string; keys: { key: string; ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean }; enabled: boolean }> = {};
    DEFAULT_SHORTCUTS.forEach((shortcut) => {
      defaultBindings[shortcut.id] = {
        id: shortcut.id,
        keys: shortcut.defaultKeys,
        enabled: true,
      };
    });
    useShortcutStore.setState({
      bindings: defaultBindings,
      enabled: true,
    });
  });

  it('应该有正确的初始状态', () => {
    const state = useShortcutStore.getState();
    expect(state.enabled).toBe(true);
    expect(Object.keys(state.bindings).length).toBe(DEFAULT_SHORTCUTS.length);
  });

  it('初始状态所有快捷键均应为启用状态', () => {
    const { bindings } = useShortcutStore.getState();
    for (const binding of Object.values(bindings)) {
      expect(binding.enabled).toBe(true);
    }
  });

  it('应该能通过 getShortcut 获取快捷键定义', () => {
    const shortcut = useShortcutStore.getState().getShortcut('undo');
    expect(shortcut).toBeDefined();
    expect(shortcut?.id).toBe('undo');
    expect(shortcut?.action).toBe('undo');
  });

  it('getShortcut 对不存在的ID应返回 undefined', () => {
    const shortcut = useShortcutStore.getState().getShortcut('non-existent');
    expect(shortcut).toBeUndefined();
  });

  it('应该能通过 getBinding 获取快捷键绑定', () => {
    const binding = useShortcutStore.getState().getBinding('undo');
    expect(binding).toBeDefined();
    expect(binding?.id).toBe('undo');
    expect(binding?.enabled).toBe(true);
    expect(binding?.keys).toEqual({ key: 'z', ctrl: true });
  });

  it('应该能通过 setBinding 更新快捷键按键', () => {
    useShortcutStore.getState().setBinding('undo', { key: 'y', ctrl: true });
    const binding = useShortcutStore.getState().getBinding('undo');
    expect(binding?.keys).toEqual({ key: 'y', ctrl: true });
  });

  it('应该能通过 resetBinding 重置单个快捷键到默认', () => {
    useShortcutStore.getState().setBinding('undo', { key: 'y', ctrl: true });
    useShortcutStore.getState().resetBinding('undo');
    const binding = useShortcutStore.getState().getBinding('undo');
    const defaultShortcut = DEFAULT_SHORTCUTS.find((s) => s.id === 'undo');
    expect(binding?.keys).toEqual(defaultShortcut?.defaultKeys);
    expect(binding?.enabled).toBe(true);
  });

  it('应该能通过 resetAllBindings 重置所有快捷键到默认', () => {
    useShortcutStore.getState().setBinding('undo', { key: 'x', ctrl: true });
    useShortcutStore.getState().setBinding('save', { key: 'a', ctrl: true });
    useShortcutStore.getState().resetAllBindings();
    const undoBinding = useShortcutStore.getState().getBinding('undo');
    const saveBinding = useShortcutStore.getState().getBinding('save');
    const defaultUndo = DEFAULT_SHORTCUTS.find((s) => s.id === 'undo');
    const defaultSave = DEFAULT_SHORTCUTS.find((s) => s.id === 'save');
    expect(undoBinding?.keys).toEqual(defaultUndo?.defaultKeys);
    expect(saveBinding?.keys).toEqual(defaultSave?.defaultKeys);
  });

  it('应该能通过 toggleShortcut 禁用和启用快捷键', () => {
    useShortcutStore.getState().toggleShortcut('undo', false);
    expect(useShortcutStore.getState().getBinding('undo')?.enabled).toBe(false);
    useShortcutStore.getState().toggleShortcut('undo', true);
    expect(useShortcutStore.getState().getBinding('undo')?.enabled).toBe(true);
  });

  it('应该能通过 setEnabled 设置全局启用状态', () => {
    useShortcutStore.getState().setEnabled(false);
    expect(useShortcutStore.getState().enabled).toBe(false);
  });

  it('应该能通过 getKeyForAction 获取已启用快捷键的按键', () => {
    const keys = useShortcutStore.getState().getKeyForAction('undo');
    expect(keys).toEqual({ key: 'z', ctrl: true });
  });

  it('getKeyForAction 应跳过被禁用的快捷键', () => {
    // redo 有两个绑定：redo (ctrl+z+shift) 和 redo-alt (ctrl+y)
    useShortcutStore.getState().toggleShortcut('redo', false);
    const keys = useShortcutStore.getState().getKeyForAction('redo');
    const redoAlt = DEFAULT_SHORTCUTS.find((s) => s.id === 'redo-alt');
    expect(keys).toEqual(redoAlt?.defaultKeys);
  });

  it('应该能通过 getAllShortcuts 获取所有快捷键定义', () => {
    const shortcuts = useShortcutStore.getState().getAllShortcuts();
    expect(shortcuts).toHaveLength(DEFAULT_SHORTCUTS.length);
    expect(shortcuts).toBe(DEFAULT_SHORTCUTS);
  });

  it('应该能通过 getShortcutsByCategory 按分类获取快捷键', () => {
    const grouped = useShortcutStore.getState().getShortcutsByCategory();
    expect(grouped['editing']).toBeDefined();
    expect(grouped['editing'].length).toBeGreaterThan(0);
    expect(grouped['view']).toBeDefined();
    expect(grouped['general']).toBeDefined();
  });
});
