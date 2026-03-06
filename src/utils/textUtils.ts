export const TITLE_CONFIG = {
  MAX_TITLE_LENGTH: 10,
  ELLIPSIS: '...'
} as const;

export interface TruncateResult {
  truncated: string;
  isTruncated: boolean;
  original: string;
}

export function truncateText(
  text: string,
  maxLength: number = TITLE_CONFIG.MAX_TITLE_LENGTH,
  ellipsis: string = TITLE_CONFIG.ELLIPSIS
): TruncateResult {
  if (!text) {
    return { truncated: '', isTruncated: false, original: '' };
  }

  if (text.length <= maxLength) {
    return { truncated: text, isTruncated: false, original: text };
  }

  return {
    truncated: text.slice(0, maxLength) + ellipsis,
    isTruncated: true,
    original: text
  };
}
