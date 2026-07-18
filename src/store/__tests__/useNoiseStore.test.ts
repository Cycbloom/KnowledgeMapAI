// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useNoiseStore, type MixedNoise, type NoisePreset } from '../useNoiseStore';

describe('useNoiseStore', () => {
  beforeEach(() => {
    // 使用假定时器以控制 Date.now()，避免 saveCustomPreset 在同一毫秒内
    // 生成重复的 preset_${Date.now()} ID
    vi.useFakeTimers();
    useNoiseStore.setState({
      selectedNoise: 'none',
      noiseVolume: 0.5,
      mixedNoises: [],
      customPresets: [],
      activePresetId: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('应该有正确的初始状态', () => {
    const state = useNoiseStore.getState();
    expect(state.selectedNoise).toBe('none');
    expect(state.noiseVolume).toBe(0.5);
    expect(state.mixedNoises).toEqual([]);
    expect(state.customPresets).toEqual([]);
    expect(state.activePresetId).toBe(null);
  });

  it('应该能通过 setNoise 更新选中的噪音类型', () => {
    useNoiseStore.getState().setNoise('rain');
    expect(useNoiseStore.getState().selectedNoise).toBe('rain');
  });

  it('应该能通过 setNoiseVolume 更新音量', () => {
    useNoiseStore.getState().setNoiseVolume(0.8);
    expect(useNoiseStore.getState().noiseVolume).toBe(0.8);
  });

  it('应该能通过 addMixedNoise 添加混合噪音', () => {
    const noise: MixedNoise = { type: 'rain', volume: 0.5 };
    useNoiseStore.getState().addMixedNoise(noise);
    expect(useNoiseStore.getState().mixedNoises).toEqual([noise]);
  });

  it('addMixedNoise 对已存在的类型应更新而非添加', () => {
    useNoiseStore.getState().addMixedNoise({ type: 'rain', volume: 0.3 });
    useNoiseStore.getState().addMixedNoise({ type: 'rain', volume: 0.7 });
    const mixed = useNoiseStore.getState().mixedNoises;
    expect(mixed).toHaveLength(1);
    expect(mixed[0].volume).toBe(0.7);
  });

  it('应该能通过 removeMixedNoise 移除混合噪音', () => {
    useNoiseStore.getState().addMixedNoise({ type: 'rain', volume: 0.5 });
    useNoiseStore.getState().addMixedNoise({ type: 'wind', volume: 0.3 });
    useNoiseStore.getState().removeMixedNoise('rain');
    const mixed = useNoiseStore.getState().mixedNoises;
    expect(mixed).toHaveLength(1);
    expect(mixed[0].type).toBe('wind');
  });

  it('应该能通过 updateMixedNoiseVolume 更新指定噪音音量', () => {
    useNoiseStore.getState().addMixedNoise({ type: 'rain', volume: 0.5 });
    useNoiseStore.getState().updateMixedNoiseVolume('rain', 0.9);
    expect(useNoiseStore.getState().mixedNoises[0].volume).toBe(0.9);
  });

  it('应该能通过 clearMixedNoises 清空混合噪音和预设ID', () => {
    useNoiseStore.getState().addMixedNoise({ type: 'rain', volume: 0.5 });
    useNoiseStore.getState().setActivePresetId('preset-1');
    useNoiseStore.getState().clearMixedNoises();
    const state = useNoiseStore.getState();
    expect(state.mixedNoises).toEqual([]);
    expect(state.activePresetId).toBe(null);
  });

  it('应该能通过 saveCustomPreset 保存当前混合噪音为预设', () => {
    useNoiseStore.getState().addMixedNoise({ type: 'rain', volume: 0.5 });
    useNoiseStore.getState().addMixedNoise({ type: 'wind', volume: 0.3 });
    useNoiseStore.getState().saveCustomPreset('我的预设');
    const state = useNoiseStore.getState();
    expect(state.customPresets).toHaveLength(1);
    expect(state.customPresets[0].name).toBe('我的预设');
    expect(state.customPresets[0].noises).toHaveLength(2);
    expect(state.customPresets[0].isBuiltIn).toBe(false);
    expect(state.activePresetId).toBe(state.customPresets[0].id);
  });

  it('saveCustomPreset 在无混合噪音时不应保存', () => {
    useNoiseStore.getState().saveCustomPreset('空预设');
    expect(useNoiseStore.getState().customPresets).toEqual([]);
  });

  it('应该能通过 deleteCustomPreset 删除预设', () => {
    useNoiseStore.getState().addMixedNoise({ type: 'rain', volume: 0.5 });
    useNoiseStore.getState().saveCustomPreset('预设A');
    const presetId = useNoiseStore.getState().customPresets[0].id;
    useNoiseStore.getState().deleteCustomPreset(presetId);
    expect(useNoiseStore.getState().customPresets).toEqual([]);
    expect(useNoiseStore.getState().activePresetId).toBe(null);
  });

  it('deleteCustomPreset 删除非活跃预设时不应改变 activePresetId', () => {
    useNoiseStore.getState().addMixedNoise({ type: 'rain', volume: 0.5 });
    useNoiseStore.getState().saveCustomPreset('预设A');
    // 推进时间以确保下一次 saveCustomPreset 生成唯一的 preset ID
    vi.advanceTimersByTime(1);
    useNoiseStore.getState().addMixedNoise({ type: 'wind', volume: 0.3 });
    useNoiseStore.getState().saveCustomPreset('预设B');
    const firstPresetId = useNoiseStore.getState().customPresets[0].id;
    useNoiseStore.getState().deleteCustomPreset(firstPresetId);
    expect(useNoiseStore.getState().activePresetId).not.toBe(null);
  });

  it('应该能通过 loadPreset 加载预设', () => {
    const preset: NoisePreset = {
      id: 'preset-test',
      name: '测试预设',
      noises: [
        { type: 'rain', volume: 0.6 },
        { type: 'thunder', volume: 0.4 },
      ],
    };
    useNoiseStore.getState().loadPreset(preset);
    const state = useNoiseStore.getState();
    expect(state.mixedNoises).toHaveLength(2);
    expect(state.mixedNoises[0].type).toBe('rain');
    expect(state.activePresetId).toBe('preset-test');
  });

  it('应该能通过 setActivePresetId 设置活跃预设ID', () => {
    useNoiseStore.getState().setActivePresetId('preset-x');
    expect(useNoiseStore.getState().activePresetId).toBe('preset-x');
  });
});
