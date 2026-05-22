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

vi.mock('../users.controller', () => ({
  listUsersController: vi.fn(),
  getMeUserController: vi.fn(),
  createUserController: vi.fn(),
  updateUserController: vi.fn(),
  updateMeUserController: vi.fn(),
  deleteUserController: vi.fn(),
}));

import { usersRouter } from '../users.routes';

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

describe('users.routes contracts', () => {
  it('keeps /me endpoints public to authenticated users', () => {
    const routes = getRouteSignatures(usersRouter);

    expect(routes).toContainEqual({ method: 'GET', path: '/me' });
    expect(routes).toContainEqual({ method: 'PUT', path: '/me' });
  });

  it('protects admin user management routes with requireAdmin', () => {
    const routes = getRouteSignatures(usersRouter);

    expect(hasRequireAdminMiddleware(usersRouter)).toBe(true);
    expect(routes).toContainEqual({ method: 'GET', path: '/' });
    expect(routes).toContainEqual({ method: 'POST', path: '/' });
    expect(routes).toContainEqual({ method: 'PATCH', path: '/:id' });
    expect(routes).toContainEqual({ method: 'DELETE', path: '/:id' });
  });
});
