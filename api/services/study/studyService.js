import { fsrs, Rating, State, createEmptyCard } from "ts-fsrs";
import { cacheService, CacheKeys } from "../common/cacheService.js";
import { logger } from "../../utils/logger.js";
import { AppError } from "../../middleware/errorHandler.js";
import { ErrorCodes } from "../../constants/errorCodes.js";
const dbCardToFSRS = (dbCard) => {
    const empty = createEmptyCard();
    return {
        ...empty,
        due: new Date(dbCard.next_review || new Date()),
        stability: dbCard.fsrs_stability || 0,
        difficulty: dbCard.fsrs_difficulty || 0,
        elapsed_days: dbCard.fsrs_elapsed_days || 0,
        scheduled_days: dbCard.fsrs_scheduled_days || 0,
        reps: dbCard.review_count || 0,
        state: dbCard.fsrs_state || State.New,
        last_review: dbCard.fsrs_last_review
            ? new Date(dbCard.fsrs_last_review)
            : undefined,
    };
};
const mapQualityToRating = (quality) => {
    if (quality <= 1)
        return Rating.Again;
    if (quality === 2)
        return Rating.Hard;
    if (quality === 3)
        return Rating.Good;
    return Rating.Easy;
};
const getFSRS = async (userId, supabase) => {
    try {
        const { data } = await supabase
            .from("users")
            .select("settings")
            .eq("id", userId)
            .single();
        const params = {};
        if (data?.settings?.request_retention) {
            params.request_retention = Number(data.settings.request_retention);
        }
        if (data?.settings?.maximum_interval) {
            params.maximum_interval = Number(data.settings.maximum_interval);
        }
        return fsrs(params);
    }
    catch (e) {
        logger.warn("Failed to fetch user settings for FSRS, using defaults", e);
        return fsrs();
    }
};
export class StudyService {
    async getCards(supabase, options) {
        const { userId, graphId, knowledgePointId, knowledgePointIds, dueOnly } = options;
        if (graphId && !knowledgePointId && !knowledgePointIds) {
            const cacheKey = CacheKeys.STUDY_CARDS(graphId);
            const cards = await cacheService.getOrSet(cacheKey, async () => {
                const { data, error } = await supabase
                    .from("study_cards")
                    .select("*")
                    .eq("user_id", userId)
                    .eq("graph_id", graphId);
                if (error) {
                    logger.error("Supabase error fetching cards:", error);
                    throw error;
                }
                return data || [];
            });
            if (dueOnly && Array.isArray(cards)) {
                const now = new Date();
                return cards.filter((c) => new Date(c.next_review) <= now);
            }
            return cards;
        }
        let query = supabase.from("study_cards").select("*").eq("user_id", userId);
        if (knowledgePointId) {
            query = query.eq("knowledge_point_id", knowledgePointId);
        }
        else if (knowledgePointIds && knowledgePointIds.length > 0) {
            query = query.in("knowledge_point_id", knowledgePointIds);
        }
        else if (graphId) {
            query = query.eq("graph_id", graphId);
        }
        if (dueOnly) {
            query = query.lte("next_review", new Date().toISOString());
        }
        const { data, error } = await query;
        if (error) {
            logger.error("Supabase error fetching cards:", error);
            throw error;
        }
        return data || [];
    }
    async createCard(supabase, data) {
        const { userId, knowledgePointId, sourceGraphId, question, answer, explanation, cardType, options, } = data;
        const { data: card, error } = await supabase
            .from("study_cards")
            .insert([
            {
                user_id: userId,
                knowledge_point_id: knowledgePointId,
                graph_id: sourceGraphId,
                source_graph_id: sourceGraphId,
                question,
                answer,
                explanation: explanation || null,
                card_type: cardType || "qa",
                options: options || null,
                next_review: new Date().toISOString(),
                difficulty: 1,
                fsrs_state: 0,
                fsrs_stability: 0,
                fsrs_difficulty: 0,
                fsrs_elapsed_days: 0,
                fsrs_scheduled_days: 0,
                fsrs_retrievability: 0,
            },
        ])
            .select()
            .single();
        if (error) {
            logger.error("Error creating card:", error);
            throw error;
        }
        await cacheService.del(CacheKeys.STUDY_CARDS(sourceGraphId));
        return card;
    }
    async createCardsBatch(supabase, cards, userId) {
        if (cards.length === 0)
            return [];
        const cardsToInsert = cards.map((card) => ({
            user_id: userId,
            knowledge_point_id: card.knowledgePointId,
            graph_id: card.sourceGraphId,
            source_graph_id: card.sourceGraphId,
            question: card.question,
            answer: card.answer,
            explanation: card.explanation || null,
            card_type: card.cardType || "qa",
            options: card.options || null,
            next_review: new Date().toISOString(),
            difficulty: 1,
            fsrs_state: 0,
            fsrs_stability: 0,
            fsrs_difficulty: 0,
            fsrs_elapsed_days: 0,
            fsrs_scheduled_days: 0,
            fsrs_retrievability: 0,
        }));
        const { data, error } = await supabase
            .from("study_cards")
            .insert(cardsToInsert)
            .select();
        if (error) {
            logger.error("Error creating cards batch:", error);
            throw error;
        }
        const graphIds = new Set(cards.map((c) => c.sourceGraphId));
        graphIds.forEach((gid) => cacheService.del(CacheKeys.STUDY_CARDS(gid)));
        return data || [];
    }
    async updateProgress(supabase, cardId, quality, userId) {
        const { data: card, error: fetchError } = await supabase
            .from("study_cards")
            .select("*")
            .eq("id", cardId)
            .single();
        if (fetchError || !card) {
            logger.error("Error fetching card:", fetchError);
            throw new AppError("卡片不存在", 404, ErrorCodes.RESOURCE_CARD_NOT_FOUND);
        }
        const fsrsCard = dbCardToFSRS(card);
        const now = new Date();
        const rating = mapQualityToRating(quality);
        const f = await getFSRS(userId, supabase);
        let scheduling_cards;
        try {
            scheduling_cards = f.repeat(fsrsCard, now);
        }
        catch (fsrsError) {
            logger.error("FSRS algorithm error:", fsrsError);
            throw new AppError("学习算法计算错误", 500, ErrorCodes.LEARNING_FSRS_ERROR);
        }
        const scheduledCard = scheduling_cards[rating].card;
        const { data: updatedCard, error: updateError } = await supabase
            .from("study_cards")
            .update({
            last_reviewed: now.toISOString(),
            next_review: scheduledCard.due.toISOString(),
            review_count: scheduledCard.reps,
            fsrs_state: scheduledCard.state,
            fsrs_stability: scheduledCard.stability,
            fsrs_difficulty: scheduledCard.difficulty,
            fsrs_elapsed_days: scheduledCard.elapsed_days,
            fsrs_scheduled_days: scheduledCard.scheduled_days,
            fsrs_last_review: now.toISOString(),
        })
            .eq("id", cardId)
            .select()
            .single();
        if (updateError) {
            logger.error("Error updating card progress:", updateError);
            throw updateError;
        }
        if (card.graph_id) {
            await cacheService.del(CacheKeys.STUDY_CARDS(card.graph_id));
        }
        return {
            card: updatedCard,
            scheduledCard,
        };
    }
    async deleteCard(supabase, cardId) {
        const { data: card, error: fetchError } = await supabase
            .from("study_cards")
            .select("graph_id")
            .eq("id", cardId)
            .single();
        if (fetchError) {
            logger.error("Error fetching card for deletion:", fetchError);
            throw fetchError;
        }
        const { error } = await supabase
            .from("study_cards")
            .delete()
            .eq("id", cardId);
        if (error) {
            logger.error("Error deleting card:", error);
            throw error;
        }
        if (card?.graph_id) {
            await cacheService.del(CacheKeys.STUDY_CARDS(card.graph_id));
        }
    }
    async deleteCardsBatch(supabase, cardIds) {
        if (cardIds.length === 0)
            return;
        const { data: cards, error: fetchError } = await supabase
            .from("study_cards")
            .select("id, graph_id")
            .in("id", cardIds);
        if (fetchError) {
            logger.error("Error fetching cards for batch deletion:", fetchError);
            throw fetchError;
        }
        const { error } = await supabase
            .from("study_cards")
            .delete()
            .in("id", cardIds);
        if (error) {
            logger.error("Error deleting cards batch:", error);
            throw error;
        }
        if (cards) {
            const graphIds = new Set(cards.map((c) => c.graph_id).filter(Boolean));
            graphIds.forEach((gid) => cacheService.del(CacheKeys.STUDY_CARDS(gid)));
        }
    }
}
export const studyService = new StudyService();
//# sourceMappingURL=studyService.js.map