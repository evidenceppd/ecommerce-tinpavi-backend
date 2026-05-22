import { describe, expect, it, vi } from 'vitest';
import type { Router } from 'express';

vi.mock('@/shared/middleware/require-admin', () => ({
  requireAdmin: function requireAdmin(_req: unknown, _res: unknown, next: () => void) {
    next();
  },
}));

vi.mock('@/shared/middleware/validate', () => ({
  validate: () => function validateBody(_req: unknown, _res: unknown, next: () => void) {
    next();
  },
}));

vi.mock('../customers.controller', () => ({
  adminGetCustomerController: vi.fn(),
  adminListCustomersController: vi.fn(),
  adminUpdateCustomerController: vi.fn(),
  adminCreateCustomerController: vi.fn(),
  adminDeleteCustomerController: vi.fn(),
  createAddressController: vi.fn(),
  deleteAddressController: vi.fn(),
  getOrderHistoryController: vi.fn(),
  getProfileController: vi.fn(),
  listAddressesController: vi.fn(),
  updateAddressController: vi.fn(),
  updateProfileController: vi.fn(),
}));

import { adminCustomersRouter, customersRouter } from '../customers.routes';

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

describe('customers.routes contracts', () => {
  it('exposes customer profile, addresses and order-history routes', () => {
    const routes = getRouteSignatures(customersRouter);

    expect(routes).toContainEqual({ method: 'GET', path: '/profile' });
    expect(routes).toContainEqual({ method: 'PUT', path: '/profile' });
    expect(routes).toContainEqual({ method: 'GET', path: '/addresses' });
    expect(routes).toContainEqual({ method: 'POST', path: '/addresses' });
    expect(routes).toContainEqual({ method: 'PUT', path: '/addresses/:addressId' });
    expect(routes).toContainEqual({ method: 'DELETE', path: '/addresses/:addressId' });
    expect(routes).toContainEqual({ method: 'GET', path: '/orders' });
  });

  it('exposes and protects admin customer management routes', () => {
    const routes = getRouteSignatures(adminCustomersRouter);

    expect(hasRequireAdminMiddleware(adminCustomersRouter)).toBe(true);
    expect(routes).toContainEqual({ method: 'GET', path: '/' });
    expect(routes).toContainEqual({ method: 'POST', path: '/' });
    expect(routes).toContainEqual({ method: 'GET', path: '/:id' });
    expect(routes).toContainEqual({ method: 'PATCH', path: '/:id' });
    expect(routes).toContainEqual({ method: 'DELETE', path: '/:id' });
  });
});
