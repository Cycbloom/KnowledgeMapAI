import type {
  UserSettingsContentWidthMode,
  UserSettingsLineHeight,
} from '@shared/types';

/** 答题模式字号范围与默认值（与学习资料设置一致：12~28，默认 16） */
export const QUIZ_FONT_SIZE_MIN = 12;
export const QUIZ_FONT_SIZE_MAX = 28;
export const QUIZ_FONT_SIZE_DEFAULT = 16;

/** 次文本（选项 / 解析）相对主文本（题干 / 答案）的缩放比例 */
const QUIZ_SECONDARY_TEXT_RATIO = 0.875;

/** 将 lineHeight 设置映射为 CSS 行高数值 */
export function resolveLineHeightValue(
  lineHeight: UserSettingsLineHeight,
): number {
  switch (lineHeight) {
    case 'compact':
      return 1.375;
    case 'relaxed':
      return 1.8;
    case 'normal':
    default:
      return 1.6;
  }
}

/** 主文本（题干 / 答案）字号 + 行高，供 style 内联使用 */
export function resolvePrimaryTextStyle(
  fontSize: number,
  lineHeight: UserSettingsLineHeight,
): { fontSize: string; lineHeight: number } {
  return {
    fontSize: `${fontSize}px`,
    lineHeight: resolveLineHeightValue(lineHeight),
  };
}

/** 次文本（选项 / 解析）字号 + 行高，供 style 内联使用 */
export function resolveSecondaryTextStyle(
  fontSize: number,
  lineHeight: UserSettingsLineHeight,
): { fontSize: string; lineHeight: number } {
  return {
    fontSize: `${Math.max(11, Math.round(fontSize * QUIZ_SECONDARY_TEXT_RATIO))}px`,
    lineHeight: resolveLineHeightValue(lineHeight),
  };
}

/** 闪卡模式内容区宽度类（默认舒适 = 当前 max-w-3xl） */
export function resolveFlashWidthClass(
  mode: UserSettingsContentWidthMode,
): string {
  switch (mode) {
    case 'full':
      return 'max-w-5xl';
    case 'narrow':
      return 'max-w-xl';
    case 'comfortable':
    default:
      return 'max-w-3xl';
  }
}

/** 专注模式内容区宽度类（默认舒适 = 当前 max-w-7xl） */
export function resolveFocusWidthClass(
  mode: UserSettingsContentWidthMode,
): string {
  switch (mode) {
    case 'full':
      return 'max-w-none';
    case 'narrow':
      return 'max-w-5xl';
    case 'comfortable':
    default:
      return 'max-w-7xl';
  }
}
