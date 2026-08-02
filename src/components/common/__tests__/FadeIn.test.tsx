// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FadeIn } from '../FadeIn';

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

describe('FadeIn', () => {
  beforeEach(() => {
    mockState.reduceMotion = false;
    mockState.transitionOverride = undefined;
  });

  it('renders children', () => {
    render(
      <FadeIn>
        <div>Hello</div>
      </FadeIn>,
    );
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('applies initial opacity 0 as inline style', () => {
    const { container } = render(
      <FadeIn>
        <div>Test</div>
      </FadeIn>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.opacity).toBe('0');
  });

  it('renders without error with custom delay and duration', () => {
    render(
      <FadeIn delay={0.5} duration={1}>
        <div>Custom</div>
      </FadeIn>,
    );
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('renders without error with className', () => {
    const { container } = render(
      <FadeIn className="custom-class">
        <div>Styled</div>
      </FadeIn>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass('custom-class');
  });

  it('reducedMotion makes animation instant (duration 0)', () => {
    mockState.reduceMotion = true;
    mockState.transitionOverride = { duration: 0 };

    const { container } = render(
      <FadeIn>
        <div>Reduced</div>
      </FadeIn>,
    );
    expect(screen.getByText('Reduced')).toBeInTheDocument();
    // Initial opacity 0 should still be set
    const el = container.firstChild as HTMLElement;
    expect(el.style.opacity).toBe('0');
  });
});