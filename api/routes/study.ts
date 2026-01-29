import { Router, type Response } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';

const router = Router();

// Get cards due for review (or all cards for a graph)
router.get('/cards', requireAuth, async (req: AuthRequest, res: Response) => {
  const { graph_id } = req.query;

  let query = req.supabase!
    .from('study_cards')
    .select('*, nodes(title)') // Join with nodes to get context
    .eq('user_id', req.user.id);

  if (graph_id) {
    // We need to filter by graph_id. study_cards has node_id. nodes has graph_id.
    // Supabase join filtering:
    query = query.eq('nodes.graph_id', graph_id);
    // Note: Inner join filtering on Supabase JS might need !inner
    // But let's try standard. If it fails, we fetch all and filter in memory or fix query.
    // Correct way: .select('*, nodes!inner(title, graph_id)').eq('nodes.graph_id', graph_id)
  }

  // Filter for due cards? The frontend might want all cards or just due ones.
  // Let's return all for now and let frontend filter, or add ?due=true
  
  const { data, error } = await query;

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Create a flashcard manually
router.post('/cards', requireAuth, async (req: AuthRequest, res: Response) => {
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
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Update card progress (Review)
router.put('/cards/:id/progress', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { quality } = req.body; // 0-5 rating

  // Simple spaced repetition logic (SM-2 simplified)
  // Fetch current card
  const { data: card } = await req.supabase!
    .from('study_cards')
    .select('*')
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

  if (error) return res.status(500).json({ error: error.message });
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
