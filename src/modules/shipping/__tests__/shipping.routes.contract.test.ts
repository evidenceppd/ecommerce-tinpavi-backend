import { describe, expect, it, vi } from 'vitest';
import type { Router } from 'express';

vi.mock('../shipping.controller', () => ({
  quoteShippingController: vi.fn(),
}));

import { shippingRouter } from '../shipping.routes';

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

describe('shipping.routes contracts', () => {
  it('exposes shipping quote endpoint', () => {
    const routes = getRouteSignatures(shippingRouter);

    expect(routes).toContainEqual({ method: 'POST', path: '/quotes' });
  });
});
