import { describe, it, expect } from 'vitest';
import {
  QUIZ_FONT_SIZE_MIN,
  QUIZ_FONT_SIZE_MAX,
  QUIZ_FONT_SIZE_DEFAULT,
  resolveLineHeightValue,
  resolvePrimaryTextStyle,
  resolveSecondaryTextStyle,
  resolveFlashWidthClass,
  resolveFocusWidthClass,
} from '../quizTypography';
import type { UserSettingsLineHeight, UserSettingsContentWidthMode } from '@shared/types';

const LH = ['compact', 'normal', 'relaxed'] satisfies UserSettingsLineHeight[];
const WD: UserSettingsContentWidthMode[] = ['narrow', 'comfortable', 'full'];

describe('quizTypography', () => {
  describe('字号常量', () => {
    it('字号范围与默认值符合学习资料设置（12~28，默认 16）', () => {
      expect(QUIZ_FONT_SIZE_MIN).toBe(12);
      expect(QUIZ_FONT_SIZE_MAX).toBe(28);
      expect(QUIZ_FONT_SIZE_DEFAULT).toBe(16);
    });
  });

  describe('resolveLineHeightValue', () => {
    it('compact = 1.375', () => {
      expect(resolveLineHeightValue('compact')).toBe(1.375);
    });
    it('normal = 1.6', () => {
      expect(resolveLineHeightValue('normal')).toBe(1.6);
    });
    it('relaxed = 1.8', () => {
      expect(resolveLineHeightValue('relaxed')).toBe(1.8);
    });
    it('未知值回退到 normal', () => {
      expect(resolveLineHeightValue('unknown' as UserSettingsLineHeight)).toBe(1.6);
    });
  });

  describe('resolvePrimaryTextStyle', () => {
    it('输出主文本字号 + 对应行高', () => {
      expect(resolvePrimaryTextStyle(16, 'compact')).toEqual({
        fontSize: '16px',
        lineHeight: 1.375,
      });
    });
    it('行高跟随 lineHeight 设置', () => {
      expect(resolvePrimaryTextStyle(20, 'relaxed').lineHeight).toBe(1.8);
    });
  });

  describe('resolveSecondaryTextStyle', () => {
    it('次文字按 0.875 缩放并四舍五入', () => {
      // 16 * 0.875 = 14
      expect(resolveSecondaryTextStyle(16, 'normal')).toEqual({
        fontSize: '14px',
        lineHeight: 1.6,
      });
    });
    it('不能低于 11px 下限（极小字号时保护可读性）', () => {
      // 12 * 0.875 = 10.5 → Math.round = 11 → max(11, 11) = 11
      expect(resolveSecondaryTextStyle(12, 'normal').fontSize).toBe('11px');
    });
    it('行高跟随主设置', () => {
      expect(resolveSecondaryTextStyle(20, 'relaxed').lineHeight).toBe(1.8);
    });
  });

  describe('resolveFlashWidthClass', () => {
    it.each([
      ['narrow', 'max-w-xl'],
      ['comfortable', 'max-w-3xl'],
      ['full', 'max-w-5xl'],
    ] as const)('%s → %s', (mode, cls) => {
      expect(resolveFlashWidthClass(mode)).toBe(cls);
    });
    it('未知值回退到 comfortable', () => {
      expect(resolveFlashWidthClass('weird' as UserSettingsContentWidthMode)).toBe('max-w-3xl');
    });
  });

  describe('resolveFocusWidthClass', () => {
    it.each([
      ['narrow', 'max-w-5xl'],
      ['comfortable', 'max-w-7xl'],
      ['full', 'max-w-none'],
    ] as const)('%s → %s', (mode, cls) => {
      expect(resolveFocusWidthClass(mode)).toBe(cls);
    });
  });

  describe('覆盖全部合法取值（防止遗漏分支）', () => {
    it('所有行高值都可映射', () => {
      for (const lh of LH) {
        expect(Number.isFinite(resolveLineHeightValue(lh))).toBe(true);
      }
    });
    it('所有宽度模式在两种布局下都可映射', () => {
      for (const wd of WD) {
        expect(resolveFlashWidthClass(wd)).toMatch(/^max-w/);
        expect(resolveFocusWidthClass(wd)).toMatch(/^max-w/);
      }
    });
  });
});