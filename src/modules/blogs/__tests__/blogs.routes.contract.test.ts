import { describe, expect, it, vi } from 'vitest';
import type { Router } from 'express';

vi.mock('@/shared/middleware/authenticate', () => ({
  authenticate: function authenticate(_req: unknown, _res: unknown, next: () => void) {
    next();
  },
}));

vi.mock('@/shared/middleware/require-admin', () => ({
  requireAdmin: function requireAdmin(_req: unknown, _res: unknown, next: () => void) {
    next();
  },
}));

vi.mock('../blogs.service', () => ({
  blogsService: {
    listPublished: vi.fn(),
    getById: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

import { blogsRouter } from '../blogs.routes';

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

describe('blogs.routes contracts', () => {
  it('exposes public and admin blog endpoints', () => {
    const routes = getRouteSignatures(blogsRouter);

    expect(routes).toContainEqual({ method: 'GET', path: '/published' });
    expect(routes).toContainEqual({ method: 'GET', path: '/:id' });
    expect(routes).toContainEqual({ method: 'GET', path: '/' });
    expect(routes).toContainEqual({ method: 'POST', path: '/' });
    expect(routes).toContainEqual({ method: 'PUT', path: '/:id' });
    expect(routes).toContainEqual({ method: 'DELETE', path: '/:id' });
  });
});
