import { describe, expect, it, vi } from 'vitest';
import type { Router } from 'express';

vi.mock('@/shared/middleware/require-admin', () => ({
  requireAdmin: function requireAdmin(_req: unknown, _res: unknown, next: () => void) {
    next();
  },
}));

vi.mock('@/shared/middleware/cache-headers.middleware', () => ({
  createCacheHeadersMiddleware: () => function cacheMiddleware(_req: unknown, _res: unknown, next: () => void) {
    next();
  },
}));

vi.mock('@/shared/middleware/validate', () => ({
  validate: () => function validateBody(_req: unknown, _res: unknown, next: () => void) {
    next();
  },
}));

vi.mock('../catalog.controller', () => ({
  listProductsController: vi.fn(),
  getProductController: vi.fn(),
  listAdminProductsController: vi.fn(),
  getAdminProductController: vi.fn(),
  createProductController: vi.fn(),
  updateProductController: vi.fn(),
  deleteProductController: vi.fn(),
  listProductVariantsController: vi.fn(),
  createProductVariantController: vi.fn(),
  updateProductVariantController: vi.fn(),
  deleteProductVariantController: vi.fn(),
}));

import { adminCatalogRouter, catalogRouter } from '../catalog.routes';

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

describe('catalog.routes contracts', () => {
  it('exposes public catalog list and product detail routes', () => {
    const routes = getRouteSignatures(catalogRouter);

    expect(routes).toContainEqual({ method: 'GET', path: '/' });
    expect(routes).toContainEqual({ method: 'GET', path: '/:code' });
  });

  it('exposes admin catalog CRUD routes', () => {
    const routes = getRouteSignatures(adminCatalogRouter);

    expect(routes).toContainEqual({ method: 'GET', path: '/' });
    expect(routes).toContainEqual({ method: 'GET', path: '/:id' });
    expect(routes).toContainEqual({ method: 'GET', path: '/:id/variants' });
    expect(routes).toContainEqual({ method: 'POST', path: '/:id/variants' });
    expect(routes).toContainEqual({ method: 'PUT', path: '/:id/variants/:variantId' });
    expect(routes).toContainEqual({ method: 'DELETE', path: '/:id/variants/:variantId' });
    expect(routes).toContainEqual({ method: 'POST', path: '/' });
    expect(routes).toContainEqual({ method: 'PUT', path: '/:id' });
    expect(routes).toContainEqual({ method: 'DELETE', path: '/:id' });
  });
});
