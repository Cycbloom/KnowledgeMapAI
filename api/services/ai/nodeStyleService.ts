import { aiService } from "./aiService";
import { getAIProviderForTask } from "./factory";
import { logger } from "../../utils/logger";

export interface NodeStyleSuggestion {
  node_id: string;
  color: string;
  icon: string;
  reason: string;
}

export interface SuggestNodeStylesResult {
  suggestions: NodeStyleSuggestion[];
  usedDefault: boolean;
}

const DEFAULT_COLOR = "#6366F1";
const DEFAULT_ICON = "📌";

const COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
const PRESET_ICONS = [
  "📘", "📗", "📕", "📙", "🔬", "💡", "🧠", "🌐", "🔧", "🎯",
  "📐", "📊", "🔭", "🧪", "⚙️", "📚", "✏️", "🗂️", "🔗", "⭐",
];

/**
 * 智能配色/图标服务：为图谱节点批量推荐颜色与图标。
 * 输入节点列表（含标题/内容/层级），AI 按语义推荐，解析失败时回退默认值。
 */
export class NodeStyleService {
  async suggestStyles(
    nodes: Array<{ id: string; title: string; content?: string; level?: string }>,
    language?: string,
  ): Promise<SuggestNodeStylesResult> {
    const usedDefault: string[] = [];

    if (nodes.length === 0) {
      return { suggestions: [], usedDefault: true };
    }

    try {
      const provider = await getAIProviderForTask("text");
      if (!provider.hasKey) {
        return {
          suggestions: nodes.map((n) => ({
            node_id: n.id,
            color: DEFAULT_COLOR,
            icon: DEFAULT_ICON,
            reason: "AI 未配置，使用默认样式",
          })),
          usedDefault: true,
        };
      }

      const nodeList = nodes
        .map((n) => {
          const parts = [`- id: ${n.id}`, `  title: ${n.title}`];
          if (n.content) parts.push(`  content: ${n.content.slice(0, 100)}`);
          if (n.level) parts.push(`  level: ${n.level}`);
          return parts.join("\n");
        })
        .join("\n");

      const langInstruction =
        language && language.startsWith("zh")
          ? "请使用中文输出 reason 字段。"
          : "Please write the reason field in English.";

      const prompt = `你是一位视觉设计专家。请为以下知识图谱节点推荐合适的颜色（HEX）和 Emoji 图标。
要求：
1. 颜色应与节点主题语义相关（如：数学→蓝色系，生物→绿色系）
2. 图标应直观表达主题（Emoji）
3. 同一分支/相近主题的节点使用相近色系
4. 严格返回 JSON 格式：{"suggestions": [{"node_id": "节点id", "color": "#RRGGBB", "icon": "emoji", "reason": "推荐理由"}]}
5. 必须为每个节点返回一条建议，node_id 必须与输入一致
${langInstruction}

节点列表：
${nodeList}`;

      const response = await aiService.chat([
        { role: "user", content: prompt },
      ]);

      let parsed: { suggestions?: Array<{ node_id?: string; color?: string; icon?: string; reason?: string }> };
      try {
        const cleaned = response.replace(/```json\n?|\n?```/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        logger.warn("智能配色 AI 返回 JSON 解析失败，使用默认样式", {
          rawResponse: response.slice(0, 200),
        });
        return this.fallback(nodes, usedDefault);
      }

      if (!parsed.suggestions || !Array.isArray(parsed.suggestions)) {
        logger.warn("智能配色 AI 返回格式无效，使用默认样式");
        return this.fallback(nodes, usedDefault);
      }

      // 按节点顺序对齐，缺失或非法时用默认值
      const byId = new Map(
        parsed.suggestions.map((s) => [s.node_id, s]),
      );

      const suggestions: NodeStyleSuggestion[] = nodes.map((n) => {
        const s = byId.get(n.id);
        const color = s?.color && COLOR_REGEX.test(s.color) ? s.color : DEFAULT_COLOR;
        const icon = s?.icon && s.icon.length <= 4 ? s.icon : DEFAULT_ICON;
        if (!s?.color || !COLOR_REGEX.test(s.color)) usedDefault.push(n.id);
        return {
          node_id: n.id,
          color,
          icon,
          reason: s?.reason || "",
        };
      });

      return { suggestions, usedDefault: usedDefault.length > 0 };
    } catch (error) {
      const err = error as Error;
      logger.error("智能配色/图标失败", { error: err.message });
      return this.fallback(nodes, usedDefault);
    }
  }

  private fallback(
    nodes: Array<{ id: string; title: string; content?: string; level?: string }>,
    _usedDefault: string[],
  ): SuggestNodeStylesResult {
    // 无 AI 时按层级分配预设色，尽量做到视觉区分
    const levelColorMap: Record<string, string> = {
      root: "#8B5CF6",
      core: "#EF4444",
      sub: "#F59E0B",
      normal: "#3B82F6",
      leaf: "#10B981",
    };
    return {
      suggestions: nodes.map((n, idx) => ({
        node_id: n.id,
        color: n.level ? levelColorMap[n.level] || DEFAULT_COLOR : PRESET_ICONS.length ? DEFAULT_COLOR : DEFAULT_COLOR,
        icon: PRESET_ICONS[idx % PRESET_ICONS.length],
        reason: "AI 不可用，使用默认样式",
      })),
      usedDefault: true,
    };
  }
}

export const nodeStyleService = new NodeStyleService();
