// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SlideIn } from '../SlideIn';

const mockState = vi.hoisted(() => ({
  reduceMotion: false,
  transitionOverride: undefined as { duration: number } | undefined,
}));

vi.mock('../../../hooks/common/useReducedMotionOrPreference', () => ({
  useReducedMotionOrPreference: vi.fn(() => ({
    reduceMotion: mockState.reduceMotion,
    transitionOverride: mockState.transitionOverride,
  })),
}));

describe('SlideIn', () => {
  beforeEach(() => {
    mockState.reduceMotion = false;
    mockState.transitionOverride = undefined;
  });

  it('renders children', () => {
    render(
      <SlideIn>
        <div>Hello</div>
      </SlideIn>,
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('applies initial opacity 0', () => {
    const { container } = render(
      <SlideIn>
        <div>Test</div>
      </SlideIn>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.opacity).toBe('0');
  });

  it('default direction up translates initial y 30px', () => {
    const { container } = render(
      <SlideIn>
        <div>Up</div>
      </SlideIn>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.transform).toMatch(/translateY\(30px\)/);
  });

  it('direction left translates initial x 30px', () => {
    const { container } = render(
      <SlideIn direction="left">
        <div>Left</div>
      </SlideIn>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.transform).toMatch(/translateX\(30px\)/);
  });

  it('direction right translates initial x -30px', () => {
    const { container } = render(
      <SlideIn direction="right">
        <div>Right</div>
      </SlideIn>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.transform).toMatch(/translateX\(-30px\)/);
  });

  it('direction down translates initial y -30px', () => {
    const { container } = render(
      <SlideIn direction="down">
        <div>Down</div>
      </SlideIn>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.transform).toMatch(/translateY\(-30px\)/);
  });

  it('applies custom className', () => {
    const { container } = render(
      <SlideIn className="custom-slide">
        <div>Styled</div>
      </SlideIn>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass('custom-slide');
  });

  it('reducedMotion skips translate (initial x and y are 0)', () => {
    mockState.reduceMotion = true;
    mockState.transitionOverride = { duration: 0 };

    const { container } = render(
      <SlideIn direction="left">
        <div>Reduced</div>
      </SlideIn>,
    );
    const el = container.firstChild as HTMLElement;
    // When reduceMotion is true, initial translate should be 0 (none = no transform)
    expect(el.style.transform).toBe('none');
    // Opacity should still be 0
    expect(el.style.opacity).toBe('0');
  });
});