import type { Request, Response } from 'express';
import { ok, fail } from '@/shared/http/response-envelope';
import { CouponsService } from './coupons.service';
import { createCouponSchema, updateCouponSchema, listCouponsQuerySchema } from './coupons.schemas';

const service = new CouponsService();

function mapError(message: string): { status: number; code: string; msg: string } {
  if (message === 'COUPON_NOT_FOUND')
    return { status: 404, code: 'COUPON_NOT_FOUND', msg: 'Coupon not found' };
  if (message === 'COUPON_CODE_CONFLICT')
    return { status: 409, code: 'COUPON_CODE_CONFLICT', msg: 'Coupon code already in use' };
  return { status: 500, code: 'INTERNAL_ERROR', msg: 'Internal server error' };
}

export async function createCouponController(req: Request, res: Response): Promise<void> {
  try {
    const dto = createCouponSchema.parse(req.body);
    const coupon = await service.create(dto);
    res.status(201).json(ok(coupon));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function listCouponsController(req: Request, res: Response): Promise<void> {
  try {
    const query = listCouponsQuerySchema.parse(req.query);
    const result = await service.list(query);
    res
      .status(200)
      .json(ok(result.items, { total: result.total, page: result.page, limit: result.limit }));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function getCouponController(req: Request, res: Response): Promise<void> {
  try {
    const coupon = await service.getById(String(req.params['id'] ?? ''));
    res.status(200).json(ok(coupon));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function updateCouponController(req: Request, res: Response): Promise<void> {
  try {
    const dto = updateCouponSchema.parse(req.body);
    const coupon = await service.update(String(req.params['id'] ?? ''), dto);
    res.status(200).json(ok(coupon));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function deleteCouponController(req: Request, res: Response): Promise<void> {
  try {
    await service.delete(String(req.params['id'] ?? ''));
    res.status(204).send();
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}
