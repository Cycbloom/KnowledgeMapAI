import { Router, type Response } from 'express';
import { requireAuth, type AuthedRequest } from '../../middleware/auth';
import { dailyReportService } from '../../services/scheduler/dailyReportService';

const router = Router();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 本周一（本地时区） */
function mondayOf(d: Date): string {
  const copy = new Date(d);
  const dow = (copy.getDay() + 6) % 7; // 周一=0
  copy.setDate(copy.getDate() - dow);
  return localDateStr(copy);
}

// GET /api/v1/statistics/reports/daily?date=YYYY-MM-DD（默认今天）
router.get('/daily', requireAuth, async (req: AuthedRequest, res: Response) => {
  const raw = req.query.date;
  const date =
    typeof raw === 'string' && DATE_RE.test(raw)
      ? raw
      : localDateStr(new Date());
  const report = await dailyReportService.getDailyReport(
    req.supabase,
    req.user.id,
    date,
  );
  res.json(report);
});

// GET /api/v1/statistics/reports/weekly?weekStart=YYYY-MM-DD（默认本周一）
router.get('/weekly', requireAuth, async (req: AuthedRequest, res: Response) => {
  const raw = req.query.weekStart;
  const weekStart =
    typeof raw === 'string' && DATE_RE.test(raw)
      ? raw
      : mondayOf(new Date());
  const report = await dailyReportService.getWeeklyReport(
    req.supabase,
    req.user.id,
    weekStart,
  );
  res.json(report);
});

export default router;
