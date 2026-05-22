import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express, { Router } from 'express';
import type { AddressInfo } from 'node:net';

function passthrough(_req: express.Request, _res: express.Response, next: express.NextFunction): void {
  next();
}

function buildRootRouter(tag: string): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    res.status(200).json({ tag });
  });
  return router;
}

function buildAdminOperationsRouter(): Router {
  const router = Router();
  router.get('/dashboard', (_req, res) => {
    res.status(200).json({ tag: 'admin-dashboard' });
  });
  router.get('/reports/sales', (_req, res) => {
    res.status(200).json({ tag: 'admin-sales-report' });
  });
  router.get('/reports/low-stock', (_req, res) => {
    res.status(200).json({ tag: 'admin-low-stock-report' });
  });
  return router;
}

vi.mock('@/shared/middleware/authenticate', () => ({ authenticate: passthrough }));
vi.mock('@/shared/middleware/security', () => ({
  securityMiddleware: passthrough,
  corsMiddleware: passthrough,
  httpsRedirectMiddleware: passthrough,
}));
vi.mock('@/shared/middleware/rate-limit', () => ({
  authRateLimiter: passthrough,
  generalRateLimiter: passthrough,
}));
vi.mock('@/shared/middleware/redirect', () => ({ redirectMiddleware: passthrough }));
vi.mock('@/shared/middleware/not-found', () => ({
  notFoundMiddleware: (_req: express.Request, res: express.Response) => {
    res.status(404).json({ code: 'NOT_FOUND' });
  },
}));
vi.mock('@/shared/middleware/error-handler', () => ({
  errorHandlerMiddleware: (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: String(err) });
  },
}));

vi.mock('@/modules/auth/auth.routes', () => ({ authRouter: buildRootRouter('auth-root') }));
vi.mock('@/modules/customers/customers.routes', () => ({
  customersRouter: buildRootRouter('me-root'),
  adminCustomersRouter: buildRootRouter('admin-customers-root'),
}));
vi.mock('@/modules/catalog/catalog.routes', () => ({
  catalogRouter: buildRootRouter('products-root'),
  adminCatalogRouter: buildRootRouter('admin-products-root'),
}));
vi.mock('@/modules/categories/categories.routes', () => ({
  categoriesRouter: buildRootRouter('categories-root'),
  adminCategoriesRouter: buildRootRouter('admin-categories-root'),
}));
vi.mock('@/modules/orders/orders.routes', () => ({
  ordersRouter: buildRootRouter('orders-root'),
  adminOrdersRouter: buildRootRouter('admin-orders-root'),
}));
vi.mock('@/modules/orders/coupons.routes', () => ({
  couponsAdminRouter: buildRootRouter('admin-coupons-root'),
}));
vi.mock('@/modules/reviews/reviews.routes', () => ({
  reviewsRouter: buildRootRouter('reviews-root'),
  adminReviewsRouter: buildRootRouter('admin-reviews-root'),
}));
vi.mock('@/modules/seo/seo.routes', () => ({
  seoRouter: buildRootRouter('seo-root'),
  adminRedirectsRouter: buildRootRouter('admin-redirects-root'),
}));
vi.mock('@/modules/payments/payments.routes', () => ({
  orderPaymentRouter: buildRootRouter('order-payment-root'),
  paymentWebhookRouter: buildRootRouter('payment-webhook-root'),
}));
vi.mock('@/modules/shipping/shipping.routes', () => ({
  shippingRouter: buildRootRouter('shipping-root'),
}));
vi.mock('@/modules/admin/admin.routes', () => ({
  adminOperationsRouter: buildAdminOperationsRouter(),
}));

import { app } from '@/app';

let baseUrl = '';
let server: ReturnType<typeof app.listen>;

beforeAll(async () => {
  server = app.listen(0, '127.0.0.1');

  await new Promise<void>((resolve, reject) => {
    server.once('listening', () => resolve());
    server.once('error', (err) => reject(err));
  });

  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
});

describe('app admin mounts coexistence', () => {
  it('serves /admin/dashboard from admin operations router', async () => {
    const response = await fetch(`${baseUrl}/admin/dashboard`);
    const body = (await response.json()) as { tag: string };

    expect(response.status).toBe(200);
    expect(body.tag).toBe('admin-dashboard');
  });

  it('keeps explicit admin mounts reachable without shadowing', async () => {
    const endpoints = [
      ['/admin/customers', 'admin-customers-root'],
      ['/admin/orders', 'admin-orders-root'],
      ['/admin/coupons', 'admin-coupons-root'],
      ['/admin/reviews', 'admin-reviews-root'],
      ['/admin/redirects', 'admin-redirects-root'],
    ] as const;

    for (const [path, expectedTag] of endpoints) {
      const response = await fetch(`${baseUrl}${path}`);
      const body = (await response.json()) as { tag: string };

      expect(response.status).toBe(200);
      expect(body.tag).toBe(expectedTag);
    }
  });
});
