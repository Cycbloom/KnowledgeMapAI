import { logger } from "../../utils/logger";
import { buildNodeContext, type NodeData } from "./utils";

interface ContextSource {
  id: string;
  title: string;
  content: string;
  similarity: number;
  graphId: string;
  /**
   * 数据源类型 (P1 Task 5): 'document' 图谱知识点 / 'note' 笔记。
   * 可选字段,与 RAGSearchResult.type 对齐,确保 usedSources 保留类型信息。
   */
  type?: "document" | "note";
}

interface GraphContextSource {
  id: string;
  title: string;
  content: string;
  hopDistance: number;
  relationshipPath: string;
  relationshipType: string;
}

/**
 * 挂载笔记上下文源（P1 Task 5.4）。
 * 通过 note_node_links 查当前节点挂载的笔记，作为确定性上下文注入。
 * 与 GraphContextSource 不同：笔记无 hopDistance / relationshipPath，
 * 是用户显式挂载到节点的笔记内容。
 */
interface NoteContextSource {
  id: string;
  title: string;
  content: string;
}

interface ContextChunk {
  knowledgePointId: string;
  chunkIndex: number;
  content: string;
  similarity: number;
}

interface BuildContextOptions {
  maxTokens: number;
  currentNodeContext?: string;
  chunks?: ContextChunk[];
  graphSources?: GraphContextSource[];
  noteSources?: NoteContextSource[];
}

interface BuildContextResult {
  context: string;
  usedSources: ContextSource[];
}

export class ContextWindowManager {
  private estimateTokens(text: string): number {
    let chineseChars = 0;
    let nonChineseChars = 0;

    for (const char of text) {
      if (char >= "\u4e00" && char <= "\u9fff") {
        chineseChars++;
      } else {
        nonChineseChars++;
      }
    }

    return chineseChars / 1.5 + nonChineseChars / 4;
  }

  buildContext(
    sources: ContextSource[],
    options: BuildContextOptions,
  ): BuildContextResult {
    const { maxTokens, currentNodeContext, chunks, graphSources, noteSources } = options;

    const sortedSources = [...sources].sort(
      (a, b) => b.similarity - a.similarity,
    );

    let remainingBudget = maxTokens;
    let currentNodeSection = "";

    if (currentNodeContext) {
      const currentNodeTokens = this.estimateTokens(currentNodeContext);
      remainingBudget = Math.max(0, maxTokens - currentNodeTokens);
      currentNodeSection = `[当前节点]\n${currentNodeContext}\n`;
    }

    // 预算分配：seed 70% 保持不变；当存在挂载笔记时，从 graph 30% 中分出一半给 notes。
    // 无挂载笔记时保持原有 70/30 行为，确保向后兼容。
    const hasNotes = noteSources && noteSources.length > 0;
    const seedBudget = Math.floor(remainingBudget * 0.7);
    const graphBudget = hasNotes
      ? Math.floor(remainingBudget * 0.15)
      : remainingBudget - seedBudget;
    const noteBudget = hasNotes
      ? remainingBudget - seedBudget - graphBudget
      : 0;

    const usedSources: ContextSource[] = [];
    const sourceEntries: string[] = [];

    let seedRemaining = seedBudget;

    for (const source of sortedSources) {
      let effectiveContent = source.content;

      if (chunks && chunks.length > 0) {
        const matchingChunks = chunks.filter(
          (chunk) => chunk.knowledgePointId === source.id,
        );
        if (matchingChunks.length > 0) {
          const bestChunk = matchingChunks.reduce((best, current) =>
            current.similarity > best.similarity ? current : best,
          );
          effectiveContent = bestChunk.content;
        }
      }

      const nodeData: NodeData = {
        title: source.title,
        content: effectiveContent,
      };
      const entryText = buildNodeContext(nodeData, { maxContentLength: 1000 });
      const entryTokens = this.estimateTokens(entryText);

      if (entryTokens <= seedRemaining) {
        sourceEntries.push(entryText);
        usedSources.push(source);
        seedRemaining -= entryTokens;
      } else {
        logger.warn(
          `Context window budget exhausted. Skipping source: ${source.title}`,
        );
        break;
      }
    }

    let context = "";
    if (currentNodeSection) {
      context += currentNodeSection;
    }
    if (sourceEntries.length > 0) {
      const formattedSources = sourceEntries
        .map((entry, i) => `[${i + 1}] ${entry}`)
        .join("\n\n");
      context += `[相关知识节点]\n${formattedSources}`;
    }

    if (graphSources && graphSources.length > 0) {
      const sortedGraphSources = [...graphSources].sort((a, b) => {
        if (a.hopDistance !== b.hopDistance) {
          return a.hopDistance - b.hopDistance;
        }
        return a.relationshipPath.localeCompare(b.relationshipPath);
      });

      const graphEntries: string[] = [];
      let graphRemaining = graphBudget;

      for (const gs of sortedGraphSources) {
        const graphEntryText = `[图谱关联] [${gs.hopDistance}跳] ${gs.relationshipPath}\n${gs.title}: ${gs.content}`;
        const graphEntryTokens = this.estimateTokens(graphEntryText);

        if (graphEntryTokens <= graphRemaining) {
          graphEntries.push(graphEntryText);
          graphRemaining -= graphEntryTokens;
        } else {
          logger.warn(
            `Graph context budget exhausted. Skipping graph source: ${gs.title}`,
          );
          break;
        }
      }

      if (graphEntries.length > 0) {
        if (context) {
          context += "\n\n";
        }
        context += `[图谱关联节点]\n${graphEntries.join("\n\n")}`;
      }
    }

    // 挂载笔记段落（P1 Task 5.4）：当前节点通过 note_node_links 显式挂载的笔记内容。
    // 作为确定性上下文注入（非相似度检索），优先级高于图谱关联节点。
    if (noteSources && noteSources.length > 0) {
      const noteEntries: string[] = [];
      let noteRemaining = noteBudget;

      for (const ns of noteSources) {
        // 笔记内容可能较长，截断到 1000 字符（与 buildNodeContext maxContentLength 一致）
        const truncatedContent = ns.content.slice(0, 1000);
        const noteEntryText = `${ns.title}\n${truncatedContent}`;
        const noteEntryTokens = this.estimateTokens(noteEntryText);

        if (noteEntryTokens <= noteRemaining) {
          noteEntries.push(noteEntryText);
          noteRemaining -= noteEntryTokens;
        } else {
          logger.warn(
            `Note context budget exhausted. Skipping note source: ${ns.title}`,
          );
          break;
        }
      }

      if (noteEntries.length > 0) {
        const formattedNotes = noteEntries
          .map((entry, i) => `[${i + 1}] ${entry}`)
          .join("\n\n");
        if (context) {
          context += "\n\n";
        }
        context += `[挂载笔记]\n${formattedNotes}`;
      }
    }

    return { context, usedSources };
  }
}

export const contextWindowManager = new ContextWindowManager();
