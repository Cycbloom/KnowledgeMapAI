import { Router, type Response } from "express";
import { requireAuth, type AuthRequest } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import {
  chatSchema,
  tutorChatSchema,
  extractConceptsSchema,
  suggestNextTopicSchema,
} from "../../schemas/index";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { AppError } from "../../middleware/errorHandler";
import { aiService } from "../../services/ai";
import { chatService } from "../../services/ai/chatService";
import { logger } from "../../utils/logger";
import { setSSEHeaders } from "./utils";

const router = Router();

router.post("/chat", requireAuth, validate(chatSchema), async (req: AuthRequest, res: Response) => {
  const { message, graph_id, history, context_node_ids, provider: providerType, model, language, session_id } = req.body;
  const sessionId = session_id || crypto.randomUUID();
  setSSEHeaders(res);
  res.setHeader("X-Session-Id", sessionId);
  await chatService.chatStream(req, res, {
    message, graphId: graph_id, contextNodeIds: context_node_ids, history, provider: providerType, model, language, sessionId,
  });
});

router.post("/tutor-chat", requireAuth, validate(tutorChatSchema), async (req: AuthRequest, res: Response) => {
  const { message, graph_id, history, context_node_ids, mode, provider: providerType, model, session_id } = req.body;
  const sessionId = session_id || crypto.randomUUID();
  setSSEHeaders(res);
  res.setHeader("X-Session-Id", sessionId);
  await chatService.tutorChatStream(req, res, {
    message, graphId: graph_id, contextNodeIds: context_node_ids, history, mode, provider: providerType, model, sessionId,
  });
});

router.post("/extract-concepts", requireAuth, validate(extractConceptsSchema), async (req: AuthRequest, res: Response) => {
  const { text, existing_nodes, max_concepts, provider: providerType, model } = req.body;
  try {
    const result = await aiService.extractConcepts(text, existing_nodes, {
      provider: providerType, model, maxConcepts: max_concepts,
    });
    res.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error("AI Extract Concepts Error:", error);
    throw new AppError(err.message || "AI 概念提取失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

router.post("/suggest-next-topic", requireAuth, validate(suggestNextTopicSchema), async (req: AuthRequest, res: Response) => {
  const { node_title, node_content, existing_nodes, user_progress, provider: providerType, model } = req.body;
  try {
    const result = await aiService.suggestNextTopic(node_title, node_content, existing_nodes, {
      provider: providerType, model, userProgress: user_progress,
    });
    res.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error("AI Suggest Next Topic Error:", error);
    throw new AppError(err.message || "AI 主题建议失败", 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

export default router;
