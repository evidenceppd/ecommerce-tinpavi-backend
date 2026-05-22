import { Router } from 'express';
import { authenticate } from '@/shared/middleware/authenticate';
import { requireAdmin } from '@/shared/middleware/require-admin';
import { ok } from '@/shared/http/response-envelope';
import { blogsService } from './blogs.service';
import type { Request, Response } from 'express';

export const blogsRouter = Router();

// Public routes
blogsRouter.get('/published', async (req: Request, res: Response) => {
  const perPage = Math.min(Number(req.query['perPage'] ?? 100), 200);
  const data = await blogsService.listPublished(perPage);
  res.json(ok(data));
});

blogsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params['id']);
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid id' }); return; }
  const data = await blogsService.getById(id);
  if (!data) { res.status(404).json({ success: false, error: 'Not found' }); return; }
  res.json(ok(data));
});

// Admin routes (authenticated)
blogsRouter.get('/', authenticate, requireAdmin, async (_req: Request, res: Response) => {
  const data = await blogsService.list();
  res.json(ok(data));
});

blogsRouter.post('/', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const data = await blogsService.create(req.body);
  res.status(201).json(ok(data));
});

blogsRouter.put('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params['id']);
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid id' }); return; }
  const data = await blogsService.update(id, req.body);
  res.json(ok(data));
});

blogsRouter.delete('/:id', authenticate, requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params['id']);
  if (isNaN(id)) { res.status(400).json({ success: false, error: 'Invalid id' }); return; }
  await blogsService.remove(id);
  res.status(204).send();
});
