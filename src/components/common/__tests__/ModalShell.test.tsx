// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModalShell } from '../ModalShell';

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

describe('ModalShell', () => {
  beforeEach(() => {
    mockState.reduceMotion = false;
    mockState.transitionOverride = undefined;
  });

  it('renders children when isOpen is true', () => {
    render(
      <ModalShell isOpen onClose={() => {}}>
        <div>Modal content</div>
      </ModalShell>,
    );
    expect(screen.getByText('Modal content')).toBeInTheDocument();
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(
      <ModalShell isOpen={false} onClose={() => {}}>
        <div>Modal content</div>
      </ModalShell>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('calls onClose when clicking the overlay itself', () => {
    const onClose = vi.fn();
    const { container } = render(
      <ModalShell isOpen onClose={onClose}>
        <div>Modal content</div>
      </ModalShell>,
    );

    const overlay = container.firstChild as HTMLElement;
    overlay.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
      }),
    );

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('reducedMotion still renders children', () => {
    mockState.reduceMotion = true;
    mockState.transitionOverride = { duration: 0 };

    render(
      <ModalShell isOpen onClose={() => {}}>
        <div>Reduced content</div>
      </ModalShell>,
    );
    expect(screen.getByText('Reduced content')).toBeInTheDocument();
  });
});