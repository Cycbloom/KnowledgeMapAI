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
