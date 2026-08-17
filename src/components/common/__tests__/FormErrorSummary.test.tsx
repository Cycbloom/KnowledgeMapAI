// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormErrorSummary } from '../FormErrorSummary';

const errors = [
  { field: 'title', message: '请输入标题' },
  { field: 'url', message: 'URL 格式无效' },
];

describe('FormErrorSummary', () => {
  it('renders nothing when errors is empty', () => {
    const { container } = render(<FormErrorSummary errors={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the alert role and the error messages when errors are provided', () => {
    render(<FormErrorSummary errors={errors} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('2个字段有错误');
    expect(screen.getByText('请输入标题')).toBeInTheDocument();
    expect(screen.getByText('URL 格式无效')).toBeInTheDocument();
  });

  it('clicking an error item invokes onFocusField with the field value', () => {
    const onFocusField = vi.fn();
    render(<FormErrorSummary errors={errors} onFocusField={onFocusField} />);

    fireEvent.click(screen.getByText('请输入标题'));
    expect(onFocusField).toHaveBeenCalledWith('title');

    fireEvent.click(screen.getByText('URL 格式无效'));
    expect(onFocusField).toHaveBeenCalledWith('url');
  });

  it('does not throw when onFocusField is not provided', () => {
    render(<FormErrorSummary errors={errors} />);

    expect(() => {
      fireEvent.click(screen.getByText('请输入标题'));
    }).not.toThrow();
  });
});