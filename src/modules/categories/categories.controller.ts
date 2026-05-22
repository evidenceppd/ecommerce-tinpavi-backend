import type { Request, Response } from 'express';
import { ok, fail } from '@/shared/http/response-envelope';
import { BASE_URL } from '@/config/seo';
import { listCategoriesQuerySchema, type CreateCategoryDto, type UpdateCategoryDto } from './categories.schemas';
import { CategoriesService } from './categories.service';

const service = new CategoriesService();

function mapError(message: string): { status: number; code: string; msg: string } {
  if (message === 'CATEGORY_NOT_FOUND')
    return { status: 404, code: 'CATEGORY_NOT_FOUND', msg: 'Category not found' };
  return { status: 500, code: 'INTERNAL_ERROR', msg: 'Internal server error' };
}

export async function listCategoriesController(req: Request, res: Response): Promise<void> {
  try {
    const query = listCategoriesQuerySchema.parse(req.query);
    const result = await service.listPaginated(query);
    res.status(200).json(ok(result.items, { total: result.total, page: query.page, limit: query.limit }));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function getCategoryController(req: Request, res: Response): Promise<void> {
  try {
    const category = await service.getById(String(req.params['id'] ?? ''));
    // D-12: canonical header
    res.setHeader('Link', `<${BASE_URL}/categories/${category.id}>; rel="canonical"`);
    res.status(200).json(ok(category));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function createCategoryController(req: Request, res: Response): Promise<void> {
  try {
    const dto = req.body as CreateCategoryDto;
    const category = await service.create(dto);
    res.status(201).json(ok(category));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function updateCategoryController(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params['id'] ?? '');
    const dto = req.body as UpdateCategoryDto;
    const category = await service.update(id, dto);
    res.status(200).json(ok(category));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function deleteCategoryController(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params['id'] ?? '');
    await service.delete(id);
    res.status(204).send();
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}
