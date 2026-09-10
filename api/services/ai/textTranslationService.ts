import { aiService } from "./aiService";
import { getAIProviderForTask } from "./factory";
import { logger } from "../../utils/logger";

const LANG_LABELS: Record<string, string> = {
  "zh-CN": "简体中文",
  "zh": "简体中文",
  "en": "英语（English）",
  "en-US": "英语（English）",
  "ja": "日语（日本語）",
  "ko": "韩语（한국어）",
};

export interface TranslateTextResult {
  translation: string;
  usedDefault: boolean;
}

const cleanQuotes = (text: string): string =>
  text.replace(/^[\s"'“”‘’「」『』《》【】]+|[\s"'“”‘’「」『』《》【】]+$/g, "");

/**
 * 选词翻译服务：把阅读时选中的单词/短语翻译为目标语言（默认简体中文）。
 * 走 aiService.chat 统一通道（自动带监控 / 超时重试 / 无 key mock），
 * 与 nodeTranslationService 同为场景化硬编码 prompt 的轻量能力。
 */
export class TextTranslationService {
  async translateText(
    text: string,
    targetLanguage: string,
    context?: string,
  ): Promise<TranslateTextResult> {
    const trimmed = text.trim();
    if (!trimmed) {
      return { translation: "", usedDefault: true };
    }
    const langLabel = LANG_LABELS[targetLanguage] || targetLanguage;

    try {
      const provider = await getAIProviderForTask("text");
      if (!provider.hasKey) {
        return { translation: trimmed, usedDefault: true };
      }

      const contextBlock = context
        ? `\n\n【上下文】\n${context.trim().slice(0, 1500)}`
        : "";

      const prompt = `你是一位专业翻译。请把下面的内容翻译成${langLabel}。
要求：
1. 只输出译文本身，不要任何解释、前缀、引号或多余标点
2. 保持原意，专业术语准确
3. 参考【上下文】判断内容在文中的确切含义（一词多义时尤其重要），但只翻译【待翻译内容】，不要翻译上下文
4. 如果是单词，给出最常用的中文释义；如果是短语或句子，给出通顺的整句翻译

【待翻译内容】
${trimmed.slice(0, 500)}${contextBlock}`;

      const response = await aiService.chat(
        [{ role: "user", content: prompt }],
        { operation: "translate_text" },
      );
      return { translation: cleanQuotes(response), usedDefault: false };
    } catch (error) {
      const err = error as Error;
      logger.error("文本翻译失败", { error: err.message });
      return { translation: trimmed, usedDefault: true };
    }
  }
}

export const textTranslationService = new TextTranslationService();
