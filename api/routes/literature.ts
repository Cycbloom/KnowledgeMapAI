import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";
import type { AIProviderType } from "@shared/types";
import { getAIProviderForTask } from "../services/ai/factory";
import { performanceMonitor } from "../services/ai/performanceMonitor";
import { logger } from "../utils/logger";
import { scrapeUrl } from "../utils/scraper";
import { conceptExtractorService } from "../services/ai/conceptExtractorService";
import {
  conceptAggregationService,
  normalizeTitle,
} from "../services/graph/conceptAggregationService";
import { autoGraphService } from "../services/graph/index";
import { literatureMetadataService } from "../services/ai/literatureMetadataService";
import { cacheService, CacheKeys } from "../services/common/cacheService";
import { aiService } from "../services/ai/aiService";
import { upload } from "./ai/utils";
import type {
  ExtractedConcept,
  LiteratureInfo,
  ConceptType,
  ConceptSource,
  ReferenceBook,
} from "@shared/types/graph";
import { BackboneModule, TITLE_TO_BACKBONE_MODULE } from "@shared/types/graph";
import { z } from "zod";

const router = Router();

const MERGE_THRESHOLD = parseFloat(
  process.env.CONCEPT_MERGE_THRESHOLD || "0.85",
);
const FUZZY_TITLE_CONFIRM_THRESHOLD = 0.75;

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
  file: z.unknown().optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  language: z.string().optional(),
});

const literatureApplySchema = z.object({
  graph_id: z.string().uuid(),
  concepts: z.array(
    z.object({
      title: z.string().min(1).max(200),
      description: z.string().max(2000),
      type: z.preprocess(
        (val) => {
          const VALID_TYPES = [
            "method",
            "mechanism",
            "operation",
            "concept",
            "technology",
            "tool",
            "theory",
            "finding",
            "trend",
            "challenge",
          ] as const;
          if (
            typeof val === "string" &&
            (VALID_TYPES as readonly string[]).includes(val)
          ) {
            return val;
          }
          logger.warn("Normalizing invalid concept type", { received: val });
          return "concept";
        },
        z.enum([
          "method",
          "mechanism",
          "operation",
          "concept",
          "technology",
          "tool",
          "theory",
          "finding",
          "trend",
          "challenge",
        ]),
      ),
      source: z.object({
        title: z.string(),
        authors: z.array(z.string()).optional(),
        year: z.number().optional(),
        url: z.string().optional(),
        fileName: z.string().optional(),
        type: z.enum(["paper", "book", "article", "document"]).optional(),
        processedAt: z.string().optional(),
        addedAt: z.string().optional(),
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
  upload.single("file"),
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
    const file = req.file;
    const supabase = req.supabase;

    if (!supabase) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, {
        message: "Unauthorized: No Supabase client",
      });
    }

    const parsedLiterature = inputLiterature
      ? typeof inputLiterature === "string"
        ? JSON.parse(inputLiterature)
        : inputLiterature
      : undefined;
    const parsedOptions = options
      ? typeof options === "string"
        ? JSON.parse(options)
        : options
      : undefined;

    if (!content && !url && !file) {
      throw new AppError(ErrorCodes.VALIDATION_MISSING_FIELD, {
        message: "必须提供 content、url 或 file 参数",
      });
    }

    if (!graph_id) {
      throw new AppError(ErrorCodes.VALIDATION_MISSING_FIELD, {
        message: "必须提供 graph_id 参数",
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

      if (file) {
        logger.info(`Processing uploaded file: ${file.originalname}`);
        const fileBuffer = file.buffer;
        const fileContent = fileBuffer.toString("utf-8");
        textContent = fileContent;
        literatureTitle = file.originalname.replace(/\.[^/.]+$/, "");
      } else if (url && !content) {
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

      const hasManualLiterature = parsedLiterature && parsedLiterature.title;

      let literature: LiteratureInfo;

      if (hasManualLiterature) {
        literature = {
          title: parsedLiterature.title || literatureTitle,
          authors: parsedLiterature.authors,
          year: parsedLiterature.year,
          url: parsedLiterature.url || literatureUrl,
          fileName:
            parsedLiterature.fileName || (file ? file.originalname : undefined),
          type:
            parsedLiterature.type ||
            (file ? "document" : url ? "article" : "document"),
          processedAt: new Date().toISOString(),
          journal: parsedLiterature.journal,
          doi: parsedLiterature.doi,
          keywords: parsedLiterature.keywords,
          abstract: parsedLiterature.abstract,
          volume: parsedLiterature.volume,
          issue: parsedLiterature.issue,
          pages: parsedLiterature.pages,
          publisher: parsedLiterature.publisher,
          notes: parsedLiterature.notes,
        };
      } else if (parsedOptions?.autoDetectMetadata) {
        logger.info("Auto-detecting literature metadata");
        const detectedMetadata =
          await literatureMetadataService.extractMetadata(textContent, {
            provider: providerType as AIProviderType | undefined,
            model,
            userId: req.user.id,
            graphId: graph_id,
            language,
            sessionId,
          });

        literature = {
          title: detectedMetadata.title || literatureTitle,
          authors: detectedMetadata.authors,
          year: detectedMetadata.year,
          url: literatureUrl,
          type:
            detectedMetadata.type === "report" ||
            detectedMetadata.type === "webpage"
              ? "document"
              : detectedMetadata.type,
          processedAt: new Date().toISOString(),
          journal: detectedMetadata.journal,
          doi: detectedMetadata.doi,
          keywords: detectedMetadata.keywords,
          abstract: detectedMetadata.abstract,
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
        maxConcepts: parsedOptions?.maxConcepts ?? 50,
        preferredCount: parsedOptions?.preferredCount ?? 10,
        extractTypes: parsedOptions?.extractTypes as ConceptType[] | undefined,
        similarityThreshold: parsedOptions?.similarityThreshold ?? 0.7,
        userId: req.user.id,
        graphId: graph_id,
        language,
        sessionId,
      };

      const extractionResult = await conceptExtractorService.extractConcepts(
        textContent,
        literature,
        extractOptions,
      );

      const conceptsWithMatches = extractionResult.concepts.map((c) => ({
        ...c,
        crossGraphMatch: null as {
          kpId: string;
          kpTitle: string;
          graphTitle: string;
          graphId: string;
          similarity: number;
        } | null,
      }));

      if (graph_id && conceptsWithMatches.length > 0) {
        const conceptTexts = conceptsWithMatches.map(
          (c) => `${c.title}: ${c.description}`,
        );
        const embeddings =
          await aiService.generateEmbeddingsBatch(conceptTexts);

        const conceptEmbeddings: Array<{
          title: string;
          embedding: number[];
        }> = [];

        for (let i = 0; i < conceptsWithMatches.length; i++) {
          const emb = embeddings[i];
          if (emb) {
            conceptEmbeddings.push({
              title: conceptsWithMatches[i].title,
              embedding: emb,
            });
          }
        }

        if (conceptEmbeddings.length > 0) {
          const crossGraphMatches =
            await conceptAggregationService.findCrossGraphSimilar(
              supabase,
              req.user.id,
              graph_id,
              conceptEmbeddings,
            );

          for (const concept of conceptsWithMatches) {
            const matches = crossGraphMatches[concept.title];
            if (matches && matches.length > 0) {
              concept.crossGraphMatch = matches[0];
            }
          }
        }
      }

      res.json({
        sessionId,
        concepts: conceptsWithMatches,
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

      // Track mounting statistics
      const mountingDetails: Array<{
        conceptTitle: string;
        targetModule?: BackboneModule;
        mountedTo: string | null;
        status: "success" | "failed";
        reason?: string;
      }> = [];

      const conceptsToProcess: ExtractedConcept[] = concepts;

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
        { id: string; title: string; embedding?: number[] | undefined }
      >();

      const normalizedTitleMap = new Map<
        string,
        { id: string; title: string; embedding?: number[] | undefined }
      >();

      if (existingGraphNodes) {
        for (const gn of existingGraphNodes) {
          const kp = gn.knowledge_points as unknown as {
            id: string;
            title: string;
            embedding?: number[];
          };
          if (kp) {
            existingNodesMap.set(kp.id, {
              id: kp.id,
              title: kp.title,
              embedding: kp.embedding,
            });
            normalizedTitleMap.set(normalizeTitle(kp.title), {
              id: kp.id,
              title: kp.title,
              embedding: kp.embedding,
            });
          }
        }
      }

      logger.info("Existing nodes loaded", {
        existingNodeCount: existingNodesMap.size,
        normalizedTitleCount: normalizedTitleMap.size,
      });

      const conceptSource: ConceptSource = {
        title: literature.title,
        authors: literature.authors,
        year: literature.year,
        url: literature.url,
        fileName: literature.fileName,
        addedAt: new Date().toISOString(),
      };

      // Save complete literature metadata to literature_sources table
      try {
        const { data: existingLiterature, error: litError } = await supabase
          .from("literature_sources")
          .select("id")
          .eq("graph_id", graph_id)
          .eq("title", literature.title)
          .maybeSingle();

        if (litError) {
          logger.warn(
            "Failed to check existing literature source:",
            litError.message,
          );
        }

        if (!existingLiterature) {
          const { error: insertLitError } = await supabase
            .from("literature_sources")
            .insert({
              graph_id: graph_id,
              title: literature.title,
              authors: literature.authors,
              year: literature.year,
              type: literature.type || "document",
              journal: literature.journal,
              doi: literature.doi,
              url: literature.url,
              file_name: literature.fileName,
              keywords: literature.keywords,
              abstract: literature.abstract,
              volume: (literature as { volume?: string }).volume,
              issue: (literature as { issue?: string }).issue,
              pages: (literature as { pages?: string }).pages,
              publisher: (literature as { publisher?: string }).publisher,
              notes: (literature as { notes?: string }).notes,
            });

          if (insertLitError) {
            logger.warn(
              "Failed to save literature source:",
              insertLitError.message,
            );
          } else {
            logger.info("Literature source saved successfully", {
              title: literature.title,
              type: literature.type,
            });
          }
        } else {
          const existingData = existingLiterature as {
            id: string;
            journal?: string;
            doi?: string;
            keywords?: string[];
            abstract?: string;
          };
          const updateData: {
            journal?: string;
            doi?: string;
            keywords?: string[];
            abstract?: string;
          } = {};
          if (!existingData.journal && literature.journal)
            updateData.journal = literature.journal;
          if (!existingData.doi && literature.doi)
            updateData.doi = literature.doi;
          if (!existingData.keywords?.length && literature.keywords?.length)
            updateData.keywords = literature.keywords;
          if (!existingData.abstract && literature.abstract)
            updateData.abstract = literature.abstract;

          if (Object.keys(updateData).length > 0) {
            await supabase
              .from("literature_sources")
              .update(updateData)
              .eq("id", existingLiterature.id);
          }
        }
      } catch (litSaveError) {
        logger.warn("Exception while saving literature source:", litSaveError);
      }

      let titleDedupCount = 0;
      const remainingConcepts: (ExtractedConcept & {
        originalIndex: number;
      })[] = [];

      for (let i = 0; i < conceptsToProcess.length; i++) {
        const concept = conceptsToProcess[i];
        const normTitle = normalizeTitle(concept.title);

        const existingMatch = normalizedTitleMap.get(normTitle);
        if (existingMatch) {
          const upgradeResult =
            await conceptAggregationService.upgradeNodeLevel(
              supabase,
              existingMatch.id,
              [conceptSource],
            );

          if (upgradeResult.success) {
            const { data: existingGN } = await supabase
              .from("graph_nodes")
              .select("id")
              .eq("knowledge_point_id", existingMatch.id)
              .eq("graph_id", graph_id)
              .is("deleted_at", null)
              .single();

            if (existingGN) {
              nodeMapping[concept.title] = existingMatch.id;
              mergedCount++;
              titleDedupCount++;
              logger.info(
                `Title dedup: "${concept.title}" merged with existing "${existingMatch.title}"`,
              );
              continue;
            }
          }
        }

        const batchDuplicate = remainingConcepts.find(
          (rc) => normalizeTitle(rc.title) === normTitle,
        );
        if (batchDuplicate) {
          if (concept.description.length > batchDuplicate.description.length) {
            batchDuplicate.description = concept.description;
          }
          logger.info(
            `Batch title dedup: "${concept.title}" merged with "${batchDuplicate.title}"`,
          );
          continue;
        }

        remainingConcepts.push({ ...concept, originalIndex: i });
      }

      logger.info("Title dedup completed", {
        titleDedupCount,
        remainingCount: remainingConcepts.length,
      });

      const conceptsWithEmbedding: Array<{
        concept: ExtractedConcept;
        embedding: number[] | null;
        originalIndex?: number;
      }> = [];

      logger.info("Processing concepts for embedding", {
        totalConcepts: remainingConcepts.length,
        conceptTitles: remainingConcepts.map((c) => c.title),
      });

      const conceptTexts = remainingConcepts.map(
        (c) => `${c.title}: ${c.description}`,
      );
      const batchEmbeddings =
        await aiService.generateEmbeddingsBatch(conceptTexts);

      for (let i = 0; i < remainingConcepts.length; i++) {
        const concept = remainingConcepts[i];
        const embedding = batchEmbeddings[i] ?? null;
        if (embedding === null) {
          logger.warn(
            `Failed to generate embedding for concept: ${concept.title}`,
          );
        }
        conceptsWithEmbedding.push({
          concept,
          embedding,
          originalIndex: concept.originalIndex,
        });
      }

      const successCount = conceptsWithEmbedding.filter(
        (c) => c.embedding !== null,
      ).length;
      logger.info("Embeddings generated", {
        successCount,
        failedCount: remainingConcepts.length - successCount,
      });

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

      for (let i = 0; i < conceptsWithEmbedding.length; i++) {
        const { concept, embedding } = conceptsWithEmbedding[i];
        let merged = false;

        if (embedding) {
          let fuzzyTitleMatched = false;
          const normConceptTitle = normalizeTitle(concept.title);
          for (const [, existingNode] of normalizedTitleMap) {
            const normExisting = normalizeTitle(existingNode.title);
            if (
              normConceptTitle.includes(normExisting) ||
              normExisting.includes(normConceptTitle)
            ) {
              if (!existingNode.embedding) continue;
              const titleSimilarity =
                await conceptAggregationService.calculateSimilarity(
                  embedding,
                  existingNode.embedding,
                );
              if (titleSimilarity >= FUZZY_TITLE_CONFIRM_THRESHOLD) {
                const upgradeResult =
                  await conceptAggregationService.upgradeNodeLevel(
                    supabase,
                    existingNode.id,
                    [conceptSource],
                  );
                if (upgradeResult.success) {
                  const { data: existingGN } = await supabase
                    .from("graph_nodes")
                    .select("id")
                    .eq("knowledge_point_id", existingNode.id)
                    .eq("graph_id", graph_id)
                    .is("deleted_at", null)
                    .single();
                  if (existingGN) {
                    nodeMapping[concept.title] = existingNode.id;
                    merged = true;
                    mergedCount++;
                    fuzzyTitleMatched = true;
                    logger.info(
                      `Fuzzy title merge: "${concept.title}" matched existing "${existingNode.title}" (sim: ${titleSimilarity.toFixed(3)})`,
                    );
                    break;
                  }
                }
              }
            }
          }
          if (fuzzyTitleMatched) continue;

          try {
            const { data: similarResults, error: rpcError } =
              await supabase.rpc("match_knowledge_points", {
                query_embedding: embedding,
                match_threshold: MERGE_THRESHOLD,
                match_count: 5,
              });

            if (!rpcError && similarResults && Array.isArray(similarResults)) {
              for (const similar of similarResults) {
                const existingNode = existingNodesMap.get(similar.id);
                if (!existingNode) continue;

                if (similar.similarity >= MERGE_THRESHOLD) {
                  const upgradeResult =
                    await conceptAggregationService.upgradeNodeLevel(
                      supabase,
                      similar.id,
                      [conceptSource],
                    );

                  if (upgradeResult.success) {
                    const { data: existingGN } = await supabase
                      .from("graph_nodes")
                      .select("id")
                      .eq("knowledge_point_id", similar.id)
                      .eq("graph_id", graph_id)
                      .is("deleted_at", null)
                      .single();

                    if (existingGN) {
                      nodeMapping[concept.title] = similar.id;
                      merged = true;
                      mergedCount++;
                      logger.info(
                        `Merged concept "${concept.title}" with existing "${existingNode.title}" (pgvector)`,
                      );
                      break;
                    }
                  }
                }
              }
            } else {
              logger.warn(
                "pgvector RPC failed, falling back to in-memory similarity",
              );
              for (const [existingId, existingNode] of existingNodesMap) {
                if (!existingNode.embedding) continue;
                const similarity =
                  await conceptAggregationService.calculateSimilarity(
                    embedding,
                    existingNode.embedding,
                  );

                if (similarity >= MERGE_THRESHOLD) {
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
            }
          } catch (rpcException) {
            logger.warn(
              "pgvector RPC exception, falling back to in-memory similarity",
            );
            for (const [existingId, existingNode] of existingNodesMap) {
              if (!existingNode.embedding) continue;
              const similarity =
                await conceptAggregationService.calculateSimilarity(
                  embedding,
                  existingNode.embedding,
                );

              if (similarity >= MERGE_THRESHOLD) {
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
                    break;
                  }
                }
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

      logger.info("Nodes to create determined", {
        nodesToCreateCount: nodesToCreate.length,
        mergedCount,
        conceptsWithEmbeddingCount: conceptsWithEmbedding.length,
      });

      const { data: backboneNodes } = await supabase
        .from("graph_nodes")
        .select(
          `
          id,
          level,
          knowledge_point_id,
          knowledge_points (
            id,
            title,
            properties
          )
        `,
        )
        .eq("graph_id", graph_id)
        .is("deleted_at", null);

      const backboneModuleMap = new Map<BackboneModule, string>();
      const backboneNodeIds = new Set<string>();

      if (backboneNodes) {
        for (const gn of backboneNodes) {
          if (gn.level !== "root" && gn.level !== "core") {
            continue;
          }

          const kp = gn.knowledge_points as unknown as {
            id: string;
            title: string;
            properties?: { backboneModule?: BackboneModule };
          };

          if (!kp) continue;

          let moduleValue = kp?.properties?.backboneModule;

          if (!moduleValue) {
            const matchedModule = TITLE_TO_BACKBONE_MODULE[kp.title.trim()];
            if (matchedModule) {
              moduleValue = matchedModule;
              logger.info(`Auto-matched backbone node by title`, {
                nodeId: gn.id,
                nodeTitle: kp.title,
                matchedModule,
              });
            }
          }

          if (moduleValue && !backboneModuleMap.has(moduleValue)) {
            backboneModuleMap.set(moduleValue, gn.id);
            backboneNodeIds.add(gn.id);
          }
        }
      }

      logger.info("Backbone nodes loaded", {
        backboneModuleCount: backboneModuleMap.size,
        modules: Array.from(backboneModuleMap.keys()),
        moduleDetails: Array.from(backboneModuleMap.entries()).map(
          ([module, id]) => ({
            module,
            nodeId: id,
          }),
        ),
        totalBackboneNodes: backboneNodes?.length || 0,
        nodesWithoutModule: (backboneNodes || []).filter((gn) => {
          const kp = gn.knowledge_points as unknown as {
            properties?: { backboneModule?: BackboneModule };
          };
          return !kp?.properties?.backboneModule;
        }).length,
      });

      if (nodesToCreate.length > 0) {
        const embeddingByTitle = new Map<string, number[]>();
        for (const cwe of conceptsWithEmbedding) {
          if (cwe.embedding) {
            embeddingByTitle.set(cwe.concept.title, cwe.embedding);
          }
        }

        const aiNodesData = nodesToCreate.map((node) => {
          const backboneNodeId = node.targetModule
            ? backboneModuleMap.get(node.targetModule)
            : null;

          if (node.targetModule && !backboneNodeId) {
            logger.warn(
              `Backbone node not found for module: ${node.targetModule}, concept "${node.title}" will be created as root node`,
            );
          }

          return {
            tempId: node.tempId,
            parentId: backboneNodeId || null,
            title: node.title,
            content: node.content,
            level: node.level,
            x_position: node.x_position,
            y_position: node.y_position,
            embedding: embeddingByTitle.get(node.title),
          };
        });

        logger.info("Nodes to create with parentId", {
          nodeCount: aiNodesData.length,
          nodesWithParent: aiNodesData.filter((n) => n.parentId).length,
          nodesWithoutParent: aiNodesData.filter((n) => !n.parentId).length,
          nodeDetails: aiNodesData.map((n) => ({
            title: n.title,
            parentId: n.parentId,
            targetModule: nodesToCreate.find((nd) => nd.tempId === n.tempId)
              ?.targetModule,
          })),
        });

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
            // First, get the current properties
            const { data: currentKP } = await supabase
              .from("knowledge_points")
              .select("properties")
              .eq("id", mapping.knowledgePointId)
              .single();

            const currentProperties =
              (currentKP?.properties as Record<string, unknown>) || {};

            // Merge the new properties with existing ones
            const updatedProperties = {
              ...currentProperties,
              sources: [nodeData.source],
              sourceCount: 1,
              conceptType: conceptsToProcess.find((c) => c.title === tempId)
                ?.type,
              backboneModule: nodeData.targetModule,
            };

            const { error: updateError } = await supabase
              .from("knowledge_points")
              .update({
                properties: updatedProperties,
              })
              .eq("id", mapping.knowledgePointId);

            if (updateError) {
              logger.error("Failed to update knowledge point properties", {
                knowledgePointId: mapping.knowledgePointId,
                error: updateError.message,
              });
            } else {
              logger.info("Updated knowledge point properties", {
                knowledgePointId: mapping.knowledgePointId,
                backboneModule: nodeData.targetModule,
                conceptType: updatedProperties.conceptType,
              });
            }
          }

          // Track mounting status
          const nodeDataForMounting = nodesToCreate.find(
            (n) => n.tempId === tempId,
          );
          const aiNodeData = aiNodesData.find((n) => n.tempId === tempId);

          mountingDetails.push({
            conceptTitle: tempId,
            targetModule: nodeDataForMounting?.targetModule,
            mountedTo: aiNodeData?.parentId || null,
            status: aiNodeData?.parentId ? "success" : "failed",
            reason:
              nodeDataForMounting?.targetModule && !aiNodeData?.parentId
                ? "骨干节点不存在"
                : undefined,
          });
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

      const mountingSuccessCount = mountingDetails.filter(
        (m) => m.status === "success",
      ).length;
      const mountingFailedCount = mountingDetails.filter(
        (m) => m.status === "failed",
      ).length;
      const mountingFailedDetails = mountingDetails
        .filter((m) => m.status === "failed")
        .map((m) => ({
          concept: m.conceptTitle,
          targetModule: m.targetModule,
          reason: m.reason,
        }));

      logger.info("Literature concepts applied successfully", {
        graphId: graph_id,
        addedCount,
        mergedCount,
        edgeCount: edgesToCreate.length,
        duration,
        mountingStats: {
          total: mountingDetails.length,
          success: mountingSuccessCount,
          failed: mountingFailedCount,
          failedDetails: mountingFailedDetails,
        },
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
        mountingDetails,
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
