import { Router, type Response } from 'express';
import { requireAuth, type AuthedRequest } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { importDataSchema } from '../schemas/index';
import { AppError } from '../middleware/errorHandler';
import { ErrorCodes } from '../../shared/types/errorCodes';
import { dataService } from '../services/graph';

const router = Router();

// Export graph data
router.all('/export/:format', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { format } = req.params;
  const { graph_id } = req.query;
  const { options } = req.body;

  if (!graph_id) throw new AppError('必须提供 graph_id', 400, ErrorCodes.VALIDATION_ERROR);

  const result = await dataService.exportGraph(req.supabase, graph_id as string, format);

  if (result.format === 'json') {
    res.header('Content-Type', result.contentType);
    res.attachment(result.filename);
    return res.send(result.data);
  } else if (result.format === 'markdown') {
    res.header('Content-Type', result.contentType);
    res.attachment(result.filename);
    return res.send(result.data);
  } else if (result.format === 'pdf') {
    res.header('Content-Type', result.contentType);
    res.attachment(result.filename);

    try {
      const { graph, nodes, edges } = await dataService.fetchGraphForExport(req.supabase, graph_id as string);
      dataService.generatePdfReport(graph, nodes, edges, options || {}, res);
    } catch (_e) {
      if (!res.headersSent) {
        throw new AppError('PDF generation failed', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
      }
    }
    return;
  }

  throw new AppError('不支持的导出格式', 400, ErrorCodes.VALIDATION_ERROR);
});

// Import Markdown
router.post('/import/markdown', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { content } = req.body;

  if (!content || typeof content !== 'string') {
    throw new AppError('Content is required and must be a string', 400, ErrorCodes.VALIDATION_ERROR);
  }

  try {
    const graph = await dataService.importMarkdown(req.supabase, req.user.id, content);
    res.status(201).json({ graph });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError((error as Error).message || 'Import failed', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }
});

// Import data
router.post('/import', requireAuth, validate(importDataSchema), async (req: AuthedRequest, res: Response) => {
  const { graph_title, nodes, edges } = req.body;

  const graph = await dataService.importData(req.supabase, req.user.id, { graph_title, nodes, edges });
  res.status(201).json({ graph });
});

// Reset user data (debug only)
router.post('/reset', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { confirm = false, dry_run = false, types = ['all'] } = req.body;

  if (!confirm && !dry_run) {
    throw new AppError('需要设置 confirm=true 或 dry_run=true', 400, ErrorCodes.VALIDATION_ERROR);
  }

  const result = await dataService.resetUserData(req.supabase, req.user.id, { confirm, dry_run, types });
  return res.json(result);
});

export default router;
