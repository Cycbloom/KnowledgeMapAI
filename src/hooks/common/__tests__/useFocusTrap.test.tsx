// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import React from 'react';
import { useFocusTrap } from '../useFocusTrap';

/**
 * JSDOM 的局限：
 * 1. element.focus() 不会更新 document.activeElement
 * 2. offsetParent 始终为 null（JSDOM 不做实际布局计算）
 * 3. Tab 键导航不移动焦点（浏览器行为，JSDOM 不实现）
 *
 * 以下补丁解决第 1、2 点，第 3 点通过手动设置 activeElement 来模拟。
 */
const originalFocus = HTMLElement.prototype.focus;
vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
  this: HTMLElement,
  options?: FocusOptions,
) {
  originalFocus.call(this, options);
  if (this.isConnected && this.ownerDocument) {
    Object.defineProperty(this.ownerDocument, 'activeElement', {
      value: this,
      writable: true,
      configurable: true,
    });
  }
});

// JSDOM 中 offsetParent 始终为 null，patch 为返回父元素
vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockImplementation(function (
  this: HTMLElement,
) {
  return this.parentElement;
});

function FocusTrapTestComponent({
  enabled = true,
  restoreFocus = true,
  initialFocus = 'first' as const,
}: {
  enabled?: boolean;
  restoreFocus?: boolean;
  initialFocus?: 'first' | 'last' | number;
}) {
  const containerRef = useFocusTrap<HTMLDivElement>({ enabled, restoreFocus, initialFocus });
  return (
    <div ref={containerRef as React.RefObject<HTMLDivElement>} data-testid="trap-container">
      <button>Button 1</button>
      <input />
      <a href="#">Link</a>
    </div>
  );
}

/** 辅助函数：手动设置 document.activeElement */
function setActiveElement(el: HTMLElement | null) {
  Object.defineProperty(document, 'activeElement', {
    value: el,
    writable: true,
    configurable: true,
  });
}

describe('useFocusTrap', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    setActiveElement(document.body);
  });

  it('激活时自动聚焦第一个可聚焦元素', () => {
    act(() => {
      render(<FocusTrapTestComponent />);
    });
    const button = document.querySelector('button');
    expect(document.activeElement).toBe(button);
  });

  it('在最后一个元素上按 Tab 应循环到第一个', () => {
    act(() => {
      render(<FocusTrapTestComponent />);
    });

    const button = document.querySelector('button') as HTMLButtonElement;
    const link = document.querySelector('a') as HTMLAnchorElement;

    // 模拟焦点在最后一个元素上
    setActiveElement(link);

    // 按 Tab — 应循环回第一个
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    });
    expect(document.activeElement).toBe(button);
  });

  it('在第一个元素上按 Shift+Tab 应循环到最后一个', () => {
    act(() => {
      render(<FocusTrapTestComponent />);
    });

    const button = document.querySelector('button') as HTMLButtonElement;
    const link = document.querySelector('a') as HTMLAnchorElement;

    // 模拟焦点在第一个元素上
    setActiveElement(button);

    // 按 Shift+Tab — 应循环回最后一个
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    });
    expect(document.activeElement).toBe(link);
  });

  it('停用时恢复焦点到之前聚焦的元素', () => {
    // 先创建一个外部按钮并聚焦
    const outsideButton = document.createElement('button');
    outsideButton.textContent = 'Outside';
    document.body.appendChild(outsideButton);
    outsideButton.focus();
    expect(document.activeElement).toBe(outsideButton);

    let unmount: () => void;
    act(() => {
      const result = render(<FocusTrapTestComponent />);
      unmount = result.unmount;
    });

    // 激活后焦点已移到容器内
    const trapButton = document.querySelector('[data-testid="trap-container"] button');
    expect(document.activeElement).toBe(trapButton);
    expect(document.activeElement).not.toBe(outsideButton);

    // 停用 trap
    act(() => {
      unmount();
    });

    // 焦点应恢复到之前聚焦的 outsideButton
    expect(document.activeElement).toBe(outsideButton);
  });
});