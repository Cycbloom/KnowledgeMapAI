import { logger } from "../../../utils/logger";
import { AppError } from "../../../middleware/errorHandler";
import { ErrorCodes } from "../../../../shared/types/errorCodes";

export { extractTokenUsage } from "./tokenUtils";
export { normalizeGeneratedCardAnswers } from "./cardAnswerNormalizer";

/**
 * 宽松解析 AI 输出中的 JSON（对象或数组）。
 * 与严格版 parseAIResponse 不同：内容为空或解析失败时不抛错，返回传入的 fallback。
 * 适合"AI 返回常夹带说明文字、失败时降级用默认值"的场景，内部复用 cleanJsonString 剥离 code fence。
 */
export function parseAIJson<T>(content: string, fallback: T): T {
  if (!content || content.trim() === "") {
    return fallback;
  }
  try {
    return JSON.parse(cleanJsonString(content)) as T;
  } catch {
    // 继续尝试正则兜底
  }
  try {
    const match = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]) as T;
    }
  } catch {
    // 忽略，最终返回 fallback
  }
  return fallback;
}

export const cleanJsonString = (str: string): string => {
  let cleaned = str.trim();

  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }

  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
};

export const parseAIResponse = <T>(content: string, context: string): T => {
  if (!content || content.trim() === "") {
    logger.error(`[AI] Empty response for ${context}`);
    throw new AppError(ErrorCodes.AI_INVALID_RESPONSE, { message: `Empty AI response for ${context}` });
  }

  const cleaned = cleanJsonString(content);
  try {
    return JSON.parse(cleaned);
  } catch (_e) {
    logger.warn(
      `[AI] JSON Parse Error (${context}). Attempting regex fallback.`,
    );
    logger.debug(
      `[AI] Raw content length: ${content.length}, first 200 chars: ${content.substring(0, 200)}`,
    );

    const match = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (_e2) {
        logger.error(`[AI] Regex fallback also failed for ${context}`);
        logger.debug(`[AI] Matched content: ${match[0].substring(0, 500)}`);
        throw new AppError(ErrorCodes.AI_INVALID_RESPONSE, { message: `Failed to parse AI response for ${context}` });
      }
    }
    logger.error(`[AI] No JSON found in response for ${context}`);
    throw new AppError(ErrorCodes.AI_INVALID_RESPONSE, { message: `Failed to parse AI response for ${context}` });
  }
};

export const buildTutorContext = (context: {
  currentNodeId?: string;
  currentNodeTitle?: string;
  currentNodeContent?: string;
  existingNodes?: string[];
  userProgress?: { masteredCount?: number; dueCount?: number };
  learningPath?: string[];
}): string => {
  let contextStr = "";

  if (context.currentNodeId && context.currentNodeTitle) {
    contextStr += `\nCurrent Node:\n- Title: ${context.currentNodeTitle}\n- Content: ${context.currentNodeContent || "(No content)"}\n`;
  }

  if (context.existingNodes && context.existingNodes.length > 0) {
    contextStr += `\nExisting Nodes in Graph:\n${context.existingNodes.slice(0, 20).join(", ")}\n`;
  }

  if (context.userProgress) {
    contextStr += `\nUser Progress:\n- Mastered: ${context.userProgress.masteredCount || 0} nodes\n- Due for review: ${context.userProgress.dueCount || 0} nodes\n`;
  }

  if (context.learningPath && context.learningPath.length > 0) {
    contextStr += `\nSuggested Learning Path:\n${context.learningPath.join(" → ")}\n`;
  }

  return contextStr || "No specific context provided.";
};

export interface NodeContextOptions {
  includeContent?: boolean;
  includeProperties?: boolean;
  includeLearningMaterial?: boolean;
  maxContentLength?: number;
}

export interface NodeData {
  title?: string;
  content?: string;
  learning_material?: Record<string, string>;
  properties?: Record<string, unknown>;
}

export function buildNodeContext(
  node: NodeData,
  options: NodeContextOptions = {},
): string {
  const {
    includeContent = true,
    includeProperties = false,
    includeLearningMaterial = false,
    maxContentLength = 500,
  } = options;

  const parts: string[] = [];

  if (node.title) {
    parts.push(`标题: ${node.title}`);
  }

  if (includeContent && node.content) {
    const content =
      node.content.length > maxContentLength
        ? `${node.content.substring(0, maxContentLength)  }...`
        : node.content;
    parts.push(`内容: ${content}`);
  }

  if (includeLearningMaterial && node.learning_material) {
    const lmEntries = Object.entries(node.learning_material);
    if (lmEntries.length > 0) {
      parts.push(
        `学习材料: ${lmEntries
          .map(([lang, content]) => `[${lang}] ${content}`)
          .join("\n")}`,
      );
    }
  }

  if (includeProperties && node.properties) {
    const tags = node.properties.tags as string[];
    if (tags && tags.length > 0) {
      parts.push(`标签: ${tags.join(", ")}`);
    }
  }

  return parts.join("\n");
}

export function buildNodesContext(
  nodes: NodeData[],
  options: NodeContextOptions = {},
): string {
  return nodes
    .map((n, i) => `[${i + 1}] ${buildNodeContext(n, options)}`)
    .join("\n\n");
}
