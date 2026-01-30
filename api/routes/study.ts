import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createCardSchema, createCardsBatchSchema, updateCardProgressSchema } from '../schemas/index.js';
import { cacheService, CacheKeys } from '../services/cache.js';

const router = Router();

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

  if (error) throw error;
  
  // Filter in memory if Supabase join filtering didn't work as expected for inner join
  // But typically it works if foreign key is set up.
  // If graph_id was provided, we filter data to ensure only cards from that graph are returned.
  // (In case eq('nodes.graph_id') acts as left join filter)
  let result = data;
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

  if (error) throw error;

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

  if (error) throw error;

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

  // Simple spaced repetition logic (SM-2 simplified)
  // Fetch current card
  const { data: card } = await req.supabase!
    .from('study_cards')
    .select('*, nodes(graph_id)')
    .eq('id', id)
    .single();

  if (!card) return res.status(404).json({ error: '未找到卡片' });

  // Calculate next review date
  const now = new Date();
  let interval = 1; // days
  if (quality >= 3) {
    interval = (card.review_count === 0) ? 1 : (card.review_count === 1 ? 6 : Math.round(card.review_count * 2.5)); // Very rough approx
  } else {
    interval = 1; // Reset if failed
  }

  const nextReview = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

  const { data, error } = await req.supabase!
    .from('study_cards')
    .update({
      last_reviewed: now.toISOString(),
      next_review: nextReview.toISOString(),
      review_count: card.review_count + 1,
      difficulty: quality // Store last quality as difficulty for now
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

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
    return res.status(500).json({ error: error.message });
  }

  res.json(data || { message: 'No progress recorded yet' });
});

export default router;
