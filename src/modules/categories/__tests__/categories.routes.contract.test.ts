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

vi.mock('../categories.controller', () => ({
  listCategoriesController: vi.fn(),
  getCategoryController: vi.fn(),
  createCategoryController: vi.fn(),
  updateCategoryController: vi.fn(),
  deleteCategoryController: vi.fn(),
}));

import { adminCategoriesRouter, categoriesRouter } from '../categories.routes';

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

describe('categories.routes contracts', () => {
  it('exposes public categories list and detail routes', () => {
    const routes = getRouteSignatures(categoriesRouter);

    expect(routes).toContainEqual({ method: 'GET', path: '/' });
    expect(routes).toContainEqual({ method: 'GET', path: '/:id' });
  });

  it('exposes admin categories CRUD routes', () => {
    const routes = getRouteSignatures(adminCategoriesRouter);

    expect(routes).toContainEqual({ method: 'GET', path: '/' });
    expect(routes).toContainEqual({ method: 'POST', path: '/' });
    expect(routes).toContainEqual({ method: 'PUT', path: '/:id' });
    expect(routes).toContainEqual({ method: 'DELETE', path: '/:id' });
  });
});
