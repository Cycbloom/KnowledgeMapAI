import type { AIProviderType } from "@shared/types";
import { getAIProviderForTask } from "./factory";
import { promptService } from "./promptService";
import { getSupabaseAdmin } from "../../supabase";
import { logger } from "../../utils/logger";
import { parseAIResponse } from "./utils";
import { withAIMonitoring } from "./aiMonitor";
import {
  withTimeoutAndRetry,
  TimeoutError,
  RetryError,
  LONG_TIMEOUT,
} from "../../../shared/utils/retry";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

export interface LiteratureMetadata {
  title?: string;
  authors?: string[];
  year?: number;
  type: "paper" | "book" | "article" | "report" | "webpage" | "document";
  journal?: string;
  doi?: string;
  keywords?: string[];
  abstract?: string;
  confidence: number;
}

export type LiteratureType = LiteratureMetadata["type"];

export interface ExtractMetadataOptions {
  provider?: AIProviderType;
  model?: string;
  userId?: string;
  graphId?: string;
  language?: string;
  sessionId?: string;
}

interface MetadataExtractionResponse {
  title?: string;
  authors?: string[];
  year?: number;
  type: LiteratureType;
  journal?: string;
  doi?: string;
  keywords?: string[];
  abstract?: string;
  confidence: number;
}

const LITERATURE_TYPE_DESCRIPTIONS: Record<LiteratureType, string> = {
  paper:
    "学术论文 (paper): 发表在学术期刊或会议上的研究论文，通常包含摘要、方法、结果等结构",
  book: "书籍 (book): 出版的书籍或专著，有ISBN号，包含章节结构",
  article: "文章 (article): 非学术性的文章，如新闻报道、博客文章、杂志文章等",
  report: "报告 (report): 技术报告、研究报告、白皮书等",
  webpage: "网页 (webpage): 来自网站的页面内容，可能包含广告、导航等非正文内容",
  document: "文档 (document): 其他类型的文档，无法明确分类的文献",
};

function buildMetadataExtractionPrompt(content: string): string {
  const typeDescriptions = Object.entries(LITERATURE_TYPE_DESCRIPTIONS)
    .map(([_key, desc]) => `- ${desc}`)
    .join("\n");

  return `你是一个专业的文献元数据提取专家，擅长从各种文献内容中提取关键元数据信息。

## 任务说明
请从以下文献内容中提取元数据信息，包括标题、作者、年份、文献类型等。

## 文献类型定义
${typeDescriptions}

## 文献内容
${content.slice(0, 6000)}

## 提取要求
1. 标题 (title): 文献的完整标题，如果无法识别则省略
2. 作者 (authors): 作者列表，多个作者用数组表示
3. 年份 (year): 出版或发表年份，必须是数字
4. 类型 (type): 必须从给定的文献类型中选择一个最合适的
5. 期刊/会议 (journal): 发表的期刊或会议名称
6. DOI: 数字对象标识符，格式如 10.xxxx/xxxxx
7. 关键词 (keywords): 提取的关键词列表，最多5个
8. 摘要 (abstract): 文献摘要，控制在200字以内
9. 置信度 (confidence): 识别结果的置信度，0-1之间的数字

请严格按照 JSON 格式返回结果。`;
}

function buildMetadataSchema(): string {
  return `
返回一个 JSON 对象，包含以下结构：
{
  "title": "文献标题（可选）",
  "authors": ["作者1", "作者2"],
  "year": 2024,
  "type": "paper|book|article|report|webpage|document",
  "journal": "期刊或会议名称（可选）",
  "doi": "DOI标识符（可选）",
  "keywords": ["关键词1", "关键词2"],
  "abstract": "文献摘要（可选）",
  "confidence": 0.0-1.0
}

重要：
- type 字段必须填写，不能省略
- confidence 字段必须填写，表示识别结果的可信程度
- 如果某个字段无法从内容中提取，可以省略该字段或设为 null
- 年份必须是数字类型
- 作者和关键词必须是数组类型`;
}

function buildTypeDetectionPrompt(content: string): string {
  const typeDescriptions = Object.entries(LITERATURE_TYPE_DESCRIPTIONS)
    .map(([_key, desc]) => `- ${desc}`)
    .join("\n");

  return `你是一个文献类型识别专家。请根据以下文献内容，判断其最合适的类型。

## 文献类型定义
${typeDescriptions}

## 文献内容
${content.slice(0, 3000)}

## 任务
请判断这篇文献属于哪种类型，并返回 JSON 格式结果：
{
  "type": "paper|book|article|report|webpage|document",
  "confidence": 0.0-1.0,
  "reason": "判断理由（简短说明）"
}

注意：
- type 必须是上述六种类型之一
- confidence 表示判断的置信程度
- reason 简要说明判断依据`;
}

export class LiteratureMetadataService {
  async extractMetadata(
    content: string,
    options: ExtractMetadataOptions = {},
  ): Promise<LiteratureMetadata> {
    const provider = await getAIProviderForTask("text");

    if (!provider.hasKey) {
      return this.getMockMetadata();
    }

    try {
      const model = options.model || provider.model;

      return withAIMonitoring(
        {
          operation: "extractMetadata",
          provider: provider.providerType,
          model,
          metadata: {
            contentLength: content.length,
          },
          sessionId: options.sessionId,
        },
        async () => {
          const systemPrompt = await promptService.getRenderedPrompt(
            getSupabaseAdmin(),
            "literature_metadata_extraction",
            {},
            options.userId,
            options.graphId,
            options.language,
          );

          const fallbackPrompt = buildMetadataExtractionPrompt(content);
          const schema = buildMetadataSchema();

          const finalSystemPrompt = systemPrompt
            ? `${systemPrompt}\n\n${schema}`
            : `${fallbackPrompt}\n\n${schema}`;

          const completion = await withTimeoutAndRetry(
            () =>
              provider.client.chat.completions.create({
                messages: [
                  { role: "system", content: finalSystemPrompt },
                  {
                    role: "user",
                    content: `请从以下文献引用信息中提取元数据：\n\n${content}`,
                  },
                ],
                model,
                response_format: { type: "json_object" },
              }),
            {
              timeout: LONG_TIMEOUT,
              maxRetries: 3,
              onRetry: (attempt, error) => {
                logger.warn(
                  `Extract Metadata retry attempt ${attempt}: ${error.message}`,
                );
              },
            },
          );

          const rawContent = completion.choices[0].message.content || "";
          const parsed = parseAIResponse<MetadataExtractionResponse>(
            rawContent,
            "Extract Metadata",
          );

          const metadata: LiteratureMetadata = {
            title: parsed.title,
            authors: parsed.authors,
            year: parsed.year,
            type: parsed.type || "document",
            journal: parsed.journal,
            doi: parsed.doi,
            keywords: parsed.keywords,
            abstract: parsed.abstract,
            confidence: parsed.confidence || 0.5,
          };

          return {
            result: metadata,
            usage: completion.usage,
          };
        },
      );
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Extract Metadata Error:", error);

      if (err instanceof TimeoutError) {
        throw new AppError(ErrorCodes.AI_TIMEOUT);
      }
      if (err instanceof RetryError) {
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: `AI 请求失败，已重试 ${err.attempts} 次: ${err.lastError.message}`,
        });
      }
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "元数据提取失败",
      });
    }
  }

  async detectLiteratureType(
    content: string,
    options: ExtractMetadataOptions = {},
  ): Promise<LiteratureType> {
    const provider = await getAIProviderForTask("text");

    if (!provider.hasKey) {
      return "document";
    }

    try {
      const model = options.model || provider.model;

      return withAIMonitoring(
        {
          operation: "detectLiteratureType",
          provider: provider.providerType,
          model,
          metadata: {
            contentLength: content.length,
          },
        },
        async () => {
          const prompt = buildTypeDetectionPrompt(content);

          const completion = await withTimeoutAndRetry(
            () =>
              provider.client.chat.completions.create({
                messages: [
                  {
                    role: "system",
                    content:
                      "你是一个文献类型识别专家。请根据文献内容判断其类型。",
                  },
                  { role: "user", content: prompt },
                ],
                model,
                response_format: { type: "json_object" },
              }),
            {
              timeout: LONG_TIMEOUT,
              maxRetries: 2,
              onRetry: (attempt, error) => {
                logger.warn(
                  `Detect Literature Type retry attempt ${attempt}: ${error.message}`,
                );
              },
            },
          );

          const rawContent = completion.choices[0].message.content || "";
          const parsed = parseAIResponse<{
            type: LiteratureType;
            confidence: number;
            reason?: string;
          }>(rawContent, "Detect Literature Type");

          const validTypes: LiteratureType[] = [
            "paper",
            "book",
            "article",
            "report",
            "webpage",
            "document",
          ];
          const type = validTypes.includes(parsed.type)
            ? parsed.type
            : "document";

          return {
            result: type,
            usage: completion.usage,
          };
        },
      );
    } catch (error: unknown) {
      logger.error("Detect Literature Type Error:", error);
      return "document";
    }
  }

  private getMockMetadata(): LiteratureMetadata {
    return {
      title: "示例文献标题",
      authors: ["作者1", "作者2"],
      year: new Date().getFullYear(),
      type: "document",
      keywords: ["关键词1", "关键词2", "关键词3"],
      abstract: "这是示例文献的摘要内容，用于在没有 API Key 时展示。",
      confidence: 0.5,
    };
  }
}

export const literatureMetadataService = new LiteratureMetadataService();
