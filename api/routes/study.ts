import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createCardSchema, createCardsBatchSchema, updateCardProgressSchema } from '../schemas/index.js';
import { cacheService, CacheKeys } from '../services/cache.js';
import { ErrorCodes } from '../constants/errorCodes.js';
import { AppError } from '../middleware/errorHandler.js';
import { fsrs, Card, Rating, State, createEmptyCard } from 'ts-fsrs';

const router = Router();
const f = fsrs();

// Helper: Convert DB card to FSRS Card
const dbCardToFSRS = (dbCard: any): Card => {
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
    last_review: dbCard.fsrs_last_review ? new Date(dbCard.fsrs_last_review) : undefined
  };
};

// Helper: Map 0-5 quality to FSRS Rating
const mapQualityToRating = (quality: number): Rating => {
  if (quality <= 1) return Rating.Again;
  if (quality === 2) return Rating.Hard;
  if (quality === 3) return Rating.Good;
  return Rating.Easy;
};

// Get cards due for review (or all cards for a graph)
router.get('/cards', requireAuth, async (req: AuthRequest, res: Response) => {
  const { graph_id } = req.query;

  if (graph_id) {
    const cached = cacheService.get(CacheKeys.STUDY_CARDS(graph_id as string));
    if (cached) {
      return res.json(cached);
    }
  }

  let query = req.supabase!
    .from('study_cards')
    .select('*, nodes(title, graph_id)') // Join with nodes to get context
    .eq('user_id', req.user.id);

  if (graph_id) {
    // We need to filter by graph_id. study_cards has node_id. nodes has graph_id.
    // Supabase join filtering:
    query = query.eq('nodes.graph_id', graph_id);
  }

  // Filter for due cards? The frontend might want all cards or just due ones.
  // Let's return all for now and let frontend filter, or add ?due=true
  
  const { data, error } = await query;

  if (error) throw new AppError(error.message || '获取学习卡片失败', 500, ErrorCodes.INTERNAL_ERROR);
  
  // Filter in memory if Supabase join filtering didn't work as expected for inner join
  // But typically it works if foreign key is set up.
  // If graph_id was provided, we filter data to ensure only cards from that graph are returned.
  // (In case eq('nodes.graph_id') acts as left join filter)
  let result = data || [];
  if (graph_id && data) {
    result = data.filter((card: any) => card.nodes?.graph_id === graph_id);
    cacheService.set(CacheKeys.STUDY_CARDS(graph_id as string), result);
  }

  res.json(result);
});

// Create a flashcard manually
router.post('/cards', requireAuth, validate(createCardSchema), async (req: AuthRequest, res: Response) => {
  const { node_id, question, answer } = req.body;

  const { data, error } = await req.supabase!
    .from('study_cards')
    .insert([
      {
        user_id: req.user.id,
        node_id,
        question,
        answer,
        next_review: new Date().toISOString(), // Due immediately
        difficulty: 1
      }
    ])
    .select('*, nodes(graph_id)')
    .single();

  if (error) throw new AppError(error.message || '创建学习卡片失败', 500, ErrorCodes.INTERNAL_ERROR);

  if (data?.nodes?.graph_id) {
    await cacheService.del(CacheKeys.STUDY_CARDS(data.nodes.graph_id));
  }

  res.status(201).json(data);
});

// Create multiple flashcards (Batch)
router.post('/cards/batch', requireAuth, validate(createCardsBatchSchema), async (req: AuthRequest, res: Response) => {
  const { cards } = req.body; // Expects array of { node_id, question, answer }
  // Manual validation removed

  const cardsToInsert = cards.map((card: any) => ({
    user_id: req.user.id,
    node_id: card.node_id,
    question: card.question,
    answer: card.answer,
    card_type: card.type || 'qa',
    options: card.options || null,
    next_review: new Date().toISOString(),
    difficulty: 1
  }));

  const { data, error } = await req.supabase!
    .from('study_cards')
    .insert(cardsToInsert)
    .select('*, nodes(graph_id)');

  if (error) throw new AppError(error.message || '创建学习卡片失败', 500, ErrorCodes.INTERNAL_ERROR);

  if (data) {
    const graphIds = new Set(data.map((card: any) => card.nodes?.graph_id).filter(Boolean));
    graphIds.forEach(gid => cacheService.del(CacheKeys.STUDY_CARDS(gid as string)));
  }

  res.status(201).json(data);
});

// Update card progress (Review)
router.put('/cards/:id/progress', requireAuth, validate(updateCardProgressSchema), async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { quality } = req.body; // 0-5 rating

  // Fetch current card
  const { data: card } = await req.supabase!
    .from('study_cards')
    .select('*, nodes(graph_id)')
    .eq('id', id)
    .single();

  if (!card) {
    throw new AppError('未找到卡片', 404, ErrorCodes.CARD_NOT_FOUND);
  }

  // FSRS Logic
  const fsrsCard = dbCardToFSRS(card);
  const now = new Date();
  const rating = mapQualityToRating(quality);
  
  const scheduling_cards = f.repeat(fsrsCard, now);
  const scheduledCard = scheduling_cards[rating].card;

  const { data, error } = await req.supabase!
    .from('study_cards')
    .update({
      last_reviewed: now.toISOString(),
      next_review: scheduledCard.due.toISOString(),
      review_count: scheduledCard.reps,
      // FSRS specific fields
      fsrs_state: scheduledCard.state,
      fsrs_stability: scheduledCard.stability,
      fsrs_difficulty: scheduledCard.difficulty,
      fsrs_elapsed_days: scheduledCard.elapsed_days,
      fsrs_scheduled_days: scheduledCard.scheduled_days,
      fsrs_last_review: now.toISOString(),
      // Use stability/retrievability for analytics? 
      // Retrievability is not directly in 'card' output of ts-fsrs v3 (it's calculated), 
      // but we can calculate R if needed: R = (1 + elapsed / (9 * stability)) ^ -1
      // For now, let's just store the core params.
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError(error.message || '更新卡片进度失败', 500, ErrorCodes.INTERNAL_ERROR);

  if (card?.nodes?.graph_id) {
    await cacheService.del(CacheKeys.STUDY_CARDS(card.nodes.graph_id));
  }

  res.json(data);
});

// Get study progress
router.get('/progress', requireAuth, async (req: AuthRequest, res: Response) => {
  const { graph_id } = req.query;

  const { data, error } = await req.supabase!
    .from('study_progress')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('graph_id', graph_id) // Optional filter
    .single(); // Might return null if no progress record yet

  if (error && error.code !== 'PGRST116') { // PGRST116 is no rows returned
    throw new AppError(error.message || '获取学习进度失败', 500, ErrorCodes.INTERNAL_ERROR);
  }

  res.json(data || { message: 'No progress recorded yet' });
});

export default router;
