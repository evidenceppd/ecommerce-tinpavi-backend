import type { Request, Response } from 'express';
import { ok, fail } from '@/shared/http/response-envelope';
import { ReviewsService } from './reviews.service';
import {
  createReviewSchema,
  updateReviewSchema,
  moderateReviewSchema,
  listAdminReviewsQuerySchema,
} from './reviews.schemas';

const service = new ReviewsService();

export async function listReviewsController(req: Request, res: Response): Promise<void> {
  const productId = String(req.params['productId'] ?? '');
  const page = Math.max(1, Number(req.query['page'] ?? 1));
  const limit = Math.min(50, Math.max(1, Number(req.query['limit'] ?? 20)));
  const result = await service.listReviews(productId, page, limit);
  res.json(ok(result));
}

export async function reviewEligibilityController(req: Request, res: Response): Promise<void> {
  const customerId = requireUser(req, res);
  if (!customerId) return;
  const productId = String(req.params['productId'] ?? '');
  const result = await service.getReviewEligibility(customerId, productId);
  res.status(200).json(ok(result));
}

function requireUser(req: Request, res: Response): string | null {
  if (!req.user?.id) {
    res.status(401).json(fail('UNAUTHORIZED', 'Authentication required'));
    return null;
  }
  return req.user.id;
}

function mapError(message: string): { status: number; code: string; msg: string } {
  if (message === 'REVIEW_NOT_FOUND')
    return { status: 404, code: 'REVIEW_NOT_FOUND', msg: 'Review not found' };
  if (message === 'REVIEW_ALREADY_EXISTS')
    return { status: 409, code: 'REVIEW_ALREADY_EXISTS', msg: 'You have already reviewed this product' };
  if (message === 'PURCHASE_REQUIRED')
    return { status: 403, code: 'PURCHASE_REQUIRED', msg: 'Only customers who bought this product can review it' };
  return { status: 500, code: 'INTERNAL_ERROR', msg: 'Internal server error' };
}

export async function createReviewController(req: Request, res: Response): Promise<void> {
  const customerId = requireUser(req, res);
  if (!customerId) return;
  try {
    const dto = createReviewSchema.parse(req.body);
    const productId = String(req.params['productId'] ?? '');
    const review = await service.createReview(dto, customerId, productId);
    res.status(201).json(ok(review));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function updateMyReviewController(req: Request, res: Response): Promise<void> {
  const customerId = requireUser(req, res);
  if (!customerId) return;
  try {
    const dto = updateReviewSchema.parse(req.body);
    const productId = String(req.params['productId'] ?? '');
    const review = await service.updateMyReview(customerId, productId, dto);
    res.status(200).json(ok(review));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function deleteMyReviewController(req: Request, res: Response): Promise<void> {
  const customerId = requireUser(req, res);
  if (!customerId) return;
  try {
    const productId = String(req.params['productId'] ?? '');
    await service.deleteMyReview(customerId, productId);
    res.status(204).send();
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function adminListReviewsController(req: Request, res: Response): Promise<void> {
  try {
    const query = listAdminReviewsQuerySchema.parse(req.query);
    const result = await service.listAdminReviews(query);
    res.status(200).json(ok(result.items, { total: result.total, page: result.page, limit: result.limit }));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function adminModerateReviewController(req: Request, res: Response): Promise<void> {
  const adminId = requireUser(req, res);
  if (!adminId) return;
  try {
    const dto = moderateReviewSchema.parse(req.body);
    const review = await service.moderateReview(String(req.params['id'] ?? ''), dto, adminId);
    res.status(200).json(ok(review));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function adminDeleteReviewController(req: Request, res: Response): Promise<void> {
  try {
    await service.deleteReviewAsAdmin(String(req.params['id'] ?? ''));
    res.status(204).send();
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}
