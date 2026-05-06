import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";
import type { AIProviderType } from "@shared/types";
import { getAIProviderForTask } from "../services/ai/factory";
import {
  performanceMonitor,
  enrichMetadata,
} from "../services/ai/performanceMonitor";
import { pricingService } from "../services/ai/pricingService";
import { logger } from "../utils/logger";
import { scrapeUrl } from "../utils/scraper";
import { conceptExtractorService } from "../services/ai/conceptExtractorService";
import { conceptAggregationService } from "../services/graph/conceptAggregationService";
import { autoGraphService } from "../services/graph/index";
import { literatureMetadataService } from "../services/ai/literatureMetadataService";
import { cacheService, CacheKeys } from "../services/common/cacheService";
import { aiService } from "../services/ai/aiService";
import type {
  ExtractedConcept,
  LiteratureInfo,
  ConceptType,
  BackboneModule,
  ConceptSource,
  ReferenceBook,
} from "@shared/types/graph";
import { z } from "zod";

const router = Router();

async function withLiteratureTracking<T>(
  operation: string,
  providerType: AIProviderType,
  model: string,
  fn: () => Promise<{
    result: T;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: {
        cached_tokens?: number;
        audio_tokens?: number;
      };
      completion_tokens_details?: {
        reasoning_tokens?: number;
        audio_tokens?: number;
      };
    };
  }>,
  metadata?: {
    graphId?: string;
    graphTitle?: string;
    userId?: string;
    literatureTitle?: string;
    conceptCount?: number;
  },
  sessionId?: string,
): Promise<T> {
  const startTime = Date.now();
  let success = true;
  let errorMessage: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedInputTokens = 0;
  let uncachedInputTokens = 0;
  let reasoningTokens = 0;

  try {
    const { result, usage } = await fn();
    inputTokens = usage?.prompt_tokens || 0;
    outputTokens = usage?.completion_tokens || 0;

    cachedInputTokens = usage?.prompt_tokens_details?.cached_tokens || 0;
    uncachedInputTokens = Math.max(0, inputTokens - cachedInputTokens);
    reasoningTokens = usage?.completion_tokens_details?.reasoning_tokens || 0;

    return result;
  } catch (error: unknown) {
    success = false;
    const err = error as Error;
    errorMessage = err.message;
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    const totalTokens = inputTokens + outputTokens;
    const cacheHitRate =
      inputTokens > 0 ? (cachedInputTokens / inputTokens) * 100 : 0;

    const costBreakdown = pricingService.calculateDetailedCost(
      providerType,
      model,
      inputTokens,
      outputTokens,
      cachedInputTokens,
    );

    performanceMonitor.recordLog({
      operation,
      provider: providerType,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost: costBreakdown.totalCost,
      duration,
      success,
      errorMessage,
      metadata,
      sessionId,

      cachedInputTokens,
      uncachedInputTokens,
      reasoningTokens,
      cacheHitRate: parseFloat(cacheHitRate.toFixed(2)),
      costBreakdown,
    });
  }
}

const metadataRequestSchema = z.object({
  content: z.string().max(100000).optional(),
  url: z
    .string()
    .url()
    .max(2000)
    .refine((val) => val.startsWith("http://") || val.startsWith("https://"), {
      message: "URL 必须以 http:// 或 https:// 开头",
    })
    .refine(
      (val) => {
        try {
          const parsed = new URL(val);
          return !parsed.hostname.match(
            /^(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/i,
          );
        } catch {
          return false;
        }
      },
      { message: "禁止访问内网地址" },
    )
    .optional(),
  file: z.any().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  language: z.string().optional(),
});

const literatureExtractSchema = z.object({
  content: z.string().max(100000).optional(),
  url: z
    .string()
    .url()
    .max(2000)
    .refine((val) => val.startsWith("http://") || val.startsWith("https://"), {
      message: "URL 必须以 http:// 或 https:// 开头",
    })
    .refine(
      (val) => {
        try {
          const parsed = new URL(val);
          return !parsed.hostname.match(
            /^(localhost|127\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/i,
          );
        } catch {
          return false;
        }
      },
      { message: "禁止访问内网地址" },
    )
    .optional(),
  graph_id: z.string().uuid(),
  literature: z
    .object({
      title: z.string().optional(),
      authors: z.array(z.string()).optional(),
      year: z.number().optional(),
      url: z.string().optional(),
      fileName: z.string().optional(),
      type: z.enum(["paper", "book", "article", "document"]).optional(),
    })
    .optional(),
  options: z
    .object({
      extractTypes: z
        .array(
          z.enum([
            "method",
            "mechanism",
            "operation",
            "concept",
            "technology",
            "tool",
          ]),
        )
        .optional(),
      maxConcepts: z.number().min(1).max(50).optional(),
      similarityThreshold: z.number().min(0).max(1).optional(),
      autoDetectMetadata: z.boolean().optional(),
    })
    .optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  language: z.string().optional(),
  session_id: z.string().uuid().optional(),
});

const literatureApplySchema = z.object({
  graph_id: z.string().uuid(),
  concepts: z.array(
    z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(2000),
      type: z.enum([
        "method",
        "mechanism",
        "operation",
        "concept",
        "technology",
        "tool",
      ]),
      source: z.object({
        title: z.string(),
        authors: z.array(z.string()).optional(),
        year: z.number().optional(),
        url: z.string().optional(),
        fileName: z.string().optional(),
        type: z.enum(["paper", "book", "article", "document"]),
        processedAt: z.string(),
      }),
      targetModule: z
        .enum([
          "research_background",
          "literature_review",
          "research_methods",
          "core_concepts",
          "application_domains",
          "future_directions",
        ])
        .optional(),
      similarTo: z.string().optional(),
      similarity: z.number().optional(),
    }),
  ),
  relations: z.array(
    z.object({
      source: z.string(),
      target: z.string(),
      type: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  literature: z.object({
    title: z.string(),
    authors: z.array(z.string()).optional(),
    year: z.number().optional(),
    url: z.string().optional(),
    fileName: z.string().optional(),
    type: z.enum(["paper", "book", "article", "document"]),
    processedAt: z.string(),
  }),
});

router.post(
  "/metadata",
  requireAuth,
  validate(metadataRequestSchema),
  async (req: AuthRequest, res: Response) => {
    const {
      content,
      url,
      file,
      provider: providerType,
      model,
      language,
    } = req.body;
    const supabase = req.supabase;

    if (!supabase) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, {
        message: "Unauthorized: No Supabase client",
      });
    }

    if (!content && !url && !file) {
      throw new AppError(ErrorCodes.VALIDATION_MISSING_FIELD, {
        message: "必须提供 content、url 或 file 参数",
      });
    }

    try {
      let textContent = content || "";

      if (url && !content) {
        logger.info(`Fetching URL content for metadata extraction: ${url}`);
        const scrapedResult = await scrapeUrl(url);
        textContent = scrapedResult.text;
      }

      const metadata = await literatureMetadataService.extractMetadata(
        textContent,
        {
          provider: providerType as AIProviderType | undefined,
          model,
          userId: req.user.id,
          language,
        },
      );

      logger.info("Literature metadata extracted successfully", {
        title: metadata.title,
        type: metadata.type,
        confidence: metadata.confidence,
        userId: req.user.id,
      });

      res.json({
        metadata,
        confidence: metadata.confidence,
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Literature Metadata Extract Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        err.message || "文献元数据提取失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/extract",
  requireAuth,
  validate(literatureExtractSchema),
  async (req: AuthRequest, res: Response) => {
    const {
      content,
      url,
      graph_id,
      literature: inputLiterature,
      options,
      provider: providerType,
      model,
      language,
      session_id,
    } = req.body;
    const supabase = req.supabase;

    if (!supabase) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, {
        message: "Unauthorized: No Supabase client",
      });
    }

    if (!content && !url) {
      throw new AppError(ErrorCodes.VALIDATION_MISSING_FIELD, {
        message: "必须提供 content 或 url 参数",
      });
    }

    const provider = providerType
      ? await getAIProviderForTask("text")
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      throw new AppError(
        "AI provider not configured",
        503,
        ErrorCodes.INTERNAL_ERROR,
      );
    }

    const sessionId = session_id || crypto.randomUUID();

    try {
      let textContent = content || "";
      let literatureTitle = "未知文献";
      let literatureUrl = url;

      if (url && !content) {
        logger.info(`Fetching URL content: ${url}`);
        const scrapedResult = await scrapeUrl(url);
        textContent = scrapedResult.text;
        literatureTitle = scrapedResult.title;
      } else if (content) {
        const firstLine = content
          .split("\n")
          .find((line: string) => line.trim());
        literatureTitle = firstLine?.slice(0, 100) || "文本内容";
      }

      const hasManualLiterature = inputLiterature && inputLiterature.title;

      let literature: LiteratureInfo;

      if (hasManualLiterature) {
        literature = {
          title: inputLiterature.title || literatureTitle,
          authors: inputLiterature.authors,
          year: inputLiterature.year,
          url: inputLiterature.url || literatureUrl,
          fileName: inputLiterature.fileName,
          type: inputLiterature.type || (url ? "article" : "document"),
          processedAt: new Date().toISOString(),
        };
      } else if (options?.autoDetectMetadata) {
        logger.info("Auto-detecting literature metadata");
        const detectedMetadata = await literatureMetadataService.extractMetadata(
          textContent,
          {
            provider: providerType as AIProviderType | undefined,
            model,
            userId: req.user.id,
            graphId: graph_id,
            language,
          },
        );

        literature = {
          title: detectedMetadata.title || literatureTitle,
          authors: detectedMetadata.authors,
          year: detectedMetadata.year,
          url: literatureUrl,
          type: detectedMetadata.type === "report" || detectedMetadata.type === "webpage"
            ? "document"
            : detectedMetadata.type,
          processedAt: new Date().toISOString(),
        };

        logger.info("Literature metadata auto-detected", {
          title: literature.title,
          type: literature.type,
          confidence: detectedMetadata.confidence,
        });
      } else {
        literature = {
          title: literatureTitle,
          url: literatureUrl,
          type: url ? "article" : "document",
          processedAt: new Date().toISOString(),
        };
      }

      const extractOptions = {
        provider: providerType as AIProviderType | undefined,
        model,
        maxConcepts: options?.maxConcepts || 10,
        extractTypes: options?.extractTypes as ConceptType[] | undefined,
        similarityThreshold: options?.similarityThreshold,
        userId: req.user.id,
        graphId: graph_id,
        language,
      };

      const extractionResult = await withLiteratureTracking(
        "literature_extract",
        provider.providerType,
        model || provider.model,
        async () => {
          const result = await conceptExtractorService.extractConcepts(
            textContent,
            literature,
            extractOptions,
          );
          return {
            result,
            usage: undefined,
          };
        },
        await enrichMetadata(supabase, {
          graphId: graph_id,
          userId: req.user.id,
        }),
        sessionId,
      );

      res.json({
        sessionId,
        concepts: extractionResult.concepts,
        relations: extractionResult.relations,
        literature,
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Literature Extract Error:", error);
      if (error instanceof AppError) throw error;
      throw new AppError(
        err.message || "文献概念提取失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/apply",
  requireAuth,
  validate(literatureApplySchema),
  async (req: AuthRequest, res: Response) => {
    const { graph_id, concepts, relations, literature } = req.body;
    const supabase = req.supabase!;

    const startTime = Date.now();

    try {
      logger.info("Applying literature concepts", {
        graphId: graph_id,
        conceptCount: concepts.length,
        relationCount: relations.length,
        literatureTitle: literature.title,
        userId: req.user.id,
      });

      const nodeMapping: Record<string, string> = {};
      let addedCount = 0;
      let mergedCount = 0;

      const conceptsToProcess: ExtractedConcept[] = concepts;
      const conceptsWithEmbedding: Array<{
        concept: ExtractedConcept;
        embedding: number[];
      }> = [];

      for (const concept of conceptsToProcess) {
        const embedding = await aiService.generateEmbedding(
          `${concept.title}: ${concept.description}`,
        );
        if (embedding) {
          conceptsWithEmbedding.push({ concept, embedding });
        }
      }

      const { data: existingGraphNodes } = await supabase
        .from("graph_nodes")
        .select(
          `
          id,
          knowledge_point_id,
          level,
          knowledge_points (
            id,
            title,
            embedding,
            properties
          )
        `,
        )
        .eq("graph_id", graph_id)
        .is("deleted_at", null);

      const existingNodesMap = new Map<
        string,
        { id: string; title: string; embedding: number[] }
      >();

      if (existingGraphNodes) {
        for (const gn of existingGraphNodes) {
          const kp = gn.knowledge_points as unknown as {
            id: string;
            title: string;
            embedding?: number[];
          };
          if (kp && kp.embedding) {
            existingNodesMap.set(kp.id, {
              id: kp.id,
              title: kp.title,
              embedding: kp.embedding,
            });
          }
        }
      }

      const nodesToCreate: Array<{
        tempId: string;
        title: string;
        content: string;
        level: string;
        x_position: number;
        y_position: number;
        targetModule?: BackboneModule;
        source: ConceptSource;
      }> = [];

      const conceptSource: ConceptSource = {
        title: literature.title,
        authors: literature.authors,
        year: literature.year,
        url: literature.url,
        fileName: literature.fileName,
        addedAt: new Date().toISOString(),
      };

      for (let i = 0; i < conceptsWithEmbedding.length; i++) {
        const { concept, embedding } = conceptsWithEmbedding[i];

        let merged = false;
        for (const [existingId, existingNode] of existingNodesMap) {
          const similarity =
            await conceptAggregationService.calculateSimilarity(
              embedding,
              existingNode.embedding,
            );

          if (similarity >= 0.85) {
            const upgradeResult =
              await conceptAggregationService.upgradeNodeLevel(
                supabase,
                existingId,
                [conceptSource],
              );

            if (upgradeResult.success) {
              const { data: existingGN } = await supabase
                .from("graph_nodes")
                .select("id")
                .eq("knowledge_point_id", existingId)
                .eq("graph_id", graph_id)
                .is("deleted_at", null)
                .single();

              if (existingGN) {
                nodeMapping[concept.title] = existingId;
                merged = true;
                mergedCount++;
                logger.info(
                  `Merged concept "${concept.title}" with existing "${existingNode.title}"`,
                );
                break;
              }
            }
          }
        }

        if (!merged) {
          const angle = (i / conceptsWithEmbedding.length) * Math.PI * 2;
          const radius = 15 + i * 2;

          nodesToCreate.push({
            tempId: concept.title,
            title: concept.title,
            content: concept.description,
            level: "normal",
            x_position: Math.round(Math.cos(angle) * radius),
            y_position: Math.round(Math.sin(angle) * radius),
            targetModule: concept.targetModule,
            source: conceptSource,
          });
        }
      }

      if (nodesToCreate.length > 0) {
        const aiNodesData = nodesToCreate.map((node) => ({
          tempId: node.tempId,
          parentId: null,
          title: node.title,
          content: node.content,
          level: node.level,
          x_position: node.x_position,
          y_position: node.y_position,
        }));

        const createResult = await autoGraphService.processAINodes(
          supabase,
          req.user.id,
          graph_id,
          aiNodesData,
        );

        for (const [tempId, mapping] of Object.entries(
          createResult.nodeMapping,
        )) {
          nodeMapping[tempId] = mapping.knowledgePointId;
          addedCount++;

          const nodeData = nodesToCreate.find((n) => n.tempId === tempId);
          if (nodeData && nodeData.source) {
            await supabase
              .from("knowledge_points")
              .update({
                properties: {
                  sources: [nodeData.source],
                  sourceCount: 1,
                  conceptType: conceptsToProcess.find((c) => c.title === tempId)
                    ?.type,
                  backboneModule: nodeData.targetModule,
                },
              })
              .eq("id", mapping.knowledgePointId);
          }
        }
      }

      const edgesToCreate: Array<{
        graph_id: string;
        source_knowledge_point_id: string;
        target_knowledge_point_id: string;
        relationship_type: string;
      }> = [];

      for (const relation of relations) {
        const sourceId = nodeMapping[relation.source];
        const targetId = nodeMapping[relation.target];

        if (sourceId && targetId && sourceId !== targetId) {
          edgesToCreate.push({
            graph_id,
            source_knowledge_point_id: sourceId,
            target_knowledge_point_id: targetId,
            relationship_type: relation.type,
          });
        }
      }

      if (edgesToCreate.length > 0) {
        await autoGraphService.createEdgesBatch(supabase, edgesToCreate);
      }

      const referenceBook: ReferenceBook = {
        title: literature.title,
        author: literature.authors?.join(", ") || "未知作者",
        url: literature.url,
        description: `从${literature.type === "paper" ? "论文" : literature.type === "book" ? "书籍" : "文献"}中提取了 ${concepts.length} 个概念`,
      };

      const { data: currentGraph } = await supabase
        .from("graphs")
        .select("reference_books")
        .eq("id", graph_id)
        .single();

      const currentReferenceBooks = (currentGraph?.reference_books ||
        []) as ReferenceBook[];
      const existingBookIndex = currentReferenceBooks.findIndex(
        (book) =>
          book.title === referenceBook.title ||
          (referenceBook.url && book.url === referenceBook.url),
      );

      if (existingBookIndex >= 0) {
        currentReferenceBooks[existingBookIndex] = referenceBook;
      } else {
        currentReferenceBooks.push(referenceBook);
      }

      await supabase
        .from("graphs")
        .update({
          reference_books: currentReferenceBooks,
          updated_at: new Date().toISOString(),
        })
        .eq("id", graph_id);

      await cacheService.del(CacheKeys.GRAPH_NODES(req.user.id, graph_id));
      await cacheService.del(CacheKeys.GRAPH_NODES("public", graph_id));

      const duration = Date.now() - startTime;

      logger.info("Literature concepts applied successfully", {
        graphId: graph_id,
        addedCount,
        mergedCount,
        edgeCount: edgesToCreate.length,
        duration,
      });

      performanceMonitor.recordLog({
        operation: "literature_apply",
        provider: "openai",
        model: "internal",
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        duration,
        success: true,
        metadata: {
          graphId: graph_id,
          userId: req.user.id,
        },
      });

      res.json({
        success: true,
        addedCount,
        mergedCount,
        nodeMapping,
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Literature Apply Error:", {
        error: err.message,
        stack: err.stack,
      });

      if (error instanceof AppError) throw error;
      throw new AppError(
        err.message || "文献概念应用失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

export default router;
