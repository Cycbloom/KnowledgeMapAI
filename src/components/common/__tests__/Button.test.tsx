// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../Button';

describe('Button', () => {
  it('renders children and the button element with role button', () => {
    render(<Button>确认</Button>);
    const button = screen.getByRole('button', { name: '确认' });
    expect(button).toBeInTheDocument();
    expect(button.tagName).toBe('BUTTON');
  });

  it("applying variant 'danger' adds 'bg-red-600' to className", () => {
    render(<Button variant="danger">删除</Button>);
    expect(screen.getByRole('button', { name: '删除' })).toHaveClass('bg-red-600');
  });

  it('base class includes press feedback utilities', () => {
    render(<Button>按下</Button>);
    const button = screen.getByRole('button', { name: '按下' });
    expect(button).toHaveClass('active:scale-[0.98]');
    expect(button).toHaveClass('motion-reduce:active:scale-100');
  });

  it('disabled prop disables the button', () => {
    render(<Button disabled>禁用</Button>);
    expect(screen.getByRole('button', { name: '禁用' })).toBeDisabled();
  });

  it('loading prop disables the button, sets aria-busy and renders Loader icon', () => {
    render(<Button loading>加载中</Button>);
    const button = screen.getByRole('button', { name: '加载中' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    const loader = button.querySelector('.animate-spin');
    expect(loader).toBeInTheDocument();
  });
});