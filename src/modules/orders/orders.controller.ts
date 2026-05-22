import type { Request, Response } from 'express';
import { ok, fail } from '@/shared/http/response-envelope';
import { OrdersService } from './orders.service';
import { checkoutSchema, updateOrderStatusSchema, listOrdersQuerySchema, validateCouponSchema } from './orders.schemas';
import { withAbort } from '@/shared/infra/with-abort';
import { parseFieldsParam, selectFields } from '@/shared/http/response-fields';

const service = new OrdersService();

function mapError(message: string): { status: number; code: string; msg: string } {
  const map: Record<string, [number, string]> = {
    ADDRESS_NOT_FOUND: [404, 'Shipping address not found or not owned by customer'],
    SHIPPING_ADDRESS_REQUIRED: [400, 'Shipping address payload is required for this checkout mode'],
    PRODUCT_NOT_FOUND: [404, 'Product not found or inactive'],
    VARIANT_NOT_FOUND: [404, 'Product variant not found'],
    INSUFFICIENT_STOCK: [422, 'Insufficient stock for one or more items'],
    COUPON_NOT_FOUND: [404, 'Coupon not found'],
    COUPON_INACTIVE: [422, 'Coupon is inactive'],
    COUPON_NOT_YET_VALID: [422, 'Coupon is not yet valid'],
    COUPON_EXPIRED: [422, 'Coupon has expired'],
    COUPON_MAX_USES_REACHED: [422, 'Coupon usage limit reached'],
    COUPON_MAX_USES_PER_CUSTOMER_REACHED: [422, 'Coupon usage limit per customer reached'],
    COUPON_EXCEEDS_ORDER_TOTAL: [422, 'Coupon discount exceeds order total'],
    SHIPPING_QUOTE_INVALID: [422, 'Shipping quote is invalid or expired'],
    ORDER_NOT_FOUND: [404, 'Order not found'],
    ORDER_CANCEL_NOT_ALLOWED: [422, 'Order cannot be cancelled in its current status'],
    REQUEST_ABORTED: [503, 'Request timed out'],
    REQUEST_TIMEOUT: [503, 'Request timed out'],
  };
  const entry = map[message];
  if (entry) return { status: entry[0], code: message, msg: entry[1] };
  return { status: 500, code: 'INTERNAL_ERROR', msg: 'Internal server error' };
}

export async function checkoutController(req: Request, res: Response): Promise<void> {
  try {
    const dto = checkoutSchema.parse(req.body);
    const customerId = req.user!.id;
    const order = await withAbort(req.abortSignal, service.checkout(dto, customerId));
    res.status(201).json(ok(order));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function validateCouponController(req: Request, res: Response): Promise<void> {
  try {
    const dto = validateCouponSchema.parse(req.body);
    const result = await service.validateCouponForCheckout(dto, req.user!.id);
    res.status(200).json(ok(result));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function listMyOrdersController(req: Request, res: Response): Promise<void> {
  try {
    const page = Number(req.query['page'] ?? 1);
    const limit = Number(req.query['limit'] ?? 20);
    const customerId = req.user!.id;
    const result = await withAbort(req.abortSignal, service.listMyOrders(customerId, { page, limit }));
    const fields = parseFieldsParam(req.query?.['fields']);
    const payload = selectFields(result.items as Array<Record<string, unknown>>, fields);
    res
      .status(200)
      .json(ok(payload, { total: result.total, page: result.page, limit: result.limit }));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function getMyOrderController(req: Request, res: Response): Promise<void> {
  try {
    const order = await withAbort(
      req.abortSignal,
      service.getOrderAsCustomer(String(req.params['id'] ?? ''), req.user!.id),
    );
    const fields = parseFieldsParam(req.query?.['fields']);
    const payload = selectFields(order as Record<string, unknown>, fields);
    res.status(200).json(ok(payload));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function cancelMyOrderController(req: Request, res: Response): Promise<void> {
  try {
    const order = await service.cancelAsCustomer(
      String(req.params['id'] ?? ''),
      req.user!.id,
    );
    res.status(200).json(ok(order));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function adminListOrdersController(req: Request, res: Response): Promise<void> {
  try {
    const query = listOrdersQuerySchema.parse(req.query);
    const result = await service.listAdminOrders(query);
    res
      .status(200)
      .json(ok(result.items, { total: result.total, page: result.page, limit: result.limit }));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function adminGetOrderController(req: Request, res: Response): Promise<void> {
  try {
    const order = await service.getOrderAsAdmin(String(req.params['id'] ?? ''));
    res.status(200).json(ok(order));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}

export async function adminUpdateOrderStatusController(req: Request, res: Response): Promise<void> {
  try {
    const dto = updateOrderStatusSchema.parse(req.body);
    const order = await service.updateStatusAsAdmin(
      String(req.params['id'] ?? ''),
      dto,
      req.user!.id,
    );
    res.status(200).json(ok(order));
  } catch (err) {
    const { status, code, msg } = mapError((err as Error).message);
    res.status(status).json(fail(code, msg));
  }
}
