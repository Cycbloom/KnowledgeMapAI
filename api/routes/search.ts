import { Router, type Response } from 'express';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { searchService } from '../services/ai';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { ErrorCodes } from '../../shared/types/errorCodes';

const router = Router();

router.get('/', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { q, type } = req.query;
  
  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return res.json({ graphs: [], nodes: [], notes: [] });
  }

  const query = q.trim();

  try {
    if (type === 'semantic') {
      const result = await searchService.semanticSearch(
        req.supabase,
        query,
        req.user.id
      );
      res.json(result);
    } else if (type === 'notes') {
      // P1 Task 5.3: 单独搜索笔记（?type=notes）
      const notes = await searchService.searchNotes(req.supabase, query);
      res.json({ notes });
    } else {
      const result = await searchService.search(req.supabase, query);
      res.json(result);
    }
  } catch (error) {
    logger.error('Search error:', error);
    throw new AppError('Search failed', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

export default router;
