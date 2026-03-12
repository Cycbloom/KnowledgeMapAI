import { Router, type Response } from 'express';
import { requireAuth, type AuthRequest } from '../middleware/auth.js';
import { searchService } from '../services/ai/searchService.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const { q, type } = req.query;
  
  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return res.json({ graphs: [], nodes: [] });
  }

  const query = q.trim();

  try {
    if (type === 'semantic') {
      const result = await searchService.semanticSearch(
        req.supabase!,
        query,
        req.user.id
      );
      res.json(result);
    } else {
      const result = await searchService.search(req.supabase!, query);
      res.json(result);
    }
  } catch (error: any) {
    logger.error('Search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

export default router;
