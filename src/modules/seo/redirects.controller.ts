import type { Request, Response } from 'express';
import { ok, fail } from '@/shared/http/response-envelope';
import { listRedirectsQuerySchema, type CreateRedirectDto, type UpdateRedirectDto } from './seo.schemas';
import { RedirectsService } from './redirects.service';

const service = new RedirectsService();

function mapError(msg: string) {
  if (msg === 'REDIRECT_NOT_FOUND') return { status: 404, code: 'REDIRECT_NOT_FOUND', msg: 'Redirect not found' };
  return { status: 500, code: 'INTERNAL_ERROR', msg: 'Internal server error' };
}

export async function listRedirectsController(req: Request, res: Response): Promise<void> {
  try {
    const query = listRedirectsQuerySchema.parse(req.query);
    const result = await service.list(query);
    res.status(200).json(ok(result.items, { total: result.total, page: query.page, limit: query.limit }));
  } catch (err) {
    const e = mapError((err as Error).message);
    res.status(e.status).json(fail(e.code, e.msg));
  }
}

export async function createRedirectController(req: Request, res: Response): Promise<void> {
  try {
    const redirect = await service.create(req.body as CreateRedirectDto);
    res.status(201).json(ok(redirect));
  } catch (err) {
    const e = mapError((err as Error).message);
    res.status(e.status).json(fail(e.code, e.msg));
  }
}

export async function updateRedirectController(req: Request, res: Response): Promise<void> {
  try {
    const redirect = await service.update(String(req.params['id']), req.body as UpdateRedirectDto);
    res.status(200).json(ok(redirect));
  } catch (err) {
    const e = mapError((err as Error).message);
    res.status(e.status).json(fail(e.code, e.msg));
  }
}

export async function deleteRedirectController(req: Request, res: Response): Promise<void> {
  try {
    await service.delete(String(req.params['id']));
    res.status(204).send();
  } catch (err) {
    const e = mapError((err as Error).message);
    res.status(e.status).json(fail(e.code, e.msg));
  }
}
