import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import type { AIProviderType } from "@shared/types";
import { getAIProviderForTask, conceptExtractorService, literatureMetadataService, aiService } from "../../services/ai";
import { logger } from "../../utils/logger";
import { scrapeUrl } from "../../utils/scraper";
import { conceptAggregationService } from "../../services/graph";
import { literatureApplyService } from "../../services/literature";
import { upload } from "../ai/utils";
import type { LiteratureInfo, ConceptType } from "@shared/types/graph";
import { z } from "zod";

const router = Router();

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
  async (req: AuthedRequest, res: Response) => {
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
      throw new AppError(ErrorCodes.AUTH_UNAUTHORIZED, {
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
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/extract",
  requireAuth,
  upload.single("file"),
  async (req: AuthedRequest, res: Response) => {
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
      throw new AppError(ErrorCodes.AUTH_UNAUTHORIZED, {
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
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }

    const sessionId = session_id || crypto.randomUUID();

    try {
      let textContent = content || "";
      let literatureTitle = "未知文献";
      const literatureUrl = url;

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
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/apply",
  requireAuth,
  validate(literatureApplySchema),
  async (req: AuthedRequest, res: Response) => {
    const { graph_id, concepts, relations, literature } = req.body;
    const supabase = req.supabase;

    try {
      const result = await literatureApplyService.applyLiterature(
        supabase,
        req.user.id,
        graph_id,
        concepts,
        relations,
        literature,
      );

      res.json(result);
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
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

export default router;
