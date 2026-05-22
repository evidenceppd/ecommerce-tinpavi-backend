import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express, { Router } from 'express';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'node:net';

function passthrough(_req: express.Request, _res: express.Response, next: express.NextFunction): void {
  next();
}

function buildPrefixedCatchAllRouter(tag: string): Router {
  const router = Router();
  router.use((req, res) => {
    res.status(200).json({ success: true, tag, method: req.method, path: req.path });
  });
  return router;
}

function requireJwt(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
    return;
  }

  try {
    jwt.verify(authHeader.slice(7), process.env['JWT_SECRET'] ?? '');
    next();
  } catch {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
  }
}

function buildAuthRouter(): Router {
  const router = Router();
  router.post('/register', (_req, res) => res.status(200).json({ success: true }));
  router.post('/login', (_req, res) => res.status(200).json({ success: true }));
  router.post('/refresh', (_req, res) => res.status(200).json({ success: true }));
  router.post('/logout', requireJwt, (_req, res) => res.status(200).json({ success: true }));
  return router;
}

function buildCatalogRouter(): Router {
  const router = Router();
  router.get('/', (_req, res) => res.status(200).json({ success: true, tag: 'catalog-list' }));
  router.get('/:code', (_req, res) => res.status(200).json({ success: true, tag: 'catalog-detail' }));
  return router;
}

function buildCategoriesRouter(): Router {
  const router = Router();
  router.get('/', (_req, res) => res.status(200).json({ success: true, tag: 'categories-list' }));
  router.get('/:id', (_req, res) => res.status(200).json({ success: true, tag: 'categories-detail' }));
  return router;
}

function buildReviewsRouter(): Router {
  const router = Router();
  router.get('/', (_req, res) => res.status(200).json({ success: true }));
  router.get('/eligibility', requireJwt, (_req, res) => res.status(200).json({ success: true }));
  router.post('/', requireJwt, (_req, res) => res.status(200).json({ success: true }));
  router.patch('/mine', requireJwt, (_req, res) => res.status(200).json({ success: true }));
  router.delete('/mine', requireJwt, (_req, res) => res.status(200).json({ success: true }));
  return router;
}

function buildAnalyticsRouter(): Router {
  const router = Router();
  router.post('/track', (_req, res) => res.status(200).json({ success: true }));
  router.get('/stats', requireJwt, (_req, res) => res.status(200).json({ success: true }));
  router.get('/views-month', requireJwt, (_req, res) => res.status(200).json({ success: true }));
  router.get('/devices-month', requireJwt, (_req, res) => res.status(200).json({ success: true }));
  router.get('/daily-average', requireJwt, (_req, res) => res.status(200).json({ success: true }));
  router.get('/last-7-days', requireJwt, (_req, res) => res.status(200).json({ success: true }));
  router.get('/top-pages', requireJwt, (_req, res) => res.status(200).json({ success: true }));
  router.delete('/cleanup', requireJwt, (_req, res) => res.status(200).json({ success: true }));
  return router;
}

function buildBlogsRouter(): Router {
  const router = Router();
  router.get('/published', (_req, res) => res.status(200).json({ success: true }));
  router.get('/:id', (_req, res) => res.status(200).json({ success: true }));
  router.get('/', requireJwt, (_req, res) => res.status(200).json({ success: true }));
  router.post('/', requireJwt, (_req, res) => res.status(200).json({ success: true }));
  router.put('/:id', requireJwt, (_req, res) => res.status(200).json({ success: true }));
  router.delete('/:id', requireJwt, (_req, res) => res.status(200).json({ success: true }));
  return router;
}

function buildSeoRouter(): Router {
  const router = Router();
  router.get('/sitemap.xml', (_req, res) => res.status(200).type('application/xml').send('<xml />'));
  router.get('/robots.txt', (_req, res) => res.status(200).type('text/plain').send('User-agent: *'));
  router.get('/products/:slug/schema', (_req, res) => res.status(200).json({ success: true, type: 'product-schema' }));
  router.get('/categories/:slug/schema', (_req, res) => {
    res.status(200).json({ success: true, type: 'category-schema' });
  });
  return router;
}

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

vi.mock('@/shared/infra/readiness', () => ({
  runReadinessCheck: async () => ({ ready: true, checks: {}, errors: [] }),
}));

vi.mock('@/modules/auth/auth.routes', () => ({ authRouter: buildAuthRouter() }));
vi.mock('@/modules/users/users.routes', () => ({ usersRouter: buildPrefixedCatchAllRouter('users') }));
vi.mock('@/modules/customers/customers.routes', () => ({
  customersRouter: buildPrefixedCatchAllRouter('customers'),
  adminCustomersRouter: buildPrefixedCatchAllRouter('admin-customers'),
}));
vi.mock('@/modules/catalog/catalog.routes', () => ({
  catalogRouter: buildCatalogRouter(),
  adminCatalogRouter: buildPrefixedCatchAllRouter('admin-catalog'),
}));
vi.mock('@/modules/categories/categories.routes', () => ({
  categoriesRouter: buildCategoriesRouter(),
  adminCategoriesRouter: buildPrefixedCatchAllRouter('admin-categories'),
}));
vi.mock('@/modules/orders/orders.routes', () => ({
  ordersRouter: buildPrefixedCatchAllRouter('orders'),
  adminOrdersRouter: buildPrefixedCatchAllRouter('admin-orders'),
}));
vi.mock('@/modules/orders/coupons.routes', () => ({
  couponsAdminRouter: buildPrefixedCatchAllRouter('admin-coupons'),
}));
vi.mock('@/modules/reviews/reviews.routes', () => ({
  reviewsRouter: buildReviewsRouter(),
  adminReviewsRouter: buildPrefixedCatchAllRouter('admin-reviews'),
}));
vi.mock('@/modules/admin/admin.routes', () => ({
  adminOperationsRouter: buildPrefixedCatchAllRouter('admin-operations'),
}));
vi.mock('@/modules/seo/seo.routes', () => ({
  seoRouter: buildSeoRouter(),
  adminRedirectsRouter: buildPrefixedCatchAllRouter('admin-redirects'),
}));
vi.mock('@/modules/payments/payments.routes', () => ({
  orderPaymentRouter: buildPrefixedCatchAllRouter('order-payment'),
  paymentWebhookRouter: buildPrefixedCatchAllRouter('payment-webhook'),
}));
vi.mock('@/modules/shipping/shipping.routes', () => ({
  shippingRouter: buildPrefixedCatchAllRouter('shipping'),
}));
vi.mock('@/modules/analytics/analytics.routes', () => ({
  analyticsRouter: buildAnalyticsRouter(),
}));
vi.mock('@/modules/blogs/blogs.routes', () => ({
  blogsRouter: buildBlogsRouter(),
}));

import { app } from '@/app';
import { openApiDocument } from '@/config/openapi';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type RouteCase = {
  method: HttpMethod;
  path: string;
  protected: boolean;
};

const JWT_SECRET = 'routes-jwt-integration-secret';

function signUserAccessToken(): string {
  return jwt.sign({ sub: 'admin-1', role: 'ADMIN', t: 'USER' }, JWT_SECRET, { expiresIn: '5m' });
}

function toConcretePath(pathWithParams: string): string {
  return pathWithParams
    .replace('{id}', 'id-1')
    .replace('{addressId}', 'addr-1')
    .replace('{code}', 'code-1')
    .replace('{productId}', 'prod-1')
    .replace('{variantId}', 'variant-1')
    .replace('{slug}', 'slug-1');
}

function buildRequestInit(method: HttpMethod, authToken?: string): RequestInit {
  const headers: Record<string, string> = {};
  if (authToken) {
    headers.authorization = `Bearer ${authToken}`;
  }

  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    headers['content-type'] = 'application/json';
    return {
      method,
      headers,
      body: JSON.stringify({}),
    };
  }

  return { method, headers };
}

function getOpenApiRouteCases(): RouteCase[] {
  const result: RouteCase[] = [];

  for (const [path, operations] of Object.entries(openApiDocument.paths)) {
    if (!operations || typeof operations !== 'object') {
      continue;
    }

    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      const operation = (operations as Record<string, unknown>)[method] as
        | { security?: unknown[] }
        | undefined;
      if (!operation) {
        continue;
      }

      const isProtected = Array.isArray(operation.security) && operation.security.length > 0;
      result.push({ method: method.toUpperCase() as HttpMethod, path, protected: isProtected });
    }
  }

  return result;
}

const routeCases = getOpenApiRouteCases();
const protectedRoutes = routeCases.filter((route) => route.protected);
const publicRoutes = routeCases.filter((route) => !route.protected);

let baseUrl = '';
let server: ReturnType<typeof app.listen>;

beforeAll(async () => {
  process.env['JWT_SECRET'] = JWT_SECRET;

  server = app.listen(0, '127.0.0.1');

  await new Promise<void>((resolve, reject) => {
    server.once('listening', () => resolve());
    server.once('error', (err) => reject(err));
  });

  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
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

describe('openapi routes jwt smoke', () => {
  it('has route cases loaded from OpenAPI document', () => {
    expect(routeCases.length).toBeGreaterThan(0);
    expect(protectedRoutes.length).toBeGreaterThan(0);
    expect(publicRoutes.length).toBeGreaterThan(0);
  });

  it.each(protectedRoutes)(
    'requires JWT auth for $method $path',
    async ({ method, path }) => {
      const concretePath = toConcretePath(path);
      const response = await fetch(`${baseUrl}${concretePath}`, buildRequestInit(method));

      expect(response.status).toBe(401);
    },
  );

  it.each(protectedRoutes)(
    'accepts signed JWT for $method $path',
    async ({ method, path }) => {
      const concretePath = toConcretePath(path);
      const token = signUserAccessToken();
      const response = await fetch(`${baseUrl}${concretePath}`, buildRequestInit(method, token));

      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(404);
      expect(response.status).not.toBe(405);
    },
  );

  it.each(publicRoutes)(
    'keeps public route reachable on $method $path',
    async ({ method, path }) => {
      const concretePath = toConcretePath(path);
      const response = await fetch(`${baseUrl}${concretePath}`, buildRequestInit(method));

      expect(response.status).not.toBe(401);
      expect(response.status).not.toBe(404);
      expect(response.status).not.toBe(405);
    },
  );
});
