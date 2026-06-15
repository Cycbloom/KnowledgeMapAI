import { logger } from "../../utils/logger";
import { buildNodeContext, type NodeData } from "./utils";

interface ContextSource {
  id: string;
  title: string;
  content: string;
  similarity: number;
  graphId: string;
}

interface GraphContextSource {
  id: string;
  title: string;
  content: string;
  hopDistance: number;
  relationshipPath: string;
  relationshipType: string;
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
    const { maxTokens, currentNodeContext, chunks, graphSources } = options;

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

    const seedBudget = Math.floor(remainingBudget * 0.7);
    const graphBudget = remainingBudget - seedBudget;

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

    return { context, usedSources };
  }
}

export const contextWindowManager = new ContextWindowManager();
