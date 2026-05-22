import { describe, expect, it, vi } from 'vitest';
import type { Router } from 'express';

vi.mock('../payments.controller', () => ({
  initiatePaymentController: vi.fn(),
  paymentWebhookController: vi.fn(),
}));

import { orderPaymentRouter, paymentWebhookRouter } from '../payments.routes';

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

describe('payments.routes contracts', () => {
  it('exposes order payment initiation route with merge params router', () => {
    const routes = getRouteSignatures(orderPaymentRouter);

    expect(routes).toContainEqual({ method: 'POST', path: '/:id/pay' });
  });

  it('exposes public payment webhook route', () => {
    const routes = getRouteSignatures(paymentWebhookRouter);

    expect(routes).toContainEqual({ method: 'POST', path: '/payment' });
  });
});
