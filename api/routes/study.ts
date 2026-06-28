import { Router, type Response } from "express";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createCardSchema,
  createCardsBatchSchema,
  updateCardProgressSchema,
} from "../schemas/index";
import { cacheService, CacheKeys } from "../services/common";
import { ErrorCodes } from "../../shared/types/errorCodes";
import { AppError } from "../middleware/errorHandler";
import { studyService, studyRouteService, StudyRouteService } from "../services/study";
import { fsrsParameterService } from "../services/study/fsrsParameterService";
import { semanticInterferenceService } from "../services/study/semanticInterferenceService";
import type { StudyCard } from "../../shared/types/common";
import { logger } from "../utils/logger";

const router = Router();

interface CardBatchItem {
  knowledge_point_id: string;
  question: string;
  answer: string;
  explanation?: string;
  card_type?: StudyCard["card_type"];
  type?: StudyCard["card_type"];
  options?: string[];
}

router.get("/stats", requireAuth, async (req: AuthedRequest, res: Response) => {
  const { graph_id } = req.query;

  try {
    const stats = await studyService.getStudyStats(
      req.supabase,
      req.user.id,
      graph_id as string | undefined,
    );

    res.json(stats);
  } catch (error) {
    const err = error as Error;
    logger.error("Error fetching study stats:", error);
    throw new AppError(
      err.message || "获取学习统计失败",
      500,
      ErrorCodes.SYSTEM_INTERNAL_ERROR,
    );
  }
});

/**
 * @openapi
 * /study/cards:
 *   get:
 *     summary: Get study cards
 *     description: Retrieve flashcards for a specific graph or node. Supports filtering by due date.
 *     tags: [Study]
 *     parameters:
 *       - in: query
 *         name: graph_id
 *         schema:
 *           type: string
 *         description: ID of the knowledge graph
 *       - in: query
 *         name: knowledge_point_id
 *         schema:
 *           type: string
 *         description: ID of a specific knowledge point
 *       - in: query
 *         name: knowledge_point_ids
 *         schema:
 *           type: string
 *         description: Comma-separated IDs of knowledge points
 *       - in: query
 *         name: due
 *         schema:
 *           type: boolean
 *         description: If true, returns only cards due for review
 *       - in: query
 *         name: refresh
 *         schema:
 *           type: boolean
 *         description: Force refresh cache
 *     responses:
 *       200:
 *         description: List of study cards
 */
router.get("/cards", requireAuth, async (req: AuthedRequest, res: Response) => {
  const { graphId, knowledgePointId, knowledgePointIds, dueOnly, refresh } =
    StudyRouteService.parseCardQueryParams(req.query as Record<string, unknown>);

  if (graphId && refresh) {
    await cacheService.del(CacheKeys.STUDY_CARDS(graphId));
  }

  try {
    const cards = await studyService.getCards(req.supabase, {
      userId: req.user.id,
      graphId,
      knowledgePointId,
      knowledgePointIds,
      dueOnly,
    });

    res.json(cards);
  } catch (error) {
    const err = error as Error;
    logger.error("Error fetching cards:", error);
    throw new AppError(
      err.message || "获取学习卡片失败",
      500,
      ErrorCodes.SYSTEM_INTERNAL_ERROR,
    );
  }
});

/**
 * @openapi
 * /study/cards:
 *   post:
 *     summary: Create a flashcard
 *     description: Create a new flashcard for a knowledge point
 *     tags: [Study]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - knowledge_point_id
 *               - question
 *               - answer
 *             properties:
 *               knowledge_point_id:
 *                 type: string
 *               question:
 *                 type: string
 *               answer:
 *                 type: string
 *               explanation:
 *                 type: string
 *               card_type:
 *                 type: string
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Created card
 */
router.post(
  "/cards",
  requireAuth,
  validate(createCardSchema),
  async (req: AuthedRequest, res: Response) => {
    const {
      knowledge_point_id,
      question,
      answer,
      explanation,
      card_type,
      options,
    } = req.body;

    try {
      const card = await studyRouteService.createCardWithGraphNode(
        req.supabase,
        req.user.id,
        {
          knowledge_point_id,
          question,
          answer,
          explanation,
          card_type,
          options,
        },
      );

      res.status(201).json(card);
    } catch (error) {
      const err = error as Error;
      logger.error("Error creating card:", error);
      throw new AppError(
        err.message || "创建学习卡片失败",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

/**
 * @openapi
 * /study/cards/batch:
 *   post:
 *     summary: Create multiple flashcards
 *     description: Create multiple flashcards in a batch
 *     tags: [Study]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - cards
 *             properties:
 *               cards:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - knowledge_point_id
 *                     - question
 *                     - answer
 *                   properties:
 *                     knowledge_point_id:
 *                       type: string
 *                     question:
 *                       type: string
 *                     answer:
 *                       type: string
 *                     explanation:
 *                       type: string
 *                     card_type:
 *                       type: string
 *                     options:
 *                       type: array
 *                       items:
 *                         type: string
 *     responses:
 *       201:
 *         description: Created cards
 */
router.post(
  "/cards/batch",
  requireAuth,
  validate(createCardsBatchSchema),
  async (req: AuthedRequest, res: Response) => {
    const { cards } = req.body;
    const typedCards = cards as CardBatchItem[];

    try {
      const createdCards = await studyRouteService.createCardsBatchWithGraphNodes(
        req.supabase,
        req.user.id,
        typedCards,
      );
      res.status(201).json(createdCards);
    } catch (error) {
      const err = error as Error;
      logger.error("Error creating cards batch:", error);
      throw new AppError(
        err.message || "创建学习卡片失败",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

/**
 * @openapi
 * /study/cards/{id}/progress:
 *   put:
 *     summary: Update card progress
 *     description: Update learning progress for a card using FSRS algorithm
 *     tags: [Study]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: Card ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - quality
 *             properties:
 *               quality:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 5
 *                 description: Quality rating (0-5)
 *     responses:
 *       200:
 *         description: Updated card
 */
router.put(
  "/cards/:id/progress",
  requireAuth,
  validate(updateCardProgressSchema),
  async (req: AuthedRequest, res: Response) => {
    const { id } = req.params;
    const { quality } = req.body;

    try {
      const result = await studyService.updateProgress(
        req.supabase,
        id,
        quality,
        req.user.id,
      );

      res.json(result.card);
    } catch (error) {
      const err = error as Error;
      logger.error("Error updating card progress:", error);
      if (err.message === "Card not found") {
        throw new AppError("未找到卡片", 404, ErrorCodes.RESOURCE_CARD_NOT_FOUND);
      }
      throw new AppError(
        err.message || "更新卡片进度失败",
        500,
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  },
);

/**
 * @openapi
 * /study/progress:
 *   get:
 *     summary: Get study progress
 *     description: Get learning progress for a graph
 *     tags: [Study]
 *     parameters:
 *       - in: query
 *         name: graph_id
 *         schema:
 *           type: string
 *         description: ID of the knowledge graph
 *     responses:
 *       200:
 *         description: Study progress data
 */
router.get(
  "/progress",
  requireAuth,
  async (req: AuthedRequest, res: Response) => {
    const { graph_id } = req.query;

    const data = await studyRouteService.getProgress(
      req.supabase,
      req.user.id,
      graph_id as string,
    );

    res.json(data);
  },
);

router.get("/fsrs-parameters", requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const params = await fsrsParameterService.getParameters(
      req.supabase,
      req.user.id,
    );
    res.json(params);
  } catch (error) {
    const err = error as Error;
    logger.error("Error fetching FSRS parameters:", error);
    throw new AppError(
      err.message || "获取 FSRS 参数失败",
      500,
      ErrorCodes.SYSTEM_INTERNAL_ERROR,
    );
  }
});

router.put("/fsrs-parameters", requireAuth, async (req: AuthedRequest, res: Response) => {
  const { w } = req.body as { w: number[] };

  if (!Array.isArray(w) || w.length === 0) {
    throw new AppError("w 参数必须是非空数组", 400, ErrorCodes.VALIDATION_INVALID_PARAMS);
  }

  try {
    const params = await fsrsParameterService.setParameters(
      req.supabase,
      req.user.id,
      w,
    );
    res.json(params);
  } catch (error) {
    const err = error as Error;
    logger.error("Error setting FSRS parameters:", error);
    throw new AppError(
      err.message || "设置 FSRS 参数失败",
      500,
      ErrorCodes.SYSTEM_INTERNAL_ERROR,
    );
  }
});

router.delete("/fsrs-parameters", requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    await fsrsParameterService.resetParameters(
      req.supabase,
      req.user.id,
    );
    res.json({ success: true, message: "已重置为默认参数" });
  } catch (error) {
    const err = error as Error;
    logger.error("Error resetting FSRS parameters:", error);
    throw new AppError(
      err.message || "重置 FSRS 参数失败",
      500,
      ErrorCodes.SYSTEM_INTERNAL_ERROR,
    );
  }
});

router.post("/fsrs-parameters/optimize", requireAuth, async (req: AuthedRequest, res: Response) => {
  try {
    const result = await fsrsParameterService.optimizeParameters(
      req.supabase,
      req.user.id,
    );
    res.json(result);
  } catch (error) {
    const err = error as Error;
    logger.error("Error optimizing FSRS parameters:", error);
    throw new AppError(
      err.message || "优化 FSRS 参数失败",
      500,
      ErrorCodes.SYSTEM_INTERNAL_ERROR,
    );
  }
});

router.get("/semantic-groups", requireAuth, async (req: AuthedRequest, res: Response) => {
  const { graph_id } = req.query;

  try {
    // Get due cards for the user
    let query = req.supabase
      .from("study_cards")
      .select("knowledge_point_id")
      .eq("user_id", req.user.id);

    if (graph_id) {
      query = query.eq("graph_id", graph_id as string);
    }

    query = query.lte("next_review", new Date().toISOString());

    const { data: cards, error } = await query;

    if (error) {
      throw new AppError("获取语义分组失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }

    const kpIds = [...new Set((cards ?? []).map((c: { knowledge_point_id: string }) => c.knowledge_point_id))];

    if (kpIds.length === 0) {
      res.json({ groups: [], interference_pairs: [] });
      return;
    }

    const [groups, interferencePairs] = await Promise.all([
      semanticInterferenceService.getSemanticGroups(req.supabase, kpIds),
      semanticInterferenceService.detectInterferencePairs(req.supabase, kpIds),
    ]);

    res.json({ groups, interference_pairs: interferencePairs });
  } catch (error) {
    const err = error as Error;
    logger.error("Error fetching semantic groups:", error);
    throw new AppError(
      err.message || "获取语义分组失败",
      500,
      ErrorCodes.SYSTEM_INTERNAL_ERROR,
    );
  }
});

export default router;
