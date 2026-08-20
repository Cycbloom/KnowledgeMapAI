import { describe, it, expect } from 'vitest';
import {
  resolveLineHeightValue,
  resolvePrimaryTextStyle,
  resolveSecondaryTextStyle,
  resolveFlashWidthClass,
  resolveFocusWidthClass,
  QUIZ_FONT_SIZE_MIN,
  QUIZ_FONT_SIZE_MAX,
  QUIZ_FONT_SIZE_DEFAULT,
} from '../../src/utils/quizTypography';

describe('quizTypography 工具函数', () => {
  describe('resolveLineHeightValue', () => {
    it('compact → 1.375', () => {
      expect(resolveLineHeightValue('compact')).toBe(1.375);
    });

    it('normal → 1.6', () => {
      expect(resolveLineHeightValue('normal')).toBe(1.6);
    });

    it('relaxed → 1.8', () => {
      expect(resolveLineHeightValue('relaxed')).toBe(1.8);
    });
  });

  describe('resolvePrimaryTextStyle', () => {
    it('主文本字号为原文 + 对应行高', () => {
      expect(resolvePrimaryTextStyle(16, 'normal')).toEqual({
        fontSize: '16px',
        lineHeight: 1.6,
      });
      expect(resolvePrimaryTextStyle(20, 'compact')).toEqual({
        fontSize: '20px',
        lineHeight: 1.375,
      });
    });
  });

  describe('resolveSecondaryTextStyle', () => {
    it('次文本按 0.875 缩放主字号', () => {
      expect(resolveSecondaryTextStyle(16, 'normal')).toEqual({
        fontSize: '14px',
        lineHeight: 1.6,
      });
    });

    it('小字号下最小为 11px，不因缩放过小导致不可读', () => {
      const style = resolveSecondaryTextStyle(QUIZ_FONT_SIZE_MIN, 'normal');
      expect(style.fontSize).toBe('11px');
    });

    it('行高与主文本保持同一档位', () => {
      expect(resolveSecondaryTextStyle(16, 'relaxed').lineHeight).toBe(1.8);
    });
  });

  describe('resolveFlashWidthClass', () => {
    it('按内容宽度模式映射宽度类', () => {
      expect(resolveFlashWidthClass('full')).toBe('max-w-5xl');
      expect(resolveFlashWidthClass('comfortable')).toBe('max-w-3xl');
      expect(resolveFlashWidthClass('narrow')).toBe('max-w-xl');
    });
  });

  describe('resolveFocusWidthClass', () => {
    it('按内容宽度模式映射宽度类', () => {
      expect(resolveFocusWidthClass('full')).toBe('max-w-none');
      expect(resolveFocusWidthClass('comfortable')).toBe('max-w-7xl');
      expect(resolveFocusWidthClass('narrow')).toBe('max-w-5xl');
    });
  });

  describe('字号常量', () => {
    it('范围 12~28，默认 16', () => {
      expect(QUIZ_FONT_SIZE_MIN).toBe(12);
      expect(QUIZ_FONT_SIZE_MAX).toBe(28);
      expect(QUIZ_FONT_SIZE_DEFAULT).toBe(16);
    });
  });
});
