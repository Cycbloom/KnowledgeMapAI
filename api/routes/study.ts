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
  const { graph_id, node_id, node_ids, due } = req.query;
  const dueOnly = due === 'true' || due === '1';

  if (graph_id) {
    // For debugging: First, let's see if we can get ANY cards for this user
    const { count, error: countError } = await req.supabase!
      .from('study_cards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id);
    
    console.log(`Total cards for user ${req.user.id}: ${count || 0}`);
    if (countError) console.error('Count error:', countError);

    // Clear cache to ensure we get fresh data from DB
    await cacheService.del(CacheKeys.STUDY_CARDS(graph_id as string));
  }

  console.log('Fetching cards for graph_id:', graph_id, 'node_id:', node_id, 'node_ids:', node_ids, 'user_id:', req.user.id);

  // Use a simpler approach to debug: select all cards and filter in JS if needed,
  // or use the join but check the nodes content
  let query = req.supabase!
    .from('study_cards')
    .select('*, nodes(id, title, graph_id)')
    .eq('user_id', req.user.id);

  if (node_id) {
    query = query.eq('node_id', node_id);
  } else if (node_ids) {
    // Support comma-separated node_ids
    const ids = (node_ids as string).split(',');
    query = query.in('node_id', ids);
  } else if (graph_id) {
    // Now we can query graph_id directly on study_cards for better performance
    query = query.eq('graph_id', graph_id);
  }

  if (dueOnly) {
    query = query.lte('next_review', new Date().toISOString());
  }
  
  const { data, error } = await query;

  if (error) {
    console.error('Supabase error fetching cards:', error);
    throw new AppError(error.message || '获取学习卡片失败', 500, ErrorCodes.INTERNAL_ERROR);
  }
  
  if (data && data.length > 0) {
    console.log(`Found ${data.length} cards for graph_id: ${graph_id}. First card node_id: ${data[0].node_id}, graph_id from node: ${data[0].nodes?.graph_id}`);
  } else {
    console.log(`No cards found for graph_id: ${graph_id}. Checking if nodes exist for this graph...`);
    const { data: nodesCheck } = await req.supabase!
      .from('nodes')
      .select('id')
      .eq('graph_id', graph_id)
      .limit(5);
    console.log(`Nodes found for graph ${graph_id}:`, nodesCheck?.length || 0);
  }
  
  res.json(data || []);
});

// Create a flashcard manually
router.post('/cards', requireAuth, validate(createCardSchema), async (req: AuthRequest, res: Response) => {
  const { node_id, question, answer } = req.body;

  // Fetch node to get graph_id
  const { data: node } = await req.supabase!
    .from('nodes')
    .select('graph_id')
    .eq('id', node_id)
    .single();

  if (!node) {
    throw new AppError('未找到所属节点', 404, ErrorCodes.NODE_NOT_FOUND);
  }

  const { data, error } = await req.supabase!
    .from('study_cards')
    .insert([
      {
        user_id: req.user.id,
        node_id,
        graph_id: node.graph_id,
        question,
        answer,
        next_review: new Date().toISOString(), // Due immediately
        difficulty: 1,
        // FSRS initial values
        fsrs_state: 0,
        fsrs_stability: 0,
        fsrs_difficulty: 0,
        fsrs_elapsed_days: 0,
        fsrs_scheduled_days: 0,
        fsrs_retrievability: 0
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
  
  // Get all unique node_ids
  const nodeIds = [...new Set(cards.map((c: any) => c.node_id))];
  
  // Fetch graph_id for all nodes
  const { data: nodes } = await req.supabase!
    .from('nodes')
    .select('id, graph_id')
    .in('id', nodeIds);
    
  const nodeGraphMap = new Map(nodes?.map(n => [n.id, n.graph_id]));

  const cardsToInsert = cards.map((card: any) => ({
    user_id: req.user.id,
    node_id: card.node_id,
    graph_id: nodeGraphMap.get(card.node_id),
    question: card.question,
    answer: card.answer,
    card_type: card.type || 'qa',
    options: card.options || null,
    next_review: new Date().toISOString(),
    difficulty: 1,
    // FSRS initial values
    fsrs_state: 0, // New
    fsrs_stability: 0,
    fsrs_difficulty: 0,
    fsrs_elapsed_days: 0,
    fsrs_scheduled_days: 0,
    fsrs_retrievability: 0
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
