import type { Request, Response } from 'express';
import { fail, ok } from '@/shared/http/response-envelope';
import { CartService } from './cart.service';
import type { AddItemDto, UpdateItemDto } from './cart.schemas';

const cartService = new CartService();

function requireCustomer(req: Request, res: Response): string | null {
  if (!req.user?.id || req.user.subjectType !== 'CUSTOMER') {
    res.status(401).json(fail('UNAUTHORIZED', 'Autenticação de cliente necessária'));
    return null;
  }
  return req.user.id;
}

export async function getCartController(req: Request, res: Response): Promise<void> {
  const customerId = requireCustomer(req, res);
  if (!customerId) return;
  const cart = await cartService.getCart(customerId);
  res.status(200).json(ok(cart));
}

export async function addItemController(req: Request, res: Response): Promise<void> {
  const customerId = requireCustomer(req, res);
  if (!customerId) return;
  try {
    const { productId, quantity, variantId } = req.body as AddItemDto;
    const cart = await cartService.addItem(customerId, productId, quantity, variantId);
    res.status(200).json(ok(cart));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    const code = e.statusCode === 404 ? 'NOT_FOUND' : 'UNPROCESSABLE_ENTITY';
    res.status(e.statusCode ?? 500).json(fail(code, e.message));
  }
}

export async function updateItemController(req: Request, res: Response): Promise<void> {
  const customerId = requireCustomer(req, res);
  if (!customerId) return;
  try {
    const productId = String(req.params['productId'] ?? '');
    const { quantity } = req.body as UpdateItemDto;
    const cart = await cartService.setItemQuantity(customerId, productId, quantity);
    res.status(200).json(ok(cart));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    const code = e.statusCode === 404 ? 'NOT_FOUND' : 'UNPROCESSABLE_ENTITY';
    res.status(e.statusCode ?? 500).json(fail(code, e.message));
  }
}

export async function removeItemController(req: Request, res: Response): Promise<void> {
  const customerId = requireCustomer(req, res);
  if (!customerId) return;
  try {
    const productId = String(req.params['productId'] ?? '');
    const variantId = typeof req.query['variantId'] === 'string' ? req.query['variantId'] : undefined;
    const cart = await cartService.removeItem(customerId, productId, variantId);
    res.status(200).json(ok(cart));
  } catch (err) {
    const e = err as Error & { statusCode?: number };
    res.status(e.statusCode ?? 500).json(fail('INTERNAL_ERROR', e.message));
  }
}

export async function clearCartController(req: Request, res: Response): Promise<void> {
  const customerId = requireCustomer(req, res);
  if (!customerId) return;
  const cart = await cartService.clearCart(customerId);
  res.status(200).json(ok(cart));
}
