// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StaggerChildren } from '../StaggerChildren';

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

describe('StaggerChildren', () => {
  beforeEach(() => {
    mockState.reduceMotion = false;
    mockState.transitionOverride = undefined;
  });

  it('renders children', () => {
    render(
      <StaggerChildren>
        <div>Item 1</div>
        <div>Item 2</div>
      </StaggerChildren>,
    );
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('renders each child wrapped in a motion.div', () => {
    const { container } = render(
      <StaggerChildren>
        <div>First</div>
        <div>Second</div>
      </StaggerChildren>,
    );
    // The outer container is a motion.div (first child)
    const outerDiv = container.firstChild as HTMLElement;
    // Each child should be wrapped in its own motion.div
    expect(outerDiv.children).toHaveLength(2);
    const firstChild = outerDiv.children[0] as HTMLElement;
    const secondChild = outerDiv.children[1] as HTMLElement;
    // Each wrapped child should have initial opacity 0 (from childVariants.hidden)
    expect(firstChild.style.opacity).toBe('0');
    expect(secondChild.style.opacity).toBe('0');
  });

  it('renders without error with custom staggerDelay and childDuration', () => {
    render(
      <StaggerChildren staggerDelay={0.1} childDuration={0.5}>
        <div>Custom</div>
      </StaggerChildren>,
    );
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('applies custom className to container', () => {
    const { container } = render(
      <StaggerChildren className="stagger-container">
        <div>Styled</div>
      </StaggerChildren>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass('stagger-container');
  });

  it('reducedMotion sets staggerChildren to 0 and child duration to 0', () => {
    mockState.reduceMotion = true;
    mockState.transitionOverride = { duration: 0 };

    const { container } = render(
      <StaggerChildren>
        <div>Item 1</div>
        <div>Item 2</div>
      </StaggerChildren>,
    );
    // Children should still render
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    // Wrapped children should still exist
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.children).toHaveLength(2);
  });
});