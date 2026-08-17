// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TermTooltip } from '../TermTooltip';

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

describe('TermTooltip', () => {
  beforeEach(() => {
    mockState.reduceMotion = false;
    mockState.transitionOverride = undefined;
  });

  it('shows the explanation on mouse enter', () => {
    render(<TermTooltip term="术语" explanation="这是解释文本" />);

    const trigger = screen.getByText('术语');
    fireEvent.mouseEnter(trigger);

    expect(screen.getByText('这是解释文本')).toBeInTheDocument();
  });

  it('hides the explanation on mouse leave instantly with reduced motion', async () => {
    mockState.reduceMotion = true;
    mockState.transitionOverride = { duration: 0 };

    render(<TermTooltip term="术语" explanation="这是解释文本" />);

    const trigger = screen.getByText('术语');
    fireEvent.mouseEnter(trigger);

    expect(screen.getByText('这是解释文本')).toBeInTheDocument();

    fireEvent.mouseLeave(trigger);

    await waitFor(() => {
      expect(screen.queryByText('这是解释文本')).toBeNull();
    });
  });
});