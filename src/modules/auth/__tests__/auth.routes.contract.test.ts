import { describe, expect, it, vi } from 'vitest';
import type { Router } from 'express';

vi.mock('@/shared/middleware/authenticate', () => ({
  authenticate: function authenticate(_req: unknown, _res: unknown, next: () => void) {
    next();
  },
}));

vi.mock('@/shared/middleware/validate', () => ({
  validate: () => function validateBody(_req: unknown, _res: unknown, next: () => void) {
    next();
  },
}));

vi.mock('../auth.controller', () => ({
  loginController: vi.fn(),
  logoutController: vi.fn(),
  refreshController: vi.fn(),
  registerController: vi.fn(),
  verifyAdminMfaController: vi.fn(),
}));

import { authRouter } from '../auth.routes';

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

describe('auth.routes contracts', () => {
  it('exposes register, login, refresh and logout endpoints', () => {
    const routes = getRouteSignatures(authRouter);

    expect(routes).toContainEqual({ method: 'POST', path: '/register' });
    expect(routes).toContainEqual({ method: 'POST', path: '/login' });
    expect(routes).toContainEqual({ method: 'POST', path: '/login/admin/verify' });
    expect(routes).toContainEqual({ method: 'POST', path: '/refresh' });
    expect(routes).toContainEqual({ method: 'POST', path: '/logout' });
  });
});
