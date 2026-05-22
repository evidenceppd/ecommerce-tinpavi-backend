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

vi.mock('../seo.controller', () => ({
  sitemapController: vi.fn(),
  robotsTxtController: vi.fn(),
  productSchemaController: vi.fn(),
  categorySchemaController: vi.fn(),
}));

vi.mock('../redirects.controller', () => ({
  listRedirectsController: vi.fn(),
  createRedirectController: vi.fn(),
  updateRedirectController: vi.fn(),
  deleteRedirectController: vi.fn(),
}));

import { seoRouter, adminRedirectsRouter } from '../seo.routes';

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
    if (!layer.route?.path || !layer.route.methods) {
      continue;
    }

    for (const [method, enabled] of Object.entries(layer.route.methods)) {
      if (enabled) {
        routes.push({ method: method.toUpperCase(), path: String(layer.route.path) });
      }
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
    if (layer.route) {
      return false;
    }

    return layer.name === 'requireAdmin' || layer.handle?.name === 'requireAdmin';
  });
}

describe('seo.routes contracts', () => {
  it('exposes public sitemap, robots and schema endpoints', () => {
    const routes = getRouteSignatures(seoRouter);

    expect(routes).toContainEqual({ method: 'GET', path: '/sitemap.xml' });
    expect(routes).toContainEqual({ method: 'GET', path: '/robots.txt' });
    expect(routes).toContainEqual({ method: 'GET', path: '/products/:slug/schema' });
    expect(routes).toContainEqual({ method: 'GET', path: '/categories/:slug/schema' });
  });

  it('protects admin redirects routes with requireAdmin', () => {
    const routes = getRouteSignatures(adminRedirectsRouter);

    expect(hasRequireAdminMiddleware(adminRedirectsRouter)).toBe(true);
    expect(routes).toContainEqual({ method: 'GET', path: '/' });
    expect(routes).toContainEqual({ method: 'POST', path: '/' });
    expect(routes).toContainEqual({ method: 'PATCH', path: '/:id' });
    expect(routes).toContainEqual({ method: 'DELETE', path: '/:id' });
  });
});
