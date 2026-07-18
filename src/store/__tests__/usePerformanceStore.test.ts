// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { usePerformanceStore } from '../usePerformanceStore';

describe('usePerformanceStore', () => {
  beforeEach(() => {
    usePerformanceStore.setState({
      quality: 'high',
      showStats: false,
      fps: 0,
    });
  });

  it('应该有正确的初始状态', () => {
    const state = usePerformanceStore.getState();
    expect(state.quality).toBe('high');
    expect(state.showStats).toBe(false);
    expect(state.fps).toBe(0);
  });

  it('应该能通过 setQuality 更新画质等级', () => {
    usePerformanceStore.getState().setQuality('low');
    expect(usePerformanceStore.getState().quality).toBe('low');
  });

  it('应该能通过 toggleStats 切换统计显示', () => {
    expect(usePerformanceStore.getState().showStats).toBe(false);
    usePerformanceStore.getState().toggleStats();
    expect(usePerformanceStore.getState().showStats).toBe(true);
    usePerformanceStore.getState().toggleStats();
    expect(usePerformanceStore.getState().showStats).toBe(false);
  });

  it('应该能通过 setFps 更新帧率', () => {
    usePerformanceStore.getState().setFps(60);
    expect(usePerformanceStore.getState().fps).toBe(60);
  });

  it('应该能重置到初始状态', () => {
    usePerformanceStore.getState().setQuality('low');
    usePerformanceStore.getState().toggleStats();
    usePerformanceStore.getState().setFps(30);
    usePerformanceStore.setState({
      quality: 'high',
      showStats: false,
      fps: 0,
    });
    const state = usePerformanceStore.getState();
    expect(state.quality).toBe('high');
    expect(state.showStats).toBe(false);
    expect(state.fps).toBe(0);
  });
});
