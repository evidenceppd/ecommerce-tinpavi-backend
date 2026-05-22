import { Router } from 'express';
import { authenticate } from '@/shared/middleware/authenticate';
import { ok } from '@/shared/http/response-envelope';
import { analyticsService } from './analytics.service';
import type { Request, Response } from 'express';

export const analyticsRouter = Router();

analyticsRouter.post('/track', async (req: Request, res: Response) => {
  const ua = req.headers['user-agent'] ?? '';
  const result = await analyticsService.track(req.body ?? {}, ua);
  res.status(201).json(ok(result));
});

analyticsRouter.get('/stats', authenticate, async (_req: Request, res: Response) => {
  const data = await analyticsService.getStats();
  res.json(ok(data));
});

analyticsRouter.get('/views-month', authenticate, async (req: Request, res: Response) => {
  const dateFrom = req.query['dateFrom'] ? new Date(String(req.query['dateFrom'])) : undefined;
  const dateTo = req.query['dateTo'] ? new Date(String(req.query['dateTo'])) : undefined;
  const data = await analyticsService.getViewsMonth(dateFrom, dateTo);
  res.json(ok(data));
});

analyticsRouter.get('/devices-month', authenticate, async (_req: Request, res: Response) => {
  const data = await analyticsService.getDevicesMonth();
  res.json(ok(data));
});

analyticsRouter.get('/daily-average', authenticate, async (_req: Request, res: Response) => {
  const data = await analyticsService.getDailyAverage();
  res.json(ok(data));
});

analyticsRouter.get('/last-7-days', authenticate, async (_req: Request, res: Response) => {
  const data = await analyticsService.getLast7Days();
  res.json(ok(data));
});

analyticsRouter.get('/top-pages', authenticate, async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query['limit'] ?? 10), 50);
  const data = await analyticsService.getTopPages(limit);
  res.json(ok(data));
});

analyticsRouter.delete('/cleanup', authenticate, async (req: Request, res: Response) => {
  const days = Math.max(Number(req.query['days'] ?? 90), 7);
  const data = await analyticsService.cleanup(days);
  res.json(ok(data));
});
