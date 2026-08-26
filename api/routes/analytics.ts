import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';
import { validate } from '../middleware/validate';
import { ErrorCodes } from '../../shared/types/errorCodes';
import { getSupabaseAdmin } from '../supabase';

const router = Router();

// 错误上报约束：单次批量上限与单字段长度上限，防止脏数据与滥用
const MAX_ERROR_BATCH_SIZE = 50;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_STACK_LENGTH = 4000;
const MAX_URL_LENGTH = 500;
const MAX_UA_LENGTH = 500;
const DEFAULT_RECENT_LIMIT = 20;
const MAX_RECENT_LIMIT = 100;

// POST /performance 请求体校验：metrics 值必须为数值，url/userAgent/timestamp 为字符串
const performanceReportSchema = z.object({
  metrics: z.record(z.number()),
  url: z.string(),
  userAgent: z.string(),
  timestamp: z.string(),
});

// POST /errors 单条形状校验：timestamp 需可解析为日期（防 new Date().toISOString() 抛 RangeError）
const errorReportSchema = z.object({
  message: z.string(),
  stack: z.string().optional(),
  componentStack: z.string().optional(),
  url: z.string(),
  lineNumber: z.number().optional(),
  columnNumber: z.number().optional(),
  timestamp: z.string().refine(
    (value) => !Number.isNaN(new Date(value).getTime()),
    { message: 'timestamp must be a parseable date string' },
  ),
  userAgent: z.string(),
  userId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const postErrorsSchema = z.object({
  errors: z.array(errorReportSchema).min(1),
});

interface PerformanceReport {
  metrics: Record<string, number>;
  url: string;
  userAgent: string;
  timestamp: string;
}

interface ErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  url: string;
  lineNumber?: number;
  columnNumber?: number;
  timestamp: string;
  userAgent: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

router.post('/performance', validate({ body: performanceReportSchema }), async (req, res): Promise<void> => {
  const report: PerformanceReport = req.body;
  const { metrics, url } = report;

  logger.info('Performance report received', {
    metrics,
    url: url.substring(0, 100),
  });

  res.json({ success: true });
});

function truncate(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  return value.length > max ? value.slice(0, max) : value;
}

export const postErrorsHandler = async (req: Request, res: Response): Promise<void> => {
  const { errors }: { errors: ErrorReport[] } = req.body;

  if (!Array.isArray(errors) || errors.length === 0) {
    throw new AppError('Invalid error data', 400, ErrorCodes.VALIDATION_ERROR);
  }

  if (errors.length > MAX_ERROR_BATCH_SIZE) {
    throw new AppError('Error batch too large', 400, ErrorCodes.VALIDATION_ERROR);
  }

  const rows = errors.map((error) => ({
    message: truncate(error.message, MAX_MESSAGE_LENGTH) ?? 'Unknown error',
    stack: truncate(error.stack, MAX_STACK_LENGTH),
    component_stack: truncate(error.componentStack, MAX_STACK_LENGTH),
    url: truncate(error.url, MAX_URL_LENGTH),
    line_number: error.lineNumber ?? null,
    column_number: error.columnNumber ?? null,
    user_id: error.userId ?? null,
    user_agent: truncate(error.userAgent, MAX_UA_LENGTH),
    metadata: error.metadata ?? {},
    timestamp: error.timestamp
      ? new Date(error.timestamp).toISOString()
      : new Date().toISOString(),
  }));

  try {
    const supabase = getSupabaseAdmin();
    const { error: insertError } = await supabase.from('error_reports').insert(rows);

    if (insertError) {
      logger.error('Failed to persist error reports', insertError);
      throw new AppError('Failed to persist error reports', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Error report persistence failed:', error);
    throw new AppError('Failed to persist error reports', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }

  // 保留控制台日志，便于即时排查
  for (const error of errors) {
    logger.error('Frontend error reported', {
      message: truncate(error.message, 200),
      url: truncate(error.url, 100),
      userId: error.userId,
    });
  }

  res.json({ success: true, count: errors.length });
};
router.post('/errors', validate({ body: postErrorsSchema }), postErrorsHandler);

export const getStatsHandler = async (_req: Request, res: Response): Promise<void> => {
  const supabase = getSupabaseAdmin();
  const { count: errorTotal, error: countError } = await supabase
    .from('error_reports')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    logger.error('Failed to count errors', countError);
    throw new AppError('Failed to get analytics stats', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }

  res.json({
    performance: {
      total: 0,
      avgLCP: 0,
      avgFID: 0,
      avgCLS: 0,
    },
    errors: {
      total: errorTotal ?? 0,
      byType: {} as Record<string, number>,
    },
  });
};
router.get('/stats', requireAuth, getStatsHandler);

router.get('/performance/recent', requireAuth, async (_req, res): Promise<void> => {
  const reports: unknown[] = [];
  res.json({ reports, count: reports.length });
});

export const getRecentErrorsHandler = async (req: Request, res: Response): Promise<void> => {
  const rawLimit = parseInt(String(req.query.limit), 10);
  const limit = Number.isNaN(rawLimit)
    ? DEFAULT_RECENT_LIMIT
    : Math.min(Math.max(rawLimit, 1), MAX_RECENT_LIMIT);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('error_reports')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('Failed to fetch recent errors', error);
    throw new AppError('Failed to get recent errors', 500, ErrorCodes.SYSTEM_INTERNAL_ERROR);
  }

  res.json({ errors: data ?? [], count: data?.length ?? 0 });
};
router.get('/errors/recent', requireAuth, getRecentErrorsHandler);

export default router;
