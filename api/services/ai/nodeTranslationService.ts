import { aiService } from "./aiService";
import { getAIProviderForTask } from "./factory";
import { logger } from "../../utils/logger";

/** 节点可翻译字段清单（字段型 schema 驱动 prompt 与解析） */
export const NODE_TRANSLATION_FIELDS = [
  { key: "title", label: "标题(title)" },
  { key: "content", label: "内容(content)" },
  { key: "summary", label: "摘要(summary)" },
] as const;

export interface TranslateNodeInput {
  id: string;
  title: string;
  content?: string;
  summary?: string;
}

export interface NodeTranslationResult {
  node_id: string;
  title: string;
  content?: string;
  summary?: string;
}

/** 兼容别名 */
export type NodeTranslation = NodeTranslationResult;

export interface TranslateNodesResult {
  translations: NodeTranslationResult[];
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

function fallbackTranslations(nodes: TranslateNodeInput[]): NodeTranslationResult[] {
  return nodes.map((n) => ({
    node_id: n.id,
    title: n.title,
    content: n.content,
    summary: n.summary,
  }));
}

/**
 * 节点翻译服务：将图谱节点的标题/内容/摘要翻译为目标语言。
 * 按字段型 schema（title/content/summary）驱动 AI 输出结构化 JSON，
 * 返回每种语言、每个字段的翻译预览，由前端写回对应语言 key。
 */
export class NodeTranslationService {
  async translateNodes(
    nodes: TranslateNodeInput[],
    targetLanguage: string,
  ): Promise<TranslateNodesResult> {
    if (nodes.length === 0) {
      return { translations: [], usedDefault: true };
    }

    const langLabel = LANG_LABELS[targetLanguage] || targetLanguage;

    try {
      const provider = await getAIProviderForTask("text");
      if (!provider.hasKey) {
        return { translations: fallbackTranslations(nodes), usedDefault: true };
      }

      const fieldDesc = NODE_TRANSLATION_FIELDS.map((f) => f.label).join("、");

      const nodeList = nodes
        .map((n) => {
          const parts = [`- id: ${n.id}`, `  title: ${n.title}`];
          if (n.content) parts.push(`  content: ${n.content.slice(0, 800)}`);
          if (n.summary) parts.push(`  summary: ${n.summary.slice(0, 300)}`);
          return parts.join("\n");
        })
        .join("\n");

      const prompt = `你是一位专业翻译。请将以下知识图谱各字段（${fieldDesc}）翻译成${langLabel}。
要求：
1. 标题(title)翻译要简洁、准确、符合目标语言习惯
2. 内容/content和摘要(summary)要保持原意，专业术语准确
3. 如果某字段为空，对应返回空字符串即可
4. 只翻译，不改写、不补充内容
5. 严格返回 JSON 格式：{"translations": [{"node_id": "节点id", "title": "翻译后的标题", "content": "翻译后的内容", "summary": "翻译后的摘要"}]}
6. 必须为每个节点返回一条翻译，node_id 必须与输入一致

节点列表：
${nodeList}`;

      const response = await aiService.chat([
        { role: "user", content: prompt },
      ]);

      let parsed: { translations?: Array<{ node_id?: string; title?: string; content?: string; summary?: string }> };
      try {
        const cleaned = response.replace(/```json\n?|\n?```/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        logger.warn("节点翻译 AI 返回 JSON 解析失败，使用原文", {
          rawResponse: response.slice(0, 200),
        });
        return { translations: fallbackTranslations(nodes), usedDefault: true };
      }

      if (!parsed.translations || !Array.isArray(parsed.translations)) {
        logger.warn("节点翻译 AI 返回格式无效，使用原文");
        return { translations: fallbackTranslations(nodes), usedDefault: true };
      }

      const byId = new Map(parsed.translations.map((t) => [t.node_id, t]));

      const translations: NodeTranslationResult[] = nodes.map((n) => {
        const t = byId.get(n.id);
        return {
          node_id: n.id,
          title: t?.title && t.title.trim() ? t.title : n.title,
          content:
            t?.content && t.content.trim()
              ? t.content
              : n.content
                ? n.content
                : undefined,
          summary:
            t?.summary && t.summary.trim() ? t.summary : n.summary || undefined,
        };
      });

      return { translations, usedDefault: false };
    } catch (error) {
      const err = error as Error;
      logger.error("节点翻译失败", { error: err.message });
      return { translations: fallbackTranslations(nodes), usedDefault: true };
    }
  }
}

export const nodeTranslationService = new NodeTranslationService();