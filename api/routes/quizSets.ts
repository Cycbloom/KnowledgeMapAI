import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  createQuizSetSchema,
  updateQuizSetSchema,
  generateQuizSchema,
  regenerateCardSchema,
  uuidParamsSchema,
} from "../schemas/index.js";
import { ErrorCodes } from "../../shared/types/errorCodes.js";
import { AppError } from "../middleware/errorHandler.js";
import { taskService } from "../services/taskService.js";
import { studyService } from "../services/study/studyService.js";
import { aiService } from "../services/ai/aiService.js";
import { logger } from "../utils/logger.js";

const router = Router();

router.get(
  "/quiz-sets",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    const { graph_id } = req.query;

    try {
      let query = req
        .supabase!.from("quiz_sets")
        .select("*")
        .eq("user_id", req.user.id)
        .order("created_at", { ascending: false });

      if (graph_id) {
        query = query.eq("graph_id", graph_id);
      }

      const { data, error } = await query;

      if (error) {
        logger.error("Error fetching quiz sets:", error);
        throw new AppError("获取测验集合失败", 500, ErrorCodes.INTERNAL_ERROR);
      }

      res.json(data || []);
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error fetching quiz sets:", error);
      throw new AppError(
        err.message || "获取测验集合失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.get(
  "/quiz-sets/:id",
  requireAuth,
  validate(uuidParamsSchema),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
      const { data: quizSet, error: quizSetError } = await req
        .supabase!.from("quiz_sets")
        .select("*")
        .eq("id", id)
        .eq("user_id", req.user.id)
        .single();

      if (quizSetError || !quizSet) {
        throw new AppError(
          "未找到测验集合",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      const { data: quizSetCards, error: cardsError } = await req
        .supabase!.from("quiz_set_cards")
        .select(
          `
          display_order,
          card:study_cards (
            id,
            question,
            answer,
            explanation,
            card_type,
            options,
            difficulty,
            knowledge_point_id,
            last_reviewed,
            next_review,
            review_count
          )
        `,
        )
        .eq("quiz_set_id", id)
        .order("display_order", { ascending: true });

      if (cardsError) {
        logger.error("Error fetching quiz set cards:", cardsError);
        throw new AppError("获取测验卡片失败", 500, ErrorCodes.INTERNAL_ERROR);
      }

      const cards = (quizSetCards || []).map((qsc: any) => ({
        ...qsc.card,
        display_order: qsc.display_order,
      }));

      res.json({
        ...quizSet,
        cards,
      });
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error fetching quiz set:", error);
      throw new AppError(
        err.message || "获取测验集合失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/quiz-sets",
  requireAuth,
  validate(createQuizSetSchema),
  async (req: AuthRequest, res: Response) => {
    const { title, description, config, graph_id } = req.body;

    try {
      const { data, error } = await req
        .supabase!.from("quiz_sets")
        .insert({
          user_id: req.user.id,
          title,
          description,
          config: config || {},
          graph_id,
          status: "draft",
          card_count: 0,
        })
        .select()
        .single();

      if (error) {
        logger.error("Error creating quiz set:", error);
        throw new AppError("创建测验集合失败", 500, ErrorCodes.INTERNAL_ERROR);
      }

      res.status(201).json(data);
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error creating quiz set:", error);
      throw new AppError(
        err.message || "创建测验集合失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.put(
  "/quiz-sets/:id",
  requireAuth,
  validate(updateQuizSetSchema),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { title, description, config } = req.body;

    try {
      const { data: existing, error: fetchError } = await req
        .supabase!.from("quiz_sets")
        .select("id")
        .eq("id", id)
        .eq("user_id", req.user.id)
        .single();

      if (fetchError || !existing) {
        throw new AppError(
          "未找到测验集合",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (config !== undefined) updateData.config = config;

      const { data, error } = await req
        .supabase!.from("quiz_sets")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        logger.error("Error updating quiz set:", error);
        throw new AppError("更新测验集合失败", 500, ErrorCodes.INTERNAL_ERROR);
      }

      res.json(data);
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error updating quiz set:", error);
      throw new AppError(
        err.message || "更新测验集合失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.delete(
  "/quiz-sets/:id",
  requireAuth,
  validate(uuidParamsSchema),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;

    try {
      const { data: existing, error: fetchError } = await req
        .supabase!.from("quiz_sets")
        .select("id")
        .eq("id", id)
        .eq("user_id", req.user.id)
        .single();

      if (fetchError || !existing) {
        throw new AppError(
          "未找到测验集合",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      const { error: deleteCardsError } = await req
        .supabase!.from("quiz_set_cards")
        .delete()
        .eq("quiz_set_id", id);

      if (deleteCardsError) {
        logger.error("Error deleting quiz set cards:", deleteCardsError);
        throw new AppError(
          "删除测验卡片关联失败",
          500,
          ErrorCodes.INTERNAL_ERROR,
        );
      }

      const { error } = await req
        .supabase!.from("quiz_sets")
        .delete()
        .eq("id", id);

      if (error) {
        logger.error("Error deleting quiz set:", error);
        throw new AppError("删除测验集合失败", 500, ErrorCodes.INTERNAL_ERROR);
      }

      res.json({ success: true, message: "测验集合已删除" });
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error deleting quiz set:", error);
      throw new AppError(
        err.message || "删除测验集合失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/quiz-sets/generate",
  requireAuth,
  validate(generateQuizSchema),
  async (req: AuthRequest, res: Response) => {
    const { quiz_set_id, node_ids, config } = req.body;

    try {
      const { data: quizSet, error: quizSetError } = await req
        .supabase!.from("quiz_sets")
        .select("*")
        .eq("id", quiz_set_id)
        .eq("user_id", req.user.id)
        .single();

      if (quizSetError || !quizSet) {
        throw new AppError(
          "未找到测验集合",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      await req
        .supabase!.from("quiz_sets")
        .update({ status: "generating", updated_at: new Date().toISOString() })
        .eq("id", quiz_set_id);

      const task = await taskService.createTask(req.user.id, "generate_quiz", {
        quiz_set_id,
        node_ids,
        config,
      });

      res.json({
        success: true,
        task_id: task.id,
        message: "测验生成任务已创建",
      });
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error generating quiz:", error);

      try {
        await req
          .supabase!.from("quiz_sets")
          .update({ status: "draft", updated_at: new Date().toISOString() })
          .eq("id", quiz_set_id);
      } catch (resetError) {
        logger.error("Failed to reset quiz set status:", resetError);
      }

      throw new AppError(
        err.message || "生成测验失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/quiz-sets/:id/regenerate/:cardId",
  requireAuth,
  validate(regenerateCardSchema),
  async (req: AuthRequest, res: Response) => {
    const { id, cardId } = req.params;

    try {
      const { data: quizSet, error: quizSetError } = await req
        .supabase!.from("quiz_sets")
        .select("*")
        .eq("id", id)
        .eq("user_id", req.user.id)
        .single();

      if (quizSetError || !quizSet) {
        throw new AppError(
          "未找到测验集合",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      const { data: cardLink, error: cardLinkError } = await req
        .supabase!.from("quiz_set_cards")
        .select("*, card:study_cards(*)")
        .eq("quiz_set_id", id)
        .eq("card_id", cardId)
        .single();

      if (cardLinkError || !cardLink) {
        throw new AppError(
          "未找到测验卡片",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      const oldCard = cardLink.card as any;
      const displayOrder = cardLink.display_order;

      if (!oldCard?.knowledge_point_id) {
        throw new AppError(
          "卡片缺少知识点关联",
          400,
          ErrorCodes.VALIDATION_ERROR,
        );
      }

      const { data: graphNode } = await req
        .supabase!.from("graph_nodes")
        .select("title, content")
        .eq("knowledge_point_id", oldCard.knowledge_point_id)
        .is("deleted_at", null)
        .single();

      if (!graphNode) {
        throw new AppError(
          "未找到关联的知识点",
          404,
          ErrorCodes.NODE_NOT_FOUND,
        );
      }

      const config = quizSet.config || {};
      const types = config.types || [oldCard.card_type || "qa"];
      const difficulty = config.difficulty || "medium";
      const count = 1;

      const aiResult = await aiService.generateCards(
        graphNode.title || "",
        graphNode.content || "",
        {
          count,
          types,
          difficulty,
          provider: config.provider,
          model: config.model,
          userId: req.user.id,
          graphId: quizSet.graph_id,
        },
      );

      const newCards = aiResult.cards || [];
      if (newCards.length === 0) {
        throw new AppError("AI 未能生成新卡片", 500, ErrorCodes.INTERNAL_ERROR);
      }

      const newCardData = newCards[0] as {
        question: string;
        answer: string;
        explanation?: string;
        type?: string;
        card_type?: string;
        options?: string[];
      };
      const newCard = await studyService.createCard(req.supabase!, {
        userId: req.user.id,
        knowledgePointId: oldCard.knowledge_point_id,
        sourceGraphId: quizSet.graph_id,
        question: newCardData.question,
        answer: newCardData.answer,
        explanation: newCardData.explanation,
        cardType:
          newCardData.type || newCardData.card_type || oldCard.card_type,
        options: newCardData.options,
      });

      await req.supabase!.from("quiz_set_cards").delete().eq("card_id", cardId);

      await studyService.deleteCard(req.supabase!, cardId);

      await req.supabase!.from("quiz_set_cards").insert({
        quiz_set_id: id,
        card_id: newCard.id,
        display_order: displayOrder,
      });

      res.json({
        success: true,
        card: newCard,
        message: "卡片已重新生成",
      });
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error regenerating card:", error);
      throw new AppError(
        err.message || "重新生成卡片失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.post(
  "/quiz-sets/:id/cards",
  requireAuth,
  validate(uuidParamsSchema),
  async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { card_id } = req.body;

    try {
      const { data: quizSet, error: quizSetError } = await req
        .supabase!.from("quiz_sets")
        .select("*")
        .eq("id", id)
        .eq("user_id", req.user.id)
        .single();

      if (quizSetError || !quizSet) {
        throw new AppError(
          "未找到测验集合",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      const { data: existingLink } = await req
        .supabase!.from("quiz_set_cards")
        .select("id")
        .eq("quiz_set_id", id)
        .eq("card_id", card_id)
        .single();

      if (existingLink) {
        throw new AppError(
          "该卡片已在测验集合中",
          400,
          ErrorCodes.VALIDATION_ERROR,
        );
      }

      const { data: maxOrder } = await req
        .supabase!.from("quiz_set_cards")
        .select("display_order")
        .eq("quiz_set_id", id)
        .order("display_order", { ascending: false })
        .limit(1)
        .single();

      const displayOrder = (maxOrder?.display_order || 0) + 1;

      const { error: insertError } = await req
        .supabase!.from("quiz_set_cards")
        .insert({
          quiz_set_id: id,
          card_id,
          display_order: displayOrder,
        });

      if (insertError) {
        logger.error("Error adding card to quiz set:", insertError);
        throw new AppError(
          "添加卡片到测验集合失败",
          500,
          ErrorCodes.INTERNAL_ERROR,
        );
      }

      await req
        .supabase!.from("quiz_sets")
        .update({
          card_count: (quizSet.card_count || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      res.json({
        success: true,
        message: "卡片已添加到测验集合",
      });
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error adding card to quiz set:", error);
      throw new AppError(
        err.message || "添加卡片到测验集合失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

router.delete(
  "/quiz-sets/:id/cards/:cardId",
  requireAuth,
  validate(uuidParamsSchema),
  async (req: AuthRequest, res: Response) => {
    const { id, cardId } = req.params;

    try {
      const { data: quizSet, error: quizSetError } = await req
        .supabase!.from("quiz_sets")
        .select("*")
        .eq("id", id)
        .eq("user_id", req.user.id)
        .single();

      if (quizSetError || !quizSet) {
        throw new AppError(
          "未找到测验集合",
          404,
          ErrorCodes.RESOURCE_NOT_FOUND,
        );
      }

      const { error: deleteError } = await req
        .supabase!.from("quiz_set_cards")
        .delete()
        .eq("quiz_set_id", id)
        .eq("card_id", cardId);

      if (deleteError) {
        logger.error("Error removing card from quiz set:", deleteError);
        throw new AppError(
          "从测验集合移除卡片失败",
          500,
          ErrorCodes.INTERNAL_ERROR,
        );
      }

      await req
        .supabase!.from("quiz_sets")
        .update({
          card_count: Math.max(0, (quizSet.card_count || 1) - 1),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      res.json({
        success: true,
        message: "卡片已从测验集合移除",
      });
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("Error removing card from quiz set:", error);
      throw new AppError(
        err.message || "从测验集合移除卡片失败",
        500,
        ErrorCodes.INTERNAL_ERROR,
      );
    }
  },
);

export default router;
