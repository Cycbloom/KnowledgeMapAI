// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderWithProviders } from '../../helpers/renderWithProviders';
import { FocusTopicBadge } from '../../../src/components/Study/common';

describe('FocusTopicBadge', () => {
  describe('有值时', () => {
    it('variant="pill" 输出包含 focusTopic 值和"考察点"文字', () => {
      const { container } = renderWithProviders(
        <FocusTopicBadge focusTopic="二叉树遍历" variant="pill" />,
      );
      expect(container.innerHTML).toContain('考察点');
      expect(container.innerHTML).toContain('二叉树遍历');
    });

    it('variant="text" 输出包含 focusTopic 值和"考察点"文字', () => {
      const { container } = renderWithProviders(
        <FocusTopicBadge focusTopic="动态规划基础" variant="text" />,
      );
      expect(container.innerHTML).toContain('考察点');
      expect(container.innerHTML).toContain('动态规划基础');
    });
  });

  describe('无值时不渲染', () => {
    it('focusTopic 为 null 时 container.innerHTML firstChild 为空', () => {
      const { container } = renderWithProviders(
        <FocusTopicBadge focusTopic={null} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('focusTopic 为 undefined 时不渲染', () => {
      const { container } = renderWithProviders(
        <FocusTopicBadge focusTopic={undefined} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('focusTopic 为空字符串时不渲染', () => {
      const { container } = renderWithProviders(
        <FocusTopicBadge focusTopic="" />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('focusTopic 为纯空白字符串时不渲染', () => {
      const { container } = renderWithProviders(
        <FocusTopicBadge focusTopic="   " />,
      );
      expect(container.firstChild).toBeNull();
    });
  });
});
