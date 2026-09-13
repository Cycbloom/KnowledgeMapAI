import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useNotificationManager } from '../useNotificationManager';

describe('useNotificationManager', () => {
  beforeEach(() => {
    vi.useRealTimers();
    useNotificationManager.setState({ entries: [], queue: [], maxVisible: 3 });
  });

  it('show 在未满时进入 entries，同 id 再次 show 替换而非重复', () => {
    const { show } = useNotificationManager.getState();
    show({
      id: 'a',
      kind: 'k',
      priority: 1,
      status: 'info',
      dismissible: true,
      data: { v: 1 },
    });
    expect(useNotificationManager.getState().entries).toHaveLength(1);

    show({
      id: 'a',
      kind: 'k',
      priority: 2,
      status: 'success',
      dismissible: false,
      data: { v: 2 },
    });
    const state = useNotificationManager.getState();
    expect(state.entries).toHaveLength(1);
    expect(state.queue).toHaveLength(0);
    expect(state.entries[0]).toMatchObject({
      id: 'a',
      priority: 2,
      status: 'success',
      dismissible: false,
      data: { v: 2 },
    });
  });

  it('满额后 show 进入 queue，关闭一条后优先级最高者补位', () => {
    const show = (id: string, priority: number) =>
      useNotificationManager.getState().show({
        id,
        kind: 'k',
        priority,
        status: 'info',
        dismissible: true,
      });

    show('a', 1);
    show('b', 2);
    show('c', 3);
    expect(useNotificationManager.getState().entries.map((e) => e.id)).toEqual(['c', 'b', 'a']);
    expect(useNotificationManager.getState().queue).toHaveLength(0);

    show('d', 4);
    expect(useNotificationManager.getState().entries).toHaveLength(3);
    expect(useNotificationManager.getState().queue.map((e) => e.id)).toEqual(['d']);

    useNotificationManager.getState().dismiss('a');
    expect(useNotificationManager.getState().entries.map((e) => e.id)).toEqual(['d', 'c', 'b']);
    expect(useNotificationManager.getState().queue).toHaveLength(0);
  });

  it('queue 补位按 priority 降序，同 priority 先到先得', () => {
    const show = (id: string, priority: number) =>
      useNotificationManager.getState().show({
        id,
        kind: 'k',
        priority,
        status: 'info',
        dismissible: true,
      });

    show('a', 1);
    show('b', 1);
    show('c', 1);
    show('q1', 2);
    show('q2', 2);
    show('q3', 1);
    show('q4', 3);

    useNotificationManager.getState().dismiss('a');
    expect(useNotificationManager.getState().entries.map((e) => e.id)).toEqual(['q4', 'b', 'c']);
    expect(useNotificationManager.getState().queue.map((e) => e.id)).toEqual(['q1', 'q2', 'q3']);

    useNotificationManager.getState().dismiss('b');
    expect(useNotificationManager.getState().entries.map((e) => e.id)).toEqual(['q4', 'q1', 'c']);
    expect(useNotificationManager.getState().queue.map((e) => e.id)).toEqual(['q2', 'q3']);
  });

  it('dismiss 移除条目并清理定时器，被 dismiss 后不再自动触发', () => {
    vi.useFakeTimers();
    useNotificationManager.getState().show({
      id: 'a',
      kind: 'k',
      priority: 1,
      status: 'info',
      dismissible: true,
      autoDismissMs: 1000,
    });
    expect(useNotificationManager.getState().entries.map((e) => e.id)).toEqual(['a']);

    useNotificationManager.getState().dismiss('a');
    expect(useNotificationManager.getState().entries).toHaveLength(0);

    vi.advanceTimersByTime(5000);
    expect(useNotificationManager.getState().entries).toHaveLength(0);
    expect(useNotificationManager.getState().queue).toHaveLength(0);
    vi.useRealTimers();
  });

  it('clear(kind) 只清该类，clear() 清空全部（含 queue）', () => {
    const show = (id: string, kind: string) =>
      useNotificationManager.getState().show({
        id,
        kind,
        priority: 1,
        status: 'info',
        dismissible: true,
      });

    show('a', 'kind-a');
    show('b', 'kind-b');
    show('c', 'kind-a');
    show('d', 'kind-b');
    show('e', 'kind-a');

    useNotificationManager.getState().clear('kind-a');
    let state = useNotificationManager.getState();
    expect(state.entries.map((e) => e.id)).toEqual(['b', 'd']);
    expect(state.queue).toHaveLength(0);

    show('f', 'kind-a');
    show('g', 'kind-b');
    show('h', 'kind-a');

    useNotificationManager.getState().clear();
    state = useNotificationManager.getState();
    expect(state.entries).toHaveLength(0);
    expect(state.queue).toHaveLength(0);
  });

  it('update 合并字段并保留位置', () => {
    const show = (id: string, priority: number) =>
      useNotificationManager.getState().show({
        id,
        kind: 'k',
        priority,
        status: 'info',
        dismissible: true,
      });

    show('a', 1);
    show('b', 2);
    show('c', 3);
    expect(useNotificationManager.getState().entries.map((e) => e.id)).toEqual(['c', 'b', 'a']);

    useNotificationManager
      .getState()
      .update('b', { status: 'loading', priority: 5, data: { n: 1 } });
    const state = useNotificationManager.getState();
    expect(state.entries.map((e) => e.id)).toEqual(['c', 'b', 'a']);
    expect(state.entries[1]).toMatchObject({
      id: 'b',
      status: 'loading',
      priority: 5,
      data: { n: 1 },
    });
  });

  it('自动关闭：到期后条目消失，若有排队则补位', () => {
    vi.useFakeTimers();
    useNotificationManager.getState().setMaxVisible(1);
    useNotificationManager.getState().show({
      id: 'a',
      kind: 'k',
      priority: 1,
      status: 'info',
      dismissible: true,
      autoDismissMs: 1000,
    });
    useNotificationManager.getState().show({
      id: 'b',
      kind: 'k',
      priority: 2,
      status: 'info',
      dismissible: true,
    });
    expect(useNotificationManager.getState().entries.map((e) => e.id)).toEqual(['a']);
    expect(useNotificationManager.getState().queue.map((e) => e.id)).toEqual(['b']);

    vi.advanceTimersByTime(999);
    expect(useNotificationManager.getState().entries.map((e) => e.id)).toEqual(['a']);

    vi.advanceTimersByTime(1);
    expect(useNotificationManager.getState().entries.map((e) => e.id)).toEqual(['b']);
    expect(useNotificationManager.getState().queue).toHaveLength(0);
    vi.useRealTimers();
  });
});
