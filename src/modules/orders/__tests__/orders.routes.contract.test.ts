import { describe, expect, it, vi } from 'vitest';
import type { Router } from 'express';

vi.mock('@/shared/middleware/require-admin', () => ({
  requireAdmin: function requireAdmin(_req: unknown, _res: unknown, next: () => void) {
    next();
  },
}));

vi.mock('../orders.controller', () => ({
  checkoutController: vi.fn(),
  listMyOrdersController: vi.fn(),
  getMyOrderController: vi.fn(),
  cancelMyOrderController: vi.fn(),
  adminListOrdersController: vi.fn(),
  adminGetOrderController: vi.fn(),
  adminUpdateOrderStatusController: vi.fn(),
}));

import { adminOrdersRouter, ordersRouter } from '../orders.routes';

type RouteSignature = {
  method: string;
  path: string;
};

function getRouteSignatures(router: Router): RouteSignature[] {
  const stack = ((router as unknown as { stack?: unknown[] }).stack ?? []) as Array<{
    route?: { path?: string; methods?: Record<string, boolean> };
  }>;

  const routes: RouteSignature[] = [];

  for (const layer of stack) {
    if (!layer.route?.path || !layer.route.methods) continue;

    for (const [method, enabled] of Object.entries(layer.route.methods)) {
      if (enabled) routes.push({ method: method.toUpperCase(), path: String(layer.route.path) });
    }
  }

  return routes;
}

function hasRequireAdminMiddleware(router: Router): boolean {
  const stack = ((router as unknown as { stack?: unknown[] }).stack ?? []) as Array<{
    route?: unknown;
    name?: string;
    handle?: { name?: string };
  }>;

  return stack.some((layer) => {
    if (layer.route) return false;
    return layer.name === 'requireAdmin' || layer.handle?.name === 'requireAdmin';
  });
}

describe('orders.routes contracts', () => {
  it('exposes customer checkout and order lifecycle routes', () => {
    const routes = getRouteSignatures(ordersRouter);

    expect(routes).toContainEqual({ method: 'POST', path: '/' });
    expect(routes).toContainEqual({ method: 'GET', path: '/' });
    expect(routes).toContainEqual({ method: 'GET', path: '/:id' });
    expect(routes).toContainEqual({ method: 'DELETE', path: '/:id/cancel' });
  });

  it('exposes and protects admin order management routes', () => {
    const routes = getRouteSignatures(adminOrdersRouter);

    expect(hasRequireAdminMiddleware(adminOrdersRouter)).toBe(true);
    expect(routes).toContainEqual({ method: 'GET', path: '/' });
    expect(routes).toContainEqual({ method: 'GET', path: '/:id' });
    expect(routes).toContainEqual({ method: 'PATCH', path: '/:id/status' });
  });
});
