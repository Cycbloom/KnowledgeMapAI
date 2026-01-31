/**
 * Preprocesses markdown content to handle common LaTeX math delimiters.
 * Now simplified to only handle explicit delimiters to avoid false positives,
 * relying on the AI to provide correctly formatted $ or $$ delimiters.
 */
export const preprocessMarkdown = (content: string): string => {
  if (!content) return '';

  // 移除可能导致重复渲染或逻辑冲突的过于复杂的正则
  // 只保留最基础的：修复 AI 可能输出的双反斜杠转义
  let processed = content;
  
  // 1. 修复 AI 可能在 JSON 中输出的双反斜杠 (\\mathbf -> \mathbf)
  // 但要注意不要破坏 LaTeX 中的换行符 \\
  // 只有当 \\ 后面跟着字母或符号时才认为是转义
  processed = processed.replace(/\\\\([a-zA-Z\(\)\[\]\{\}])/g, '\\$1');

  // 2. 将一些非标准的定界符标准化，避免插件识别失败
  // \[ ... \] -> $$ ... $$
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_, equation) => `$$${equation}$$`);
  // \( ... \) -> $ ... $
  processed = processed.replace(/\\\( ([\s\S]*?) \\\)/g, (_, equation) => `$${equation}$`);
  processed = processed.replace(/\\\(([\s\S]*?)\\\)/g, (_, equation) => `$${equation}$`);

  return processed;
};
