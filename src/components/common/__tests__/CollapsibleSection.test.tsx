// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CollapsibleSection } from '../CollapsibleSection';

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

describe('CollapsibleSection', () => {
  beforeEach(() => {
    mockState.reduceMotion = true;
    mockState.transitionOverride = { duration: 0 };
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    mockState.reduceMotion = false;
    mockState.transitionOverride = undefined;
  });

  it('renders title and children when open (default open true)', () => {
    render(
      <CollapsibleSection id="test" title="Section Title">
        <div>Child Content</div>
      </CollapsibleSection>,
    );

    expect(screen.getByText('Section Title')).toBeInTheDocument();
    expect(screen.getByText('Child Content')).toBeInTheDocument();
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Child Content').closest('[id="test-content"]')).toHaveAttribute(
      'aria-hidden',
      'false',
    );
  });

  it('clicking the header button collapses content (reduceMotion true)', async () => {
    render(
      <CollapsibleSection id="test" title="Section Title">
        <div>Child Content</div>
      </CollapsibleSection>,
    );

    const contentEl = screen.getByText('Child Content').closest('[id="test-content"]');
    expect(contentEl).toHaveAttribute('aria-hidden', 'false');

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(button).toHaveAttribute('aria-expanded', 'false');
    const collapsedContent = screen.getByText('Child Content').closest('[id="test-content"]');
    await waitFor(() => {
      expect(collapsedContent).toHaveAttribute('aria-hidden', 'true');
      expect(collapsedContent).toHaveStyle({ height: '0', opacity: '0' });
    });
  });

  it('clicking the header button toggles open again', () => {
    render(
      <CollapsibleSection id="test" title="Section Title" defaultOpen={false}>
        <div>Child Content</div>
      </CollapsibleSection>,
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Child Content').closest('[id="test-content"]')).toHaveAttribute(
      'aria-hidden',
      'false',
    );
  });
});