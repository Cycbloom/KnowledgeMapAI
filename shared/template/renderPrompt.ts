import { TemplateEngine } from "./templateEngine";
import {
  getCategoryOptions,
  getLanguageInstruction,
  isEnglishLanguage,
} from "./promptDefaults";

export interface RenderPromptParams {
  content: string;
  context: Record<string, unknown>;
  language?: string;
  /** 追加的输出格式 schema（如 OUTPUT_SCHEMAS[code]） */
  schema?: string;
}

/**
 * 统一的 prompt 渲染收尾：变量渲染 → 追加输出 schema → 语言占位符兜底
 * → 分类选项占位符 → 追加语言指令。
 * api 与移动端的 getRenderedPrompt 共用，保证两端行为一致。
 */
export function renderPromptContent(params: RenderPromptParams): string {
  const { content, context, language, schema } = params;
  const outputLanguage = isEnglishLanguage(language) ? "English" : "Chinese";

  let result = TemplateEngine.render(content, { ...context, outputLanguage });
  if (schema) {
    result += `\n\n${schema}`;
  }
  result = result.replace(/\{\{outputLanguage\}\}/g, outputLanguage);
  result = result.replace(
    /\{\{categoryOptions\}\}/g,
    getCategoryOptions(language),
  );
  result += `\n\n${getLanguageInstruction(language)}`;
  return result;
}
