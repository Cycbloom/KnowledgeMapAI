// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, screen, cleanup } from '@testing-library/react';
import { renderWithProviders } from '../../../../tests/helpers/renderWithProviders';
import { HighlightedReader } from '../HighlightedReader';
import { useFocusStore } from '../../../store/useFocusStore';

// 回归测试：高亮仍以 DOM 替换实现（分析与作用共用 collectTextNodes 同一文本流，
// 位置不偏移），但新增「变更日志 + 生命周期守卫」：
// 1. applyHighlightsToDom 记录被替换的原始文本节点；
// 2. HighlightDomGuard.getSnapshotBeforeUpdate 在 React mutation 之前把原始节点
//    原位放回，React 在与虚拟 DOM 一致的树上做增删；
// 3. componentDidUpdate（绘制前）同步原位重绘同一批 ranges。
// 覆盖旧缺陷：直接 replaceChild 后 React 删除节点抛
// "NotFoundError: Failed to execute 'removeChild' ... not a child"。
describe('HighlightedReader', () => {
  const originalRaf = globalThis.requestAnimationFrame;
  const originalCaf = globalThis.cancelAnimationFrame;

  beforeEach(() => {
    vi.useFakeTimers();
    // 在任何组件挂载前重置，避免触发已挂载组件的 re-render
    // intensity=1.0 → 密度阈值 0.3，两处【】高亮（5/18≈0.28）均可入选
    useFocusStore.setState({ highlightEnabled: true, highlightIntensity: 1.0 });
    // jsdom 未实现 requestAnimationFrame，同步执行回调使高亮在假定时器下即时生效
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCaf;
  });

  const commonProps = {
    isDark: false,
    isMobile: false,
  };

  it('切换内容（结构变化触发删除）不抛 removeChild 错误，且过期高亮被清理', () => {
    // 两段均含可命中的高亮模式，切换后仅剩一段，迫使 React 删除含高亮的节点。
    // 段间正文拉开到 >5 字符，避免 analyzeTextLocally 的「间隔≤5 合并」
    // 将两个关键词合并为跨段 range（该合并是既有行为，与本守卫无关）。
    const contentA = '【概念一】这里是第一段的正文内容，篇幅稍长。\n\n【概念二】这里是第二段的正文内容，篇幅稍长。';
    const { rerender } = renderWithProviders(
      <HighlightedReader content={contentA} {...commonProps} />,
    );

    // 推进 300ms 防抖计时，触发高亮分析并应用到 DOM
    act(() => {
      vi.advanceTimersByTime(400);
    });

    const spans = document.querySelectorAll<HTMLElement>('[data-highlight="true"]');
    expect(spans.length).toBeGreaterThan(0);
    expect(Array.from(spans).map((s) => s.textContent)).toEqual(['【概念一】', '【概念二】']);

    // 守卫须在 mutation 前还原原始节点，React 删除第二个段落时不抛 NotFoundError
    const contentB = '只剩单段。';
    expect(() =>
      rerender(<HighlightedReader content={contentB} {...commonProps} />),
    ).not.toThrow();

    expect(screen.getByText('只剩单段。')).toBeVisible();
    // 内容已变：守卫还原后不重绘旧 ranges（防止旧偏移落到新文本）
    expect(document.querySelectorAll('[data-highlight="true"]')).toHaveLength(0);

    // 内容变化后防抖重新分析，新内容无匹配 → 保持无高亮
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(document.querySelectorAll('[data-highlight="true"]')).toHaveLength(0);
  });

  it('内容不变的重渲染（如主题切换）原位重绘高亮，落点与文本完全一致', () => {
    const contentA = '【概念一】第一段。';
    const { rerender } = renderWithProviders(
      <HighlightedReader content={contentA} {...commonProps} />,
    );

    act(() => {
      vi.advanceTimersByTime(400);
    });

    const spansBefore = document.querySelectorAll<HTMLElement>('[data-highlight="true"]');
    expect(spansBefore.length).toBeGreaterThan(0);
    const textsBefore = Array.from(spansBefore).map((s) => s.textContent);

    // 主题切换：内容不变 → 守卫还原 + 原位重绘，高亮文本逐字一致（无偏移）
    rerender(<HighlightedReader content={contentA} isDark={true} isMobile={false} />);

    const spansAfter = document.querySelectorAll<HTMLElement>('[data-highlight="true"]');
    expect(spansAfter.length).toBe(spansBefore.length);
    expect(Array.from(spansAfter).map((s) => s.textContent)).toEqual(textsBefore);
    // 高亮 span 仍在文档流内（未被还原后遗忘）
    expect(spansAfter[0].textContent).toBe('【概念一】');
    expect(screen.getByText(/第一段/)).toBeVisible();
  });

  it('关闭高亮开关后清除 DOM 中的高亮 span，原文完整', () => {
    const contentA = '【概念一】第一段。';
    renderWithProviders(<HighlightedReader content={contentA} {...commonProps} />);

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(
      document.querySelectorAll<HTMLElement>('[data-highlight="true"]').length,
    ).toBeGreaterThan(0);

    // highlightEnabled 来自 useFocusStore 而非 props
    act(() => {
      useFocusStore.setState({ highlightEnabled: false });
    });

    expect(document.querySelectorAll('[data-highlight="true"]')).toHaveLength(0);
    // 原始文本保持完整（还原的是 React 原节点，非重建文本）
    expect(screen.getByText(/概念一/)).toBeVisible();
  });
});
