export const TITLE_CONFIG = {
  MAX_TITLE_LENGTH_CN: 10,
  MAX_TITLE_LENGTH_EN: 22,
  ELLIPSIS: '...'
} as const;

export interface TruncateResult {
  truncated: string;
  isTruncated: boolean;
  original: string;
  isEnglish: boolean;
}

function isEnglishText(text: string): boolean {
  const englishChars = text.replace(/[^a-zA-Z]/g, '').length;
  const totalChars = text.length;
  return totalChars > 0 && englishChars / totalChars > 0.5;
}

export function truncateText(
  text: string,
  maxLength?: number,
  ellipsis: string = TITLE_CONFIG.ELLIPSIS
): TruncateResult {
  if (!text) {
    return { truncated: '', isTruncated: false, original: '', isEnglish: false };
  }

  const english = isEnglishText(text);
  const limit = maxLength ?? (english ? TITLE_CONFIG.MAX_TITLE_LENGTH_EN : TITLE_CONFIG.MAX_TITLE_LENGTH_CN);

  if (text.length <= limit) {
    return { truncated: text, isTruncated: false, original: text, isEnglish: english };
  }

  return {
    truncated: text.slice(0, limit) + ellipsis,
    isTruncated: true,
    original: text,
    isEnglish: english
  };
}

/**
 * 将任意格式的布尔型答案（存储在 study_cards.answer 中）归一化为 "True" | "False" | 原字符串。
 * 用于解决 AI 生成 / seed 数据里答案格式不一致：
 *   - 小写: "true", "false"
 *   - 大写: "TRUE", "FALSE"
 *   - 首字母大写: "True", "False"
 *   - 前后空白: " true \n"
 * 非布尔类答案直接返回 trim 后的原字符串（不影响 choice/qa 等题型）。
 */
export function normalizeBooleanAnswer(value: unknown): string {
  const trimmed = String(value ?? '').trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'true') return 'True';
  if (lower === 'false') return 'False';
  return trimmed;
}

/**
 * 判断判断题答案是否相等，大小写与空白不敏感。
 * 非 true/false 答案按普通字符串做 trim 后比较（兼容老数据/非标准存储）。
 */
export function isTrueFalseAnswerEqual(userAnswer: string, correctAnswer: unknown): boolean {
  return normalizeBooleanAnswer(userAnswer) === normalizeBooleanAnswer(correctAnswer);
}
