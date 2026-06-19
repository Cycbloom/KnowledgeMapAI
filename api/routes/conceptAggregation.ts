import { Router, type Response } from "express";
import {
  requireAuth,
  type AuthRequest,
} from "../middleware/auth";
import { validate } from "../middleware/validate";
import { AppError } from "../middleware/errorHandler";
import { ErrorCodes } from "../../shared/types/errorCodes";
import {
  conceptAnalysisService,
  type AnalysisResult,
} from "../services/graph";
import {
  conceptAggregationService,
} from "../services/graph";
import { logger } from "../utils/logger";
import { setSSEHeaders } from "./ai/utils";
import { z } from "zod";

const router = Router();

const analyzeSchema = z.object({
  params: z.object({
    graphId: z.string().uuid(),
  }),
  body: z
    .object({
      similarityThreshold: z.number().min(0).max(1).optional(),
      hierarchyThreshold: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

const mergeSchema = z.object({
  params: z.object({
    graphId: z.string().uuid(),
  }),
  body: z.object({
    groups: z.array(
      z.object({
        targetId: z.string().uuid(),
        sourceIds: z.array(z.string().uuid()).min(1),
      }),
    ),
  }),
});

const hierarchySchema = z.object({
  params: z.object({
    graphId: z.string().uuid(),
  }),
  body: z.object({
    relations: z.array(
      z.object({
        parentId: z.string().uuid(),
        childId: z.string().uuid(),
      }),
    ),
  }),
});

router.post(
  "/:graphId/concept-aggregation/analyze",
  requireAuth,
  validate(analyzeSchema),
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const { similarityThreshold, hierarchyThreshold } = req.body || {};
    const supabase = req.supabase!;

    try {
      logger.info("Starting concept aggregation analysis", {
        graphId,
        userId: req.user.id,
        similarityThreshold,
        hierarchyThreshold,
      });

      const result: AnalysisResult =
        await conceptAnalysisService.analyzeConcepts(supabase, {
          graphId,
          similarityThreshold,
          hierarchyThreshold,
          onProgress: (progress) => {
            logger.info("Analysis progress", {
              graphId,
              stage: progress.stage,
              progress: `${progress.current}/${progress.total}`,
              message: progress.message,
            });
          },
        });

      logger.info("Concept aggregation analysis completed", {
        graphId,
        jobId: result.jobId,
        status: result.status,
        groupsFound: result.summary.groupsFound,
        potentialMerges: result.summary.potentialMerges,
        duration: result.completedAt && result.startedAt
          ? new Date(result.completedAt).getTime() -
            new Date(result.startedAt).getTime()
          : undefined,
      });

      res.json({
        jobId: result.jobId,
        status: result.status,
        message:
          result.status === "completed"
            ? "分析完成"
            : result.status === "running"
              ? "分析已启动"
              : "分析失败",
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Concept aggregation analysis failed", {
        error: err.message,
        stack: err.stack,
        graphId,
        userId: req.user.id,
      });

      if (error instanceof AppError) throw error;

      throw new AppError(
        err.message || "概念聚合分析失败",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

router.get(
  "/:graphId/concept-aggregation/results",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const { jobId } = req.query;

    try {
      const acceptSSE = req.headers.accept?.includes("text/event-stream");

      if (acceptSSE) {
        setSSEHeaders(res);
        res.flushHeaders();

        logger.info("SSE connection established for concept aggregation results", {
          graphId,
          userId: req.user.id,
        });

        res.write(
          `data: ${JSON.stringify({ type: "connected", message: "SSE connection established" })}\n\n`,
        );

        setTimeout(async () => {
          try {
            const result: AnalysisResult =
              await conceptAnalysisService.analyzeConcepts(req.supabase!, {
                graphId,
                onProgress: (progress) => {
                  res.write(
                    `data: ${JSON.stringify({ type: "progress", data: progress })}\n\n`,
                  );
                },
              });

            res.write(
              `data: ${JSON.stringify({ type: "complete", data: result })}\n\n`,
            );
            res.write("data: [DONE]\n\n");
            res.end();
          } catch (error: unknown) {
            const err = error as Error;
            logger.error("SSE stream error for concept aggregation", {
              error: err.message,
              graphId,
            });

            res.write(
              `data: ${JSON.stringify({ type: "error", error: err.message })}\n\n`,
            );
            res.end();
          }
        }, 100);

        return;
      }

      logger.info("Fetching concept aggregation results", {
        graphId,
        jobId,
        userId: req.user.id,
      });

      const result: AnalysisResult =
        await conceptAnalysisService.analyzeConcepts(req.supabase!, {
          graphId,
        });

      res.json({
        jobId: result.jobId,
        status: result.status,
        similarGroups: result.similarGroups,
        hierarchySuggestions: result.hierarchySuggestions,
        summary: result.summary,
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Failed to fetch concept aggregation results", {
        error: err.message,
        graphId,
        jobId,
        userId: req.user.id,
      });

      if (error instanceof AppError) throw error;

      throw new AppError(
        err.message || "获取概念聚合结果失败",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/:graphId/concept-aggregation/merge",
  requireAuth,
  validate(mergeSchema),
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const { groups } = req.body;

    try {
      logger.info("Starting concept merge operation", {
        graphId,
        groupCount: groups.length,
        totalSourceIds: groups.reduce(
          (sum: number, g: { sourceIds: string[] }) => sum + g.sourceIds.length,
          0,
        ),
        userId: req.user.id,
      });

      const result = await conceptAggregationService.batchMerge(
        req.supabase!,
        graphId,
        groups,
        req.user.id,
      );

      res.json({
        mergedCount: result.totalMergedCount,
        upgradedNodes: result.mergedGroups,
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Concept merge operation failed", {
        error: err.message,
        stack: err.stack,
        graphId,
        userId: req.user.id,
      });

      if (error instanceof AppError) throw error;

      throw new AppError(
        err.message || "概念合并操作失败",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/:graphId/concept-aggregation/hierarchy",
  requireAuth,
  validate(hierarchySchema),
  async (req: AuthRequest, res: Response) => {
    const { graphId } = req.params;
    const { relations } = req.body;

    try {
      logger.info("Applying hierarchy relations", {
        graphId,
        relationCount: relations.length,
        userId: req.user.id,
      });

      const result = await conceptAggregationService.batchUpdateHierarchy(
        req.supabase!,
        graphId,
        req.user.id,
        relations,
      );

      res.json(result);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Failed to apply hierarchy relations", {
        error: err.message,
        stack: err.stack,
        graphId,
        userId: req.user.id,
      });

      if (error instanceof AppError) throw error;

      throw new AppError(
        err.message || "应用层级关系失败",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

export default router;
