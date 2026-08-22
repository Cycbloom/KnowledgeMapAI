// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../../tests/helpers/renderWithProviders';
import { HighlightedReader } from '../HighlightedReader';
import { useFocusStore } from '../../../store/useFocusStore';

// 回归测试：高亮通过 React 渲染（而非手动修改 React 管理的 DOM）。
// 旧的实现直接对渲染出的 DOM 做 replaceChild，导致 React 虚拟 DOM 与真实
// DOM 失同步，内容切换（如切换材料语言）时 React 删除节点抛出
// "NotFoundError: Failed to execute 'removeChild' ... not a child"。
describe('HighlightedReader', () => {
  const rafMock = vi.fn();
  const originalRaf = globalThis.requestAnimationFrame;
  const originalCaf = globalThis.cancelAnimationFrame;

  beforeEach(() => {
    vi.useFakeTimers();
    // 在任何组件挂载前重置，避免触发已挂载组件的 re-render
    useFocusStore.setState({ highlightEnabled: true, highlightIntensity: 0.5 });
    // jsdom 未实现 requestAnimationFrame，同步执行回调使高亮在假定时器下即时生效
    rafMock.mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    globalThis.requestAnimationFrame = rafMock;
    globalThis.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.requestAnimationFrame = originalRaf as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCaf as typeof cancelAnimationFrame;
  });

  const commonProps = {
    isDark: false,
    isMobile: false,
  };

  it('应通过 React 渲染高亮 span，且切换内容后不抛 removeChild 错误', () => {
    // 两段均含可命中的高亮模式，切换后仅剩一段，迫使 React 删除含高亮的节点
    const contentA = '【概念一】第一段。\n\n【概念二】第二段。';
    const { rerender } = renderWithProviders(
      <HighlightedReader content={contentA} {...commonProps} />,
    );

    // 推进 300ms 防抖计时，触发高亮分析并由 React 渲染高亮 span
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(document.querySelectorAll('[data-highlight="true"]').length).toBeGreaterThan(0);

    const contentB = '只剩单段。';
    expect(() => rerender(<HighlightedReader content={contentB} {...commonProps} />)).not.toThrow();

    expect(screen.getByText('只剩单段。')).toBeVisible();

    // 内容变化后防抖重新分析，新内容无匹配 → 高亮被清空，无残留节点
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(document.querySelectorAll('[data-highlight="true"]')).toHaveLength(0);
  });
});
