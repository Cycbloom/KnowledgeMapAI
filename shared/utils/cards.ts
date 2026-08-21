export function deriveFocusTopicFallback(question: unknown, nodeTitle?: string): string {
  if (typeof question === 'string') {
    const trimmed = question.trim();
    if (trimmed.length > 0) {
      if (trimmed.length > 24) {
        return `${trimmed.slice(0, 24)  }…`;
      }
      return trimmed;
    }
  }

  if (typeof nodeTitle === 'string') {
    const trimmed = nodeTitle.trim();
    if (trimmed.length > 0) {
      if (trimmed.length > 24) {
        return `${trimmed.slice(0, 24)  }…`;
      }
      return trimmed;
    }
  }

  return '未命名考察点';
}
