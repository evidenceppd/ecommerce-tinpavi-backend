import { describe, expect, it, vi } from 'vitest';
import type { Router } from 'express';

vi.mock('@/shared/middleware/authenticate', () => ({
  authenticate: function authenticate(_req: unknown, _res: unknown, next: () => void) {
    next();
  },
}));

vi.mock('../analytics.service', () => ({
  analyticsService: {
    track: vi.fn(),
    getStats: vi.fn(),
    getViewsMonth: vi.fn(),
    getDevicesMonth: vi.fn(),
    getDailyAverage: vi.fn(),
    getLast7Days: vi.fn(),
    getTopPages: vi.fn(),
    cleanup: vi.fn(),
  },
}));

import { analyticsRouter } from '../analytics.routes';

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

describe('analytics.routes contracts', () => {
  it('exposes tracking and analytics report endpoints', () => {
    const routes = getRouteSignatures(analyticsRouter);

    expect(routes).toContainEqual({ method: 'POST', path: '/track' });
    expect(routes).toContainEqual({ method: 'GET', path: '/stats' });
    expect(routes).toContainEqual({ method: 'GET', path: '/views-month' });
    expect(routes).toContainEqual({ method: 'GET', path: '/devices-month' });
    expect(routes).toContainEqual({ method: 'GET', path: '/daily-average' });
    expect(routes).toContainEqual({ method: 'GET', path: '/last-7-days' });
    expect(routes).toContainEqual({ method: 'GET', path: '/top-pages' });
    expect(routes).toContainEqual({ method: 'DELETE', path: '/cleanup' });
  });
});
