import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createCardSchema, createCardsBatchSchema, updateCardProgressSchema } from '../schemas/index.js';
import { cacheService, CacheKeys } from '../services/common/cacheService.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { AppError } from '../middleware/errorHandler.js';
import { studyService } from '../services/study/studyService.js';
import { achievementService } from '../services/achievementService.js';
import { logger } from '../utils/logger.js';
const router = Router();
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
router.get('/cards', requireAuth, async (req, res) => {
    const { graph_id, knowledge_point_id, knowledge_point_ids, due, refresh } = req.query;
    const dueOnly = due === 'true' || due === '1';
    if (graph_id && refresh === 'true') {
        await cacheService.del(CacheKeys.STUDY_CARDS(graph_id));
    }
    let knowledgePointIdList;
    if (knowledge_point_ids) {
        knowledgePointIdList = knowledge_point_ids.split(',');
    }
    try {
        const cards = await studyService.getCards(req.supabase, {
            userId: req.user.id,
            graphId: graph_id,
            knowledgePointId: knowledge_point_id,
            knowledgePointIds: knowledgePointIdList,
            dueOnly
        });
        res.json(cards);
    }
    catch (error) {
        logger.error('Error fetching cards:', error);
        throw new AppError(error.message || '获取学习卡片失败', 500, ErrorCodes.INTERNAL_ERROR);
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
router.post('/cards', requireAuth, validate(createCardSchema), async (req, res) => {
    const { knowledge_point_id, question, answer, explanation, card_type, options } = req.body;
    const { data: graphNode } = await req.supabase
        .from('graph_nodes')
        .select('graph_id')
        .eq('knowledge_point_id', knowledge_point_id)
        .is('deleted_at', null)
        .single();
    if (!graphNode) {
        throw new AppError('未找到所属节点', 404, ErrorCodes.NODE_NOT_FOUND);
    }
    try {
        const card = await studyService.createCard(req.supabase, {
            userId: req.user.id,
            knowledgePointId: knowledge_point_id,
            sourceGraphId: graphNode.graph_id,
            question,
            answer,
            explanation,
            cardType: card_type,
            options
        });
        res.status(201).json(card);
    }
    catch (error) {
        console.error('Error creating card:', error);
        throw new AppError(error.message || '创建学习卡片失败', 500, ErrorCodes.INTERNAL_ERROR);
    }
});
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
router.post('/cards/batch', requireAuth, validate(createCardsBatchSchema), async (req, res) => {
    const { cards } = req.body;
    const knowledgePointIds = [...new Set(cards.map((c) => c.knowledge_point_id))];
    const { data: graphNodes } = await req.supabase
        .from('graph_nodes')
        .select('knowledge_point_id, graph_id')
        .in('knowledge_point_id', knowledgePointIds)
        .is('deleted_at', null);
    const nodeGraphMap = new Map(graphNodes?.map(gn => [gn.knowledge_point_id, gn.graph_id]));
    const cardsData = cards.map((card) => ({
        knowledgePointId: card.knowledge_point_id,
        sourceGraphId: nodeGraphMap.get(card.knowledge_point_id),
        question: card.question,
        answer: card.answer,
        explanation: card.explanation,
        cardType: card.card_type || card.type,
        options: card.options
    }));
    try {
        const createdCards = await studyService.createCardsBatch(req.supabase, cardsData, req.user.id);
        res.status(201).json(createdCards);
    }
    catch (error) {
        logger.error('Error creating cards batch:', error);
        throw new AppError(error.message || '创建学习卡片失败', 500, ErrorCodes.INTERNAL_ERROR);
    }
});
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
router.put('/cards/:id/progress', requireAuth, validate(updateCardProgressSchema), async (req, res) => {
    const { id } = req.params;
    const { quality } = req.body;
    try {
        const result = await studyService.updateProgress(req.supabase, id, quality, req.user.id);
        Promise.all([
            achievementService.addXp(req.user.id, 10),
            achievementService.updateMasteredStats(req.user.id)
        ]).catch(err => console.error('Achievement update failed:', err));
        res.json(result.card);
    }
    catch (error) {
        logger.error('Error updating card progress:', error);
        if (error.message === 'Card not found') {
            throw new AppError('未找到卡片', 404, ErrorCodes.CARD_NOT_FOUND);
        }
        throw new AppError(error.message || '更新卡片进度失败', 500, ErrorCodes.INTERNAL_ERROR);
    }
});
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
router.get('/progress', requireAuth, async (req, res) => {
    const { graph_id } = req.query;
    const { data, error } = await req.supabase
        .from('study_progress')
        .select('*')
        .eq('user_id', req.user.id)
        .eq('graph_id', graph_id)
        .single();
    if (error && error.code !== 'PGRST116') {
        throw new AppError(error.message || '获取学习进度失败', 500, ErrorCodes.INTERNAL_ERROR);
    }
    res.json(data || { message: 'No progress recorded yet' });
});
export default router;
//# sourceMappingURL=study.js.map