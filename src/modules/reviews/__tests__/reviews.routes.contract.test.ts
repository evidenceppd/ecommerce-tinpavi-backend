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

vi.mock('../reviews.controller', () => ({
  listReviewsController: vi.fn(),
  createReviewController: vi.fn(),
  reviewEligibilityController: vi.fn(),
  updateMyReviewController: vi.fn(),
  deleteMyReviewController: vi.fn(),
  adminListReviewsController: vi.fn(),
  adminModerateReviewController: vi.fn(),
  adminDeleteReviewController: vi.fn(),
}));

vi.mock('@/shared/middleware/authenticate', () => ({
  authenticate: function authenticate(_req: unknown, _res: unknown, next: () => void) { next(); },
}));

import { adminReviewsRouter, reviewsRouter } from '../reviews.routes';

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

describe('reviews.routes contracts', () => {
  it('exposes customer review create/update/delete routes', () => {
    const routes = getRouteSignatures(reviewsRouter);

    expect(routes).toContainEqual({ method: 'GET', path: '/' });
    expect(routes).toContainEqual({ method: 'GET', path: '/eligibility' });
    expect(routes).toContainEqual({ method: 'POST', path: '/' });
    expect(routes).toContainEqual({ method: 'PATCH', path: '/mine' });
    expect(routes).toContainEqual({ method: 'DELETE', path: '/mine' });
  });

  it('exposes and protects admin review moderation routes', () => {
    const routes = getRouteSignatures(adminReviewsRouter);

    expect(hasRequireAdminMiddleware(adminReviewsRouter)).toBe(true);
    expect(routes).toContainEqual({ method: 'GET', path: '/' });
    expect(routes).toContainEqual({ method: 'PATCH', path: '/:id' });
    expect(routes).toContainEqual({ method: 'DELETE', path: '/:id' });
  });
});
