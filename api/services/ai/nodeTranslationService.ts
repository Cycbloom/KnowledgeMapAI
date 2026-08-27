import { aiService } from "./aiService";
import { getAIProviderForTask } from "./factory";
import { logger } from "../../utils/logger";

export interface NodeTranslation {
  node_id: string;
  title: string;
  content?: string;
}

export interface TranslateNodesResult {
  translations: NodeTranslation[];
  usedDefault: boolean;
}

const LANG_LABELS: Record<string, string> = {
  "zh-CN": "简体中文",
  "zh": "简体中文",
  "en": "英语（English）",
  "en-US": "英语（English）",
  "ja": "日语（日本語）",
  "ko": "韩语（한국어）",
  "fr": "法语（Français）",
  "de": "德语（Deutsch）",
  "es": "西班牙语（Español）",
  "ru": "俄语（Русский）",
};

/**
 * 节点翻译服务：将图谱节点的标题与内容翻译为目标语言。
 * 翻译结果返回给前端预览，由前端决定是否写回（避免误覆盖）。
 */
export class NodeTranslationService {
  async translateNodes(
    nodes: Array<{ id: string; title: string; content?: string }>,
    targetLanguage: string,
  ): Promise<TranslateNodesResult> {
    if (nodes.length === 0) {
      return { translations: [], usedDefault: true };
    }

    const langLabel = LANG_LABELS[targetLanguage] || targetLanguage;

    try {
      const provider = await getAIProviderForTask("text");
      if (!provider.hasKey) {
        return {
          translations: nodes.map((n) => ({
            node_id: n.id,
            title: n.title,
            content: n.content,
          })),
          usedDefault: true,
        };
      }

      const nodeList = nodes
        .map((n) => {
          const parts = [`- id: ${n.id}`, `  title: ${n.title}`];
          if (n.content) parts.push(`  content: ${n.content.slice(0, 500)}`);
          return parts.join("\n");
        })
        .join("\n");

      const prompt = `你是一位专业翻译。请将以下知识图谱节点的标题和内容翻译成${langLabel}。
要求：
1. 标题翻译要简洁、准确、符合目标语言习惯
2. 内容翻译要保持原意，专业术语准确
3. 如果内容为空，只翻译标题即可
4. 严格返回 JSON 格式：{"translations": [{"node_id": "节点id", "title": "翻译后的标题", "content": "翻译后的内容"}]}
5. 必须为每个节点返回一条翻译，node_id 必须与输入一致

节点列表：
${nodeList}`;

      const response = await aiService.chat([
        { role: "user", content: prompt },
      ]);

      let parsed: { translations?: Array<{ node_id?: string; title?: string; content?: string }> };
      try {
        const cleaned = response.replace(/```json\n?|\n?```/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        logger.warn("节点翻译 AI 返回 JSON 解析失败，使用原文", {
          rawResponse: response.slice(0, 200),
        });
        return {
          translations: nodes.map((n) => ({
            node_id: n.id,
            title: n.title,
            content: n.content,
          })),
          usedDefault: true,
        };
      }

      if (!parsed.translations || !Array.isArray(parsed.translations)) {
        logger.warn("节点翻译 AI 返回格式无效，使用原文");
        return {
          translations: nodes.map((n) => ({
            node_id: n.id,
            title: n.title,
            content: n.content,
          })),
          usedDefault: true,
        };
      }

      const byId = new Map(parsed.translations.map((t) => [t.node_id, t]));

      const translations: NodeTranslation[] = nodes.map((n) => {
        const t = byId.get(n.id);
        return {
          node_id: n.id,
          title: t?.title && t.title.trim() ? t.title : n.title,
          content: t?.content && t.content.trim() ? t.content : n.content,
        };
      });

      return { translations, usedDefault: false };
    } catch (error) {
      const err = error as Error;
      logger.error("节点翻译失败", { error: err.message });
      return {
        translations: nodes.map((n) => ({
          node_id: n.id,
          title: n.title,
          content: n.content,
        })),
        usedDefault: true,
      };
    }
  }
}

export const nodeTranslationService = new NodeTranslationService();
