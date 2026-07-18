// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from '../useThemeStore';

describe('useThemeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({
      themeMode: 'system',
      themePreset: 'default',
    });
  });

  it('应该有正确的初始状态', () => {
    const state = useThemeStore.getState();
    expect(state.themeMode).toBe('system');
    expect(state.themePreset).toBe('default');
  });

  it('应该能通过 setThemeMode 更新主题模式', () => {
    useThemeStore.getState().setThemeMode('dark');
    expect(useThemeStore.getState().themeMode).toBe('dark');
  });

  it('应该能通过 setThemePreset 更新主题预设', () => {
    useThemeStore.getState().setThemePreset('forest');
    expect(useThemeStore.getState().themePreset).toBe('forest');
  });

  it('应该能切换回初始值实现重置', () => {
    useThemeStore.getState().setThemeMode('dark');
    useThemeStore.getState().setThemePreset('forest');
    useThemeStore.setState({
      themeMode: 'system',
      themePreset: 'default',
    });
    const state = useThemeStore.getState();
    expect(state.themeMode).toBe('system');
    expect(state.themePreset).toBe('default');
  });
});
